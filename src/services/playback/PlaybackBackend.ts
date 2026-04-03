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
 */
export const SDK_SOURCES: ReadonlySet<TrackSource> = new Set(['spotify', 'appleMusic']);

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
  accessCredential?: string; // Queuer's service access credential (for SDK backends)
  musicUserCredential?: string; // Apple Music user credential (for MusicKit JS)
  developerCredential?: string; // MusicKit developer token (for Apple Music SDK)
}

export type ProgressListener = (progress: PlaybackProgress) => void;
export type TrackEndListener = () => void;

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

  /** Apply voltage sag degradation (volume + rate reduction) */
  setVoltageSag(active: boolean): Promise<void>;
}
