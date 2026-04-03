/**
 * PlaybackRouter — Dispatches playback to the correct backend.
 *
 * The router selects between:
 *   - ExpoAvBackend: for tracks with direct audio URLs (SoundCloud, Tidal, etc.)
 *   - WebViewSDKBackend: for DRM-protected tracks needing SDK playback (Spotify, Apple Music)
 *
 * For SDK-backed tracks, the router first fetches the queuer's fresh service
 * credentials from the backend, then passes them to the WebView SDK backend.
 * If the WebView is unavailable, it falls back to ExpoAvBackend with whatever
 * preview URL is available (may be a 30-sec preview or nothing).
 *
 * Credential flow:
 *   1. Router receives load(request) for a Spotify track
 *   2. Calls GET /api/playback/credentials/:queueTrackId
 *   3. Backend verifies requester is session host, looks up queuer's token
 *   4. Router injects credentials into the request and delegates to WebViewSDK
 *   5. WebViewSDK sends postMessage to hidden WebView → SDK plays the track
 */

import type {
  PlaybackBackend,
  PlaybackProgress,
  ProgressListener,
  TrackEndListener,
  TrackLoadRequest,
} from './PlaybackBackend';
import { SDK_SOURCES } from './PlaybackBackend';
import type { TrackSource } from '../../types';
import { ExpoAvBackend } from './ExpoAvBackend';
import { webViewSDKBackend } from './WebViewBridge';
import { apiFetch } from '../fetchClient';
import { logger } from '../../utils/logger';

/** Response from GET /api/playback/credentials/:queueTrackId */
interface PlaybackCredentials {
  source: string;
  sourceId: string;
  accessCredential?: string;
  musicUserCredential?: string;
  developerCredential?: string;
  queuerId: string;
}

export class PlaybackRouter implements PlaybackBackend {
  readonly name = 'Router';
  readonly supportedSources: ReadonlyArray<TrackSource> = [
    'spotify', 'appleMusic', 'soundcloud', 'youtube', 'tidal', 'itunes',
  ];

  private readonly expoAv = new ExpoAvBackend();
  private readonly webViewSDK = webViewSDKBackend;
  private activeBackend: PlaybackBackend | null = null;
  private progressListeners: ProgressListener[] = [];
  private trackEndListeners: TrackEndListener[] = [];
  private backendUnsubs: (() => void)[] = [];

  isAvailable(): boolean {
    return true; // At minimum ExpoAv is always available
  }

  async load(request: TrackLoadRequest): Promise<void> {
    // Detach from previous backend's events
    this.detachListeners();

    let backend = this.selectBackend(request.source);

    logger.debug('PlaybackRouter', `Selected ${backend.name} for ${request.source}`, {
      trackId: request.trackId,
      webViewAvailable: this.webViewSDK.isAvailable(),
    });

    // For SDK sources, fetch the queuer's credentials before loading
    if (SDK_SOURCES.has(request.source) && backend === this.webViewSDK) {
      try {
        const creds = await this.fetchCredentials(request.trackId);
        request = {
          ...request,
          sourceId: creds.sourceId || request.sourceId,
          accessCredential: creds.accessCredential,
          musicUserCredential: creds.musicUserCredential,
          developerCredential: creds.developerCredential,
        };
      } catch (err) {
        logger.warn(
          'PlaybackRouter',
          'Failed to fetch playback credentials — falling back to ExpoAv',
          err,
        );
        // Fall back to ExpoAv with whatever preview URL we have
        backend = this.expoAv;
      }
    }

    this.activeBackend = backend;

    // Attach progress/trackEnd listeners to the chosen backend
    this.attachListeners(backend);

    // Load the track on the selected backend
    await backend.load(request);
  }

  async pause(): Promise<void> {
    if (this.activeBackend) await this.activeBackend.pause();
  }

  async play(): Promise<void> {
    if (this.activeBackend) await this.activeBackend.play();
  }

  async seek(fraction: number): Promise<void> {
    if (this.activeBackend) await this.activeBackend.seek(fraction);
  }

  async stop(): Promise<void> {
    if (this.activeBackend) {
      await this.activeBackend.stop();
      this.detachListeners();
      this.activeBackend = null;
    }
  }

  getProgress(): PlaybackProgress {
    if (this.activeBackend) return this.activeBackend.getProgress();
    return {
      isPlaying: false,
      elapsed: 0,
      duration: 0,
      progress: 0,
      isLoading: false,
      error: null,
    };
  }

  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.push(listener);
    return () => {
      this.progressListeners = this.progressListeners.filter((l) => l !== listener);
    };
  }

  onTrackEnd(listener: TrackEndListener): () => void {
    this.trackEndListeners.push(listener);
    return () => {
      this.trackEndListeners = this.trackEndListeners.filter((l) => l !== listener);
    };
  }

  async setVoltageSag(active: boolean): Promise<void> {
    // Apply to both backends so whichever becomes active next is pre-configured
    await Promise.all([
      this.expoAv.setVoltageSag(active),
      this.webViewSDK.setVoltageSag(active),
    ]);
  }

  // ─── Private ─────────────────────────────────────────────

  private selectBackend(source: TrackSource): PlaybackBackend {
    if (SDK_SOURCES.has(source) && this.webViewSDK.isAvailable()) {
      return this.webViewSDK;
    }
    return this.expoAv;
  }

  private async fetchCredentials(queueTrackId: string): Promise<PlaybackCredentials> {
    return apiFetch<PlaybackCredentials>(`/playback/credentials/${queueTrackId}`);
  }

  private attachListeners(backend: PlaybackBackend): void {
    const unsubProgress = backend.onProgress((p) => {
      this.progressListeners.forEach((fn) => fn(p));
    });
    const unsubEnd = backend.onTrackEnd(() => {
      this.trackEndListeners.forEach((fn) => fn());
    });
    this.backendUnsubs = [unsubProgress, unsubEnd];
  }

  private detachListeners(): void {
    this.backendUnsubs.forEach((unsub) => unsub());
    this.backendUnsubs = [];
  }
}

/** Singleton — used by playbackEngine.ts */
export const playbackRouter = new PlaybackRouter();
