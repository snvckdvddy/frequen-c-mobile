/**
 * WebViewBridge — Communication bridge between the playback engine and
 * the hidden WebView running Spotify Web Playback SDK / MusicKit JS.
 *
 * The WebView component (PlaybackWebView) registers its postMessage ref
 * with this bridge. The PlaybackRouter sends commands through the bridge,
 * and the WebView posts progress/events back.
 *
 * Message Protocol (JSON):
 *   → To WebView:   { type: 'load', source, sourceId, credential, ... }
 *   → To WebView:   { type: 'play' | 'pause' | 'seek' | 'stop', ... }
 *   ← From WebView: { type: 'progress', isPlaying, elapsed, duration }
 *   ← From WebView: { type: 'trackEnd' }
 *   ← From WebView: { type: 'error', message }
 *   ← From WebView: { type: 'ready' }
 *
 * Dead-track detection (SoundCloud only): some tracks load in the Widget
 * but never play (label releases, embed-restricted uploads). The Widget
 * doesn't always raise an error for them, so a track that hasn't produced
 * real playback (progress past 0:00 while playing) within
 * SC_START_TIMEOUT_MS of load, or that errors before it starts, is
 * reported through onUnplayable. The host then skips it.
 */

import type {
  PlaybackBackend,
  PlaybackProgress,
  ProgressListener,
  TrackEndListener,
  TrackLoadRequest,
  UnplayableEvent,
  UnplayableListener,
  UnplayableReason,
} from './PlaybackBackend';
import type { TrackSource } from '../../types';
import { logger } from '../../utils/logger';

/**
 * How long a SoundCloud track gets to start playing before it is called
 * unplayable. Healthy tracks start in 1-3s; the bridge's own autoplay
 * nudge gives up at ~4s. The rest is headroom for a cold first load on a
 * slow connection: skipping a good track is worse than a slow verdict on
 * a bad one.
 */
export const SC_START_TIMEOUT_MS = 12_000;

type PostMessageFn = (message: string) => void;

/** Messages sent TO the WebView */
interface WebViewCommand {
  type: 'load' | 'play' | 'pause' | 'seek' | 'stop' | 'voltageSag';
  source?: string;
  sourceId?: string;
  credential?: string;
  musicUserCredential?: string;
  developerCredential?: string;
  fraction?: number;
  active?: boolean;
}

/** Messages received FROM the WebView */
interface WebViewEvent {
  type: 'ready' | 'progress' | 'trackEnd' | 'error';
  isPlaying?: boolean;
  elapsed?: number;
  duration?: number;
  message?: string;
}

/** The SoundCloud track the bridge is currently trying to start. */
interface ActiveSoundCloudLoad {
  trackId: string;
  sourceId: string;
}

export class WebViewSDKBackend implements PlaybackBackend {
  readonly name = 'WebViewSDK';
  readonly supportedSources: ReadonlyArray<TrackSource> = ['spotify', 'appleMusic', 'soundcloud'];

  private postMessage: PostMessageFn | null = null;
  private ready = false;
  private progress: PlaybackProgress = {
    isPlaying: false, elapsed: 0, duration: 0, progress: 0, isLoading: false, error: null,
  };
  private progressListeners: ProgressListener[] = [];
  private trackEndListeners: TrackEndListener[] = [];
  private unplayableListeners: UnplayableListener[] = [];
  private pendingLoad: TrackLoadRequest | null = null;

  // Dead-track watch (SoundCloud). `activeLoad` is non-null from the moment
  // the load command goes out until the track is stopped or ends.
  private activeLoad: ActiveSoundCloudLoad | null = null;
  private loadSentAt = 0;
  private startConfirmed = false;
  private unplayableReported = false;
  private startTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Called by PlaybackWebView when it mounts — registers the postMessage ref.
   */
  registerWebView(postMessage: PostMessageFn): void {
    this.postMessage = postMessage;
    logger.debug('WebViewSDK', 'WebView registered');
  }

  /**
   * Called by PlaybackWebView when it unmounts.
   */
  unregisterWebView(): void {
    this.postMessage = null;
    this.ready = false;
    // No bridge left to hear from; a late "unplayable" would be a false verdict.
    this.clearStartWatch();
    logger.debug('WebViewSDK', 'WebView unregistered');
  }

  /**
   * Called by PlaybackWebView when it receives a message from the WebView JS.
   */
  handleWebViewMessage(data: string): void {
    try {
      const event = JSON.parse(data) as WebViewEvent;
      switch (event.type) {
        case 'ready':
          this.ready = true;
          logger.info('WebViewSDK', 'WebView bridge ready', { pendingLoad: this.pendingLoad?.trackId ?? null });
          if (this.pendingLoad) {
            void this.load(this.pendingLoad);
            this.pendingLoad = null;
          }
          break;

        case 'progress': {
          // Some bridge emissions (SoundCloud PLAY_PROGRESS) carry
          // elapsed without a real duration. Retain the last known
          // duration so the progress ratio doesn't collapse to 0
          // between events — load() seeds it with the track's expected
          // duration, so the playhead is meaningful from the start.
          const dur = event.duration && event.duration > 0
            ? event.duration
            : this.progress.duration;
          const el = event.elapsed ?? 0;
          this.progress = {
            isPlaying: event.isPlaying ?? false,
            elapsed: el,
            duration: dur,
            progress: dur > 0 ? el / dur : 0,
            isLoading: false,
            error: null,
          };
          this.emitProgress();

          // The bridge reports isPlaying:true / elapsed:0 optimistically at
          // load, so only a position past 0:00 while playing proves audio.
          if (this.activeLoad && !this.startConfirmed && event.isPlaying && el > 0) {
            this.startConfirmed = true;
            this.clearStartTimer();
            logger.info('WebViewSDK', 'SoundCloud playback started', {
              trackId: this.activeLoad.trackId,
              msToStart: Date.now() - this.loadSentAt,
            });
          }
          break;
        }

        case 'trackEnd':
          this.clearStartWatch();
          this.progress = { ...this.progress, isPlaying: false };
          this.emitProgress();
          this.trackEndListeners.forEach((fn) => fn());
          break;

        case 'error':
          logger.warn('WebViewSDK', 'Playback error from WebView', {
            message: event.message,
            trackId: this.activeLoad?.trackId ?? null,
          });
          // An error before the track ever started means it isn't going to
          // (repeats after the verdict are ignored). An error mid-track
          // keeps the old behavior: surface it, don't skip.
          if (this.activeLoad && !this.startConfirmed) {
            this.reportUnplayable('widget-error', event.message);
            break;
          }
          this.progress = { ...this.progress, isLoading: false, error: event.message ?? 'Playback failed' };
          this.emitProgress();
          break;
      }
    } catch (err) {
      logger.warn('WebViewSDK', 'Failed to parse WebView message', err);
    }
  }

  isAvailable(): boolean {
    return this.postMessage !== null;
  }

  async load(request: TrackLoadRequest): Promise<void> {
    // A new load supersedes whatever the previous one was waiting on.
    this.clearStartWatch();

    if (!this.postMessage) {
      // WebView not yet mounted — queue the request
      logger.info('WebViewSDK', 'Load queued: WebView not mounted', { trackId: request.trackId });
      this.pendingLoad = request;
      this.progress = {
        isPlaying: false, elapsed: 0, duration: request.durationSec,
        progress: 0, isLoading: true, error: null,
      };
      this.emitProgress();
      return;
    }

    if (!this.ready) {
      logger.info('WebViewSDK', 'Load queued: bridge not ready', { trackId: request.trackId });
      this.pendingLoad = request;
      return;
    }

    this.progress = {
      isPlaying: false, elapsed: 0, duration: request.durationSec,
      progress: 0, isLoading: true, error: null,
    };
    this.emitProgress();

    logger.info('WebViewSDK', 'Load command sent', {
      trackId: request.trackId, source: request.source, sourceId: request.sourceId,
    });
    this.send({
      type: 'load',
      source: request.source,
      sourceId: request.sourceId,
      credential: request.accessCredential,
      musicUserCredential: request.musicUserCredential,
      developerCredential: request.developerCredential,
    });

    this.beginStartWatch(request);
  }

  async pause(): Promise<void> {
    // The host chose to pause; a track that sits at 0:00 on purpose isn't dead.
    this.clearStartTimer();
    this.send({ type: 'pause' });
  }

  async play(): Promise<void> {
    logger.info('WebViewSDK', 'Play command sent', {
      trackId: this.activeLoad?.trackId ?? null,
      webViewAttached: this.postMessage !== null,
    });
    this.send({ type: 'play' });
    // A manual play on a track that still hasn't started gets a fresh window.
    if (this.activeLoad && !this.startConfirmed && !this.unplayableReported) {
      this.armStartTimer();
    }
  }

  async seek(fraction: number): Promise<void> {
    this.send({ type: 'seek', fraction: Math.max(0, Math.min(1, fraction)) });
  }

  async stop(): Promise<void> {
    this.clearStartWatch();
    this.send({ type: 'stop' });
    this.progress = {
      isPlaying: false, elapsed: 0, duration: 0, progress: 0, isLoading: false, error: null,
    };
    this.emitProgress();
  }

  getProgress(): PlaybackProgress {
    return { ...this.progress };
  }

  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.push(listener);
    return () => { this.progressListeners = this.progressListeners.filter((l) => l !== listener); };
  }

  onTrackEnd(listener: TrackEndListener): () => void {
    this.trackEndListeners.push(listener);
    return () => { this.trackEndListeners = this.trackEndListeners.filter((l) => l !== listener); };
  }

  onUnplayable(listener: UnplayableListener): () => void {
    this.unplayableListeners.push(listener);
    return () => { this.unplayableListeners = this.unplayableListeners.filter((l) => l !== listener); };
  }

  async setVoltageSag(active: boolean): Promise<void> {
    this.send({ type: 'voltageSag', active });
  }

  // ─── Private ─────────────────────────────────────────────

  private send(cmd: WebViewCommand): void {
    if (this.postMessage) {
      this.postMessage(JSON.stringify(cmd));
    }
  }

  private emitProgress(): void {
    const snapshot = { ...this.progress };
    this.progressListeners.forEach((fn) => fn(snapshot));
  }

  // ─── Dead-track watch (SoundCloud) ───────────────────────

  /** Start watching a freshly sent load. Only SoundCloud is watched. */
  private beginStartWatch(request: TrackLoadRequest): void {
    this.clearStartWatch();
    if (request.source !== 'soundcloud') return;

    this.activeLoad = { trackId: request.trackId, sourceId: request.sourceId };
    this.loadSentAt = Date.now();
    this.startConfirmed = false;
    this.unplayableReported = false;
    this.armStartTimer();
  }

  private armStartTimer(): void {
    this.clearStartTimer();
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      this.reportUnplayable('start-timeout');
    }, SC_START_TIMEOUT_MS);
  }

  private clearStartTimer(): void {
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
  }

  private clearStartWatch(): void {
    this.clearStartTimer();
    this.activeLoad = null;
    this.startConfirmed = false;
    this.unplayableReported = false;
  }

  /** Tell listeners the active SoundCloud track isn't going to play. Once per load. */
  private reportUnplayable(reason: UnplayableReason, message?: string): void {
    const load = this.activeLoad;
    if (!load || this.unplayableReported) return;

    this.unplayableReported = true;
    this.clearStartTimer();
    logger.warn('WebViewSDK', 'SoundCloud track unplayable', {
      trackId: load.trackId,
      sourceId: load.sourceId,
      reason,
      message,
      msSinceLoad: Date.now() - this.loadSentAt,
    });

    // Don't leave a spinner or a "playing" state up for a track that never started.
    this.progress = { ...this.progress, isPlaying: false, isLoading: false };
    this.emitProgress();

    const event: UnplayableEvent = {
      trackId: load.trackId,
      source: 'soundcloud',
      sourceId: load.sourceId,
      reason,
      ...(message ? { message } : {}),
    };
    this.unplayableListeners.forEach((fn) => fn(event));
  }
}

/** Singleton instance — shared between PlaybackRouter and PlaybackWebView */
export const webViewSDKBackend = new WebViewSDKBackend();
