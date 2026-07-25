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
 */

import type {
  PlaybackBackend,
  PlaybackProgress,
  ProgressListener,
  TrackEndListener,
  TrackLoadRequest,
} from './PlaybackBackend';
import type { TrackSource } from '../../types';
import { logger } from '../../utils/logger';

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
  private pendingLoad: TrackLoadRequest | null = null;

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
          logger.debug('WebViewSDK', 'WebView bridge ready');
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
          break;
        }

        case 'trackEnd':
          this.progress = { ...this.progress, isPlaying: false };
          this.emitProgress();
          this.trackEndListeners.forEach((fn) => fn());
          break;

        case 'error':
          logger.warn('WebViewSDK', 'Playback error from WebView', event.message);
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
    if (!this.postMessage) {
      // WebView not yet mounted — queue the request
      this.pendingLoad = request;
      this.progress = {
        isPlaying: false, elapsed: 0, duration: request.durationSec,
        progress: 0, isLoading: true, error: null,
      };
      this.emitProgress();
      return;
    }

    if (!this.ready) {
      this.pendingLoad = request;
      return;
    }

    this.progress = {
      isPlaying: false, elapsed: 0, duration: request.durationSec,
      progress: 0, isLoading: true, error: null,
    };
    this.emitProgress();

    this.send({
      type: 'load',
      source: request.source,
      sourceId: request.sourceId,
      credential: request.accessCredential,
      musicUserCredential: request.musicUserCredential,
      developerCredential: request.developerCredential,
    });
  }

  async pause(): Promise<void> {
    this.send({ type: 'pause' });
  }

  async play(): Promise<void> {
    this.send({ type: 'play' });
  }

  async seek(fraction: number): Promise<void> {
    this.send({ type: 'seek', fraction: Math.max(0, Math.min(1, fraction)) });
  }

  async stop(): Promise<void> {
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
}

/** Singleton instance — shared between PlaybackRouter and PlaybackWebView */
export const webViewSDKBackend = new WebViewSDKBackend();
