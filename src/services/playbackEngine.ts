/**
 * Playback Engine — public API for audio playback.
 *
 * Same API as before (loadTrack, togglePlayPause, pause, play, seekTo, stop,
 * onProgress, onTrackEnd, formatTime) — zero UI changes needed.
 *
 * Internally delegates to PlaybackRouter, which dispatches to:
 *   - ExpoAvBackend: direct audio URLs (SoundCloud, Tidal CDN streams)
 *   - WebViewSDKBackend: DRM-protected SDK playback (Spotify, Apple Music)
 *
 * Adapter URL resolution (fetching fresh CDN streams) still lives here as
 * pre-processing before handing off to the router. Timer fallback for mock
 * data is preserved as the ultimate fallback.
 */

import { getAdapterForSource } from './adapters/musicServiceAdapter';
import { currentServices } from './api';
import { playbackRouter } from './playback/PlaybackRouter';
import { SDK_SOURCES } from './playback/PlaybackBackend';
import type { UnplayableEvent } from './playback/PlaybackBackend';
import { TrackSource } from '../types';
import { logger } from '../utils/logger';

export interface PlaybackState {
  isPlaying: boolean;
  currentTrackId: string | null;
  elapsed: number;      // seconds
  duration: number;     // seconds
  progress: number;     // 0..1
  isLoading: boolean;   // true while buffering/loading
  error: string | null; // non-null if load failed
}

type ProgressListener = (state: PlaybackState) => void;
type TrackEndListener = () => void;
type TrackUnplayableListener = (event: UnplayableEvent) => void;

// ─── Internal state ─────────────────────────────────────────

let state: PlaybackState = {
  isPlaying: false,
  currentTrackId: null,
  elapsed: 0,
  duration: 0,
  progress: 0,
  isLoading: false,
  error: null,
};

let progressListeners: ProgressListener[] = [];
let trackEndListeners: TrackEndListener[] = [];
let trackUnplayableListeners: TrackUnplayableListener[] = [];

// ─── Playback intent ────────────────────────────────────────
// Whether the host wants audio running right now. It becomes
// TrackLoadRequest.autoplay, which gates the dead-track watch: a room
// restored on cold launch loads its current track but waits for the host to
// press play (verified on device 2026-11-02), and that track must not be
// skipped as "never started".
//   'idle'    nothing asked yet (cold launch, new session): not wanted
//   'wanted'  explicit play, Retry, or audio really moving
//   'paused'  explicit pause. Real audio does not override it, because a
//             progress report already in flight when pause lands would flip
//             it back. An explicit play, or a new load, ends it.
// stop() leaves it alone, so skipping while playing keeps the next track
// watched; the host hook resets it when hosting starts or ends.
type PlaybackIntent = 'idle' | 'wanted' | 'paused';
let playbackIntent: PlaybackIntent = 'idle';

function setPlaybackIntent(next: PlaybackIntent, why: string): void {
  if (playbackIntent === next) return;
  logger.info('playback', `Playback intent ${playbackIntent} -> ${next}`, { why });
  playbackIntent = next;
}

// ─── Voltage Sag audio degradation ──────────────────────────
let voltageSagActive = false;

// SDK_SOURCES imported from PlaybackBackend.ts (single source of truth)

// ─── Router subscriptions ──────────────────────────────────
// Subscribe to the PlaybackRouter's events once at module load.
// These forward router events into the engine's local state + listeners.

let routerUnsubProgress: (() => void) | null = null;
let routerUnsubTrackEnd: (() => void) | null = null;
let routerUnsubUnplayable: (() => void) | null = null;

function subscribeToRouter(): void {
  if (routerUnsubProgress) return; // already subscribed

  routerUnsubProgress = playbackRouter.onProgress((p) => {
    // Audio really moving means the host is listening, even if nobody
    // pressed play (the bridge autoplays). Never overrides an explicit pause.
    if (p.isPlaying && p.elapsed > 0 && playbackIntent === 'idle') {
      setPlaybackIntent('wanted', 'audio playing');
    }
    state = {
      ...state,
      isPlaying: p.isPlaying,
      elapsed: p.elapsed,
      duration: p.duration,
      progress: p.progress,
      isLoading: p.isLoading,
      error: p.error,
    };
    emitProgress();
  });

  routerUnsubTrackEnd = playbackRouter.onTrackEnd(() => {
    state = { ...state, isPlaying: false };
    emitProgress();
    trackEndListeners.forEach((fn) => fn());
  });

  // A loaded track the backend has decided will never play. The host hook
  // decides what to do about it (skip, or stop and tell the host).
  routerUnsubUnplayable = playbackRouter.onUnplayable((event) => {
    trackUnplayableListeners.forEach((fn) => fn(event));
  });
}

function emitProgress(): void {
  const snapshot = { ...state };
  progressListeners.forEach((fn) => fn(snapshot));
}

// ─── Public API ─────────────────────────────────────────────

export interface LoadTrackOptions {
  /**
   * The caller wants this track playing (Retry). Overrides the host's
   * recorded intent. Left out, autoplay follows the host's intent, which
   * is false for a restore-style load (nothing played yet this session).
   */
  autoplay?: boolean;
}

/**
 * Load a track and start playing.
 *
 * For CDN-backed sources (SoundCloud, Tidal), resolves fresh stream URLs
 * via the adapter layer before handing off to the router.
 *
 * For SDK-backed sources (Spotify, Apple Music), the router fetches the
 * queuer's credentials from the backend and delegates to the WebView SDK.
 */
export async function loadTrack(
  trackId: string,
  durationSec: number,
  previewUrl?: string,
  sourceId?: string,
  source?: TrackSource,
  options?: LoadTrackOptions,
): Promise<void> {

  // Ensure we're subscribed to the router
  subscribeToRouter();

  // Did the host ask for playback? Decided before this load can change the
  // intent: a restore-style load (idle) is not a request, auto-advance and
  // skip while playing (wanted) are, a track change while paused is not.
  const autoplay = options?.autoplay ?? playbackIntent === 'wanted';
  if (options?.autoplay) {
    setPlaybackIntent('wanted', 'load asked for autoplay');
  } else if (playbackIntent === 'paused') {
    // A new load ends the pause: audio from the new track counts again.
    setPlaybackIntent('idle', 'new load after pause');
  }

  // info, not debug: the first line of the track lifecycle in release logcat.
  logger.info('playback', 'Load track', {
    trackId, source: source ?? null, sourceId: sourceId ?? null, durationSec, autoplay,
  });

  // For CDN-backed sources, resolve fresh stream URLs via adapters.
  // SDK sources (Spotify, Apple Music) don't need URL resolution —
  // the SDK plays by track ID using the queuer's credentials.
  const resolveId = sourceId || trackId;
  if (source && !SDK_SOURCES.has(source) && !resolveId.startsWith('itunes_')) {
    try {
      const adapter = getAdapterForSource(source, currentServices);
      const adapterName = adapter.serviceName ?? 'unknown';
      logger.debug('playback', 'Resolving stream', {
        source, adapter: adapterName, connected: adapter.isConnected(), resolveId,
      });
      if (adapter.isConnected()) {
        const freshUrl = await adapter.getStreamUrl(resolveId);
        if (freshUrl) {
          logger.debug('playback', `Got fresh URL from ${adapterName}`, freshUrl.slice(0, 80));
          previewUrl = freshUrl;
        } else {
          logger.debug('playback', `${adapterName}.getStreamUrl returned empty — using original previewUrl`);
        }
      } else {
        logger.debug('playback', `${adapterName} not connected — using original previewUrl`);
      }
    } catch (err) {
      logger.warn('playback', 'Adapter failed to fetch fresh stream', err);
    }
  } else if (source && SDK_SOURCES.has(source)) {
    logger.debug('playback', `SDK source (${source}) — skipping adapter resolution`);
  } else {
    logger.debug('playback', 'iTunes or unknown source — skipping adapter resolution');
  }

  // Stop any current playback
  stopTimerFallback();

  // Set initial state.
  state = {
    isPlaying: false,
    currentTrackId: trackId,
    elapsed: 0,
    duration: durationSec,
    progress: 0,
    isLoading: true,
    error: null,
  };
  emitProgress();

  // Delegate to the PlaybackRouter
  try {
    await playbackRouter.load({
      trackId,
      sourceId: sourceId || trackId,
      source: source || 'itunes',
      durationSec,
      previewUrl,
      autoplay,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Playback load failed';
    logger.warn('playback', 'Router load failed', err);

    // For tracks with no URL and no SDK path, use timer fallback (mock data only)
    if (!previewUrl && !source) {
      startTimerFallback(trackId, durationSec);
    } else {
      state = { ...state, isLoading: false, error: msg };
      emitProgress();
    }
  }
}

/** Toggle play/pause */
export async function togglePlayPause(): Promise<void> {
  if (timerFallbackId) {
    // Timer fallback toggle
    state = { ...state, isPlaying: !state.isPlaying };
    setPlaybackIntent(state.isPlaying ? 'wanted' : 'paused', 'toggle');
    if (state.isPlaying) {
      resumeTimerFallback();
    } else {
      pauseTimerFallback();
    }
    emitProgress();
    return;
  }
  // Delegate to router
  const progress = playbackRouter.getProgress();
  if (progress.isPlaying) {
    setPlaybackIntent('paused', 'toggle to pause');
    await playbackRouter.pause();
  } else {
    setPlaybackIntent('wanted', 'toggle to play');
    await playbackRouter.play();
  }
}

/** Pause playback */
export async function pause(): Promise<void> {
  setPlaybackIntent('paused', 'pause');
  if (timerFallbackId) {
    pauseTimerFallback();
    state = { ...state, isPlaying: false };
    emitProgress();
    return;
  }
  await playbackRouter.pause();
}

/** Resume playback */
export async function play(): Promise<void> {
  setPlaybackIntent('wanted', 'play');
  if (timerFallbackId) {
    state = { ...state, isPlaying: true };
    resumeTimerFallback();
    emitProgress();
    return;
  }
  await playbackRouter.play();
}

/** Seek to a specific position (0..1) */
export async function seekTo(fraction: number): Promise<void> {
  const clamped = Math.max(0, Math.min(1, fraction));

  if (timerFallbackId) {
    state = {
      ...state,
      elapsed: clamped * state.duration,
      progress: clamped,
    };
    emitProgress();
    return;
  }

  await playbackRouter.seek(clamped);
}

/** Get current state snapshot */
export function getState(): PlaybackState {
  return { ...state };
}

/**
 * Forget what the host asked for. A new session, or this device starting or
 * ending hosting, begins idle: the first load is a restore, not a request.
 */
export function resetPlaybackIntent(): void {
  setPlaybackIntent('idle', 'reset');
}

/** Stop and reset */
export async function stop(): Promise<void> {
  stopTimerFallback();
  await playbackRouter.stop();

  state = {
    isPlaying: false,
    currentTrackId: null,
    elapsed: 0,
    duration: 0,
    progress: 0,
    isLoading: false,
    error: null,
  };
  emitProgress();
}

// ─── Listeners ──────────────────────────────────────────────

export function onProgress(listener: ProgressListener): () => void {
  progressListeners.push(listener);
  return () => {
    progressListeners = progressListeners.filter((l) => l !== listener);
  };
}

export function onTrackEnd(listener: TrackEndListener): () => void {
  trackEndListeners.push(listener);
  return () => {
    trackEndListeners = trackEndListeners.filter((l) => l !== listener);
  };
}

/**
 * The loaded track will never play (the SoundCloud Widget errored, or the
 * track never started). Fires once per load, with the queue-track ID so
 * a listener can ignore a verdict for a track that is no longer current.
 */
export function onTrackUnplayable(listener: TrackUnplayableListener): () => void {
  trackUnplayableListeners.push(listener);
  return () => {
    trackUnplayableListeners = trackUnplayableListeners.filter((l) => l !== listener);
  };
}

/** Format seconds -> "M:SS" */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Timer Fallback (for mock data with no audio) ──────────

const TICK_MS = 250;
let timerFallbackId: ReturnType<typeof setInterval> | null = null;

function startTimerFallback(trackId: string, durationSec: number): void {
  stopTimerFallback();
  state = {
    isPlaying: true,
    currentTrackId: trackId,
    elapsed: 0,
    duration: durationSec,
    progress: 0,
    isLoading: false,
    error: null,
  };
  emitProgress();
  timerFallbackId = setInterval(timerTick, TICK_MS);
}

function timerTick(): void {
  if (!state.isPlaying || state.duration <= 0) return;

  state.elapsed = Math.min(state.elapsed + TICK_MS / 1000, state.duration);
  state.progress = state.elapsed / state.duration;
  emitProgress();

  if (state.elapsed >= state.duration) {
    state.isPlaying = false;
    stopTimerFallback();
    trackEndListeners.forEach((fn) => fn());
  }
}

function pauseTimerFallback(): void {
  if (timerFallbackId) {
    clearInterval(timerFallbackId);
    timerFallbackId = null;
  }
}

function resumeTimerFallback(): void {
  if (!timerFallbackId && state.isPlaying) {
    timerFallbackId = setInterval(timerTick, TICK_MS);
  }
}

function stopTimerFallback(): void {
  if (timerFallbackId) {
    clearInterval(timerFallbackId);
    timerFallbackId = null;
  }
}

// ─── Voltage Sag Control ─────────────────────────────────────

/**
 * Enable or disable Voltage Sag audio degradation.
 * When enabled: volume drops to 75%, playback rate slows to 0.98.
 */
export async function setVoltageSag(active: boolean): Promise<void> {
  voltageSagActive = active;
  await playbackRouter.setVoltageSag(active);
}

/** Get current Voltage Sag state */
export function isVoltageSagActive(): boolean {
  return voltageSagActive;
}

export default {
  loadTrack, togglePlayPause, pause, play, seekTo,
  getState, stop, onProgress, onTrackEnd, onTrackUnplayable, formatTime,
  setVoltageSag, isVoltageSagActive, resetPlaybackIntent,
};
