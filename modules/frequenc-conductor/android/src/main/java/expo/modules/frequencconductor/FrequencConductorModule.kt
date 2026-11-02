package expo.modules.frequencconductor

import android.app.SearchManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Conductor mode (lane 2): Frequen-C tells the HOST's own music app what to
 * play and watches what it is playing. No audio passes through Frequen-C and
 * no platform developer API is used, only Android's standard media commands:
 *
 *  - MEDIA_PLAY_FROM_SEARCH intents (what Google Assistant sends for
 *    "play X on Spotify")
 *  - MediaController transport controls on the app's active media session
 *    (what Android Auto and Wear OS use)
 *  - MediaSessionManager active-session callbacks for now-playing state,
 *    which require the host to grant notification access
 *
 * This first cut exists to answer two questions on a real device: does the
 * music app accept play commands from Frequen-C, and can the end of a song
 * be detected reliably.
 */
class FrequencConductorModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val watched = mutableMapOf<String, Pair<MediaController, MediaController.Callback>>()
  private var sessionsListener: MediaSessionManager.OnActiveSessionsChangedListener? = null

  private val audioFocus = "vnd.android.cursor.item/audio"

  private fun listenerComponent() = ComponentName(context, ConductorNotificationListener::class.java)

  private fun sessionManager() =
    context.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager

  private fun hasNotificationAccess(): Boolean {
    val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
      ?: return false
    return enabled.split(":").any {
      ComponentName.unflattenFromString(it)?.packageName == context.packageName
    }
  }

  private fun activeControllers(): List<MediaController> {
    if (!hasNotificationAccess()) return emptyList()
    return try {
      sessionManager().getActiveSessions(listenerComponent())
    } catch (e: SecurityException) {
      emptyList()
    }
  }

  private fun controllerFor(packageName: String?): MediaController? {
    val controllers = activeControllers()
    if (packageName != null) return controllers.firstOrNull { it.packageName == packageName }
    return controllers.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }
      ?: controllers.firstOrNull()
  }

  private fun stateName(state: Int?): String = when (state) {
    PlaybackState.STATE_PLAYING -> "playing"
    PlaybackState.STATE_PAUSED -> "paused"
    PlaybackState.STATE_STOPPED -> "stopped"
    PlaybackState.STATE_BUFFERING -> "buffering"
    PlaybackState.STATE_CONNECTING -> "connecting"
    PlaybackState.STATE_SKIPPING_TO_NEXT -> "skipping"
    PlaybackState.STATE_ERROR -> "error"
    null, PlaybackState.STATE_NONE -> "none"
    else -> "other"
  }

  private fun describe(controller: MediaController): Map<String, Any?> {
    val meta = controller.metadata
    val state = controller.playbackState
    return mapOf(
      "packageName" to controller.packageName,
      "state" to stateName(state?.state),
      "title" to meta?.getString(MediaMetadata.METADATA_KEY_TITLE),
      "artist" to meta?.getString(MediaMetadata.METADATA_KEY_ARTIST),
      "album" to meta?.getString(MediaMetadata.METADATA_KEY_ALBUM),
      "durationMs" to meta?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.toDouble(),
      "positionMs" to state?.position?.toDouble(),
      "updatedAtMs" to System.currentTimeMillis().toDouble()
    )
  }

  private fun emit(controller: MediaController) {
    sendEvent("onNowPlayingChange", describe(controller))
  }

  // Keyed by package: music apps keep one media session each.
  private fun syncWatched(controllers: List<MediaController>?) {
    val current = controllers ?: emptyList()
    val livePackages = current.map { it.packageName }.toSet()
    watched.keys.filter { it !in livePackages }.forEach { key ->
      watched.remove(key)?.let { (controller, callback) -> controller.unregisterCallback(callback) }
    }
    current.forEach { controller ->
      if (watched.containsKey(controller.packageName)) return@forEach
      val callback = object : MediaController.Callback() {
        override fun onPlaybackStateChanged(state: PlaybackState?) = emit(controller)
        override fun onMetadataChanged(metadata: MediaMetadata?) = emit(controller)
        override fun onSessionDestroyed() = syncWatched(activeControllers())
      }
      controller.registerCallback(callback, mainHandler)
      watched[controller.packageName] = controller to callback
      emit(controller)
    }
  }

  private fun stopWatchingInternal() {
    sessionsListener?.let { sessionManager().removeOnActiveSessionsChangedListener(it) }
    sessionsListener = null
    watched.values.forEach { (controller, callback) -> controller.unregisterCallback(callback) }
    watched.clear()
  }

  override fun definition() = ModuleDefinition {
    Name("FrequencConductor")

    Events("onNowPlayingChange")

    Function("isNotificationAccessGranted") {
      hasNotificationAccess()
    }

    Function("openNotificationAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("isPackageInstalled") { packageName: String ->
      context.packageManager.getLaunchIntentForPackage(packageName) != null
    }

    Function("startWatching") {
      if (!hasNotificationAccess()) return@Function false
      if (sessionsListener == null) {
        val listener = MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
          syncWatched(controllers)
        }
        try {
          sessionManager().addOnActiveSessionsChangedListener(listener, listenerComponent(), mainHandler)
          sessionsListener = listener
        } catch (e: SecurityException) {
          return@Function false
        }
      }
      syncWatched(activeControllers())
      true
    }

    Function("stopWatching") {
      stopWatchingInternal()
    }

    Function("getNowPlaying") {
      activeControllers().map { describe(it) }
    }

    // Launches the music app with a "play this song" search. Brings that app
    // to the foreground.
    AsyncFunction("playFromSearch") { query: String, title: String?, artist: String?, packageName: String? ->
      val intent = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH).apply {
        putExtra(SearchManager.QUERY, query)
        putExtra(MediaStore.EXTRA_MEDIA_FOCUS, audioFocus)
        title?.let { putExtra(MediaStore.EXTRA_MEDIA_TITLE, it) }
        artist?.let { putExtra(MediaStore.EXTRA_MEDIA_ARTIST, it) }
        packageName?.let { setPackage(it) }
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      true
    }

    // Same request sent to the app's existing media session instead of
    // launching it: the background path. Needs notification access and an
    // active session (the app has played something since it last started).
    AsyncFunction("controllerPlayFromSearch") { query: String, packageName: String ->
      val controller = controllerFor(packageName)
        ?: throw IllegalStateException("No active session for $packageName. Play anything in that app once, then retry.")
      val extras = Bundle().apply { putString(MediaStore.EXTRA_MEDIA_FOCUS, audioFocus) }
      controller.transportControls.playFromSearch(query, extras)
      true
    }

    AsyncFunction("controllerPlayFromUri") { uri: String, packageName: String ->
      val controller = controllerFor(packageName)
        ?: throw IllegalStateException("No active session for $packageName. Play anything in that app once, then retry.")
      controller.transportControls.playFromUri(Uri.parse(uri), Bundle())
      true
    }

    AsyncFunction("openUri") { uri: String, packageName: String? ->
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
        packageName?.let { setPackage(it) }
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      true
    }

    AsyncFunction("transport") { action: String, packageName: String? ->
      val controls = controllerFor(packageName)?.transportControls
        ?: throw IllegalStateException("No active music session to control.")
      when (action) {
        "play" -> controls.play()
        "pause" -> controls.pause()
        "next" -> controls.skipToNext()
        "previous" -> controls.skipToPrevious()
        else -> throw IllegalArgumentException("Unknown transport action: $action")
      }
      true
    }

    OnDestroy {
      stopWatchingInternal()
    }
  }
}
