/**
 * PlaybackBackend — Interface for all audio playback implementations.
 *
 * The playback engine dispatches to the correct backend based on the track's
 * source. Each backend handles loading, transport controls, and progress
 * reporting for its specific audio mechanism.
 *
 * Implementations:
 *   ExpoAvBackend      — expo-av Audio.Sound for direct audio URLs (SoundCloud, Tidal CDN)
 *   WebViewSDKBackend  — Spotify Web Playback SDK / MusicKit JS in hidden WebView
 */

import type { TrackSource } from '../../types';

/**
 * Sources that require SDK playback via the hidden WebView.
 * Shared constant — used by PlaybackRouter and playbackEngine.ts so
 * the definition stays in one place.
 *
 * Why each entry is here:
 * - `spotify`     — Web Playback SDK (DRM)
 * - `appleMusic`  — MusicKit JS (FairPlay DRM)
 * - `soundcloud`  — SoundCloud Widget API (sanctioned third-party iframe
 *                   player; the legacy /tracks/{id}/stream redirect we
 *                   used previously returns 30s preview clips from
 *                   cf-preview-media.sndcdn.com regardless of OAuth.
 *                   See playback_model.md canon for full diagnosis.)
 *
 * NOTE: keeping this set in sync with `WebViewSDKBackend.supportedSources`
 * (in WebViewBridge.ts) is the authoritative pairing for routing — the
 * router uses this set to decide whether to route to the WebView SDK
 * backend, and the backend itself reports the same set for cross-check.
 */
export const SDK_SOURCES: ReadonlySet<TrackSource> = new Set(['spotify', 'appleMusic', 'soundcloud']);

export interface PlaybackProgress {
  isPlaying: boolean;
  elapsed: number;   // seconds
  duration: number;  // seconds
  progress: number;  // 0..1
  isLoading: boolean;
  error: string | null;
}

export interface TrackLoadRequest {
  trackId: string;           // Internal queue track ID
  sourceId: string;          // Service-specific track ID (e.g., Spotify track ID)
  source: TrackSource;       // Which service the track is from
  durationSec: number;       // Expected duration
  previewUrl?: string;       // Fallback audio URL (CDN or preview)
  /**
   * The caller wants this load to be playing (auto-advance, skip while
   * playing, Retry). False or omitted for a restore-style load, where the
   * room comes back paused and the host presses play. Backends use it to
   * decide whether to start watching for a track that never starts; an
   * explicit play() starts that watch either way.
   */
  autoplay?: boolean;
  accessCredential?: string; // Queuer's service access credential (for SDK backends)
  musicUserCredential?: string; // Apple Music user credential (for MusicKit JS)
  developerCredential?: string; // MusicKit developer token (for Apple Music SDK)
}

export type ProgressListener = (progress: PlaybackProgress) => void;
export type TrackEndListener = () => void;

/**
 * Why a loaded track is being called unplayable.
 * - `widget-error`: the SoundCloud Widget (or the bridge) reported an error
 *   before playback ever started.
 * - `start-timeout`: the track never produced real playback (no progress
 *   past 0:00) within the start window after load / play.
 */
export type UnplayableReason = 'widget-error' | 'start-timeout';

/** A track that was loaded but can't be played on this device. */
export interface UnplayableEvent {
  /** Internal queue-track ID (the `trackId` the load request carried). */
  trackId: string;
  source: TrackSource;
  sourceId: string;
  reason: UnplayableReason;
  /** Raw error text from the bridge, when there was one. */
  message?: string;
}

export type UnplayableListener = (event: UnplayableEvent) => void;

export interface PlaybackBackend {
  /** Human-readable name for logging */
  readonly name: string;

  /** Which track sources this backend can handle */
  readonly supportedSources: ReadonlyArray<TrackSource>;

  /** Whether this backend is currently available (e.g., WebView mounted) */
  isAvailable(): boolean;

  /** Load a track and start playing */
  load(request: TrackLoadRequest): Promise<void>;

  /** Pause playback */
  pause(): Promise<void>;

  /** Resume playback */
  play(): Promise<void>;

  /** Seek to position (0..1 fraction) */
  seek(fraction: number): Promise<void>;

  /** Stop and unload current track */
  stop(): Promise<void>;

  /** Get current progress snapshot */
  getProgress(): PlaybackProgress;

  /** Subscribe to progress updates */
  onProgress(listener: ProgressListener): () => void;

  /** Subscribe to track-end events */
  onTrackEnd(listener: TrackEndListener): () => void;

  /**
   * Subscribe to "this track can't be played" verdicts. Optional: only
   * backends that can tell a dead track from a slow one implement it
   * (today: WebViewSDKBackend, for SoundCloud).
   */
  onUnplayable?(listener: UnplayableListener): () => void;

  /** Apply voltage sag degradation (volume + rate reduction) */
  setVoltageSag(active: boolean): Promise<void>;
}
