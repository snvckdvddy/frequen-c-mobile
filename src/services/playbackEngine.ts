/**
 * Playback Engine — real audio via expo-av.
 *
 * Same public API as the old timer-based simulation:
 *   loadTrack, togglePlayPause, pause, play, seekTo, stop,
 *   onProgress, onTrackEnd, formatTime
 *
 * Internal swap: Audio.Sound instance streaming preview URLs.
 * Progress driven by onPlaybackStatusUpdate.
 * The rest of the app binds to the same callbacks — zero UI changes.
 */

import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';

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

// ─── Internal state ─────────────────────────────────────────

let sound: Audio.Sound | null = null;
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

// ─── Audio mode (configure once) ────────────────────────────

let audioModeSet = false;

async function ensureAudioMode(): Promise<void> {
  if (audioModeSet) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
    audioModeSet = true;
  } catch {
    // Non-fatal — audio will still play in most cases
  }
}

// ─── Playback status handler ────────────────────────────────

function onPlaybackStatusUpdate(status: AVPlaybackStatus): void {
  if (!status.isLoaded) return;

  const s = status as AVPlaybackStatusSuccess;
  const durationMs = s.durationMillis ?? 0;
  const positionMs = s.positionMillis ?? 0;
  const durationSec = durationMs / 1000;
  const elapsedSec = positionMs / 1000;

  state = {
    ...state,
    isPlaying: s.isPlaying,
    elapsed: elapsedSec,
    duration: durationSec,
    progress: durationSec > 0 ? elapsedSec / durationSec : 0,
  };

  emitProgress();

  // Track finished
  if (s.didJustFinish) {
    state = { ...state, isPlaying: false };
    emitProgress();
    trackEndListeners.forEach((fn) => fn());
  }
}

function emitProgress(): void {
  const snapshot = { ...state };
  progressListeners.forEach((fn) => fn(snapshot));
}

// ─── Cleanup helper ─────────────────────────────────────────

async function unloadCurrent(): Promise<void> {
  if (sound) {
    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload errors
    }
    sound = null;
  }
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Load a track by its preview URL and start playing.
 * If previewUrl is undefined, falls back to the old timer simulation
 * so mock data still "plays" (silently with a progress bar).
 */
export async function loadTrack(
  trackId: string,
  durationSec: number,
  previewUrl?: string
): Promise<void> {
  await ensureAudioMode();
  await unloadCurrent();

  state = {
    isPlaying: false,
    currentTrackId: trackId,
    elapsed: 0,
    duration: durationSec,
    progress: 0,
    isLoading: !!previewUrl, // loading only when streaming real audio
    error: null,
  };
  emitProgress();

  if (previewUrl) {
    // Real audio path with retry (up to 2 retries with backoff)
    const MAX_RETRIES = 2;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 500ms, 1000ms
          await new Promise((r) => setTimeout(r, 500 * attempt));
          // Check if track changed while waiting
          if (state.currentTrackId !== trackId) return;
        }
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: previewUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 250 },
          onPlaybackStatusUpdate
        );
        sound = newSound;
        state = { ...state, isPlaying: true, isLoading: false, error: null };
        emitProgress();
        return; // success — exit the function
      } catch (err) {
        lastErr = err;
        console.warn(`Audio load attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`, err);
      }
    }
    // All retries exhausted — fall through to timer simulation
    const msg = lastErr instanceof Error ? lastErr.message : 'Audio load failed';
    console.warn('Audio load failed after retries, using timer fallback');
    state = { ...state, isLoading: false, error: msg };
    emitProgress();
    startTimerFallback(trackId, durationSec);
  } else {
    // No preview URL — timer simulation for mock data
    startTimerFallback(trackId, durationSec);
  }
}

/** Toggle play/pause */
export async function togglePlayPause(): Promise<void> {
  if (sound) {
    const status = await sound.getStatusAsync();
    if (status.isLoaded && status.isPlaying) {
      await sound.pauseAsync();
    } else if (status.isLoaded) {
      await sound.playAsync();
    }
  } else if (timerFallbackId) {
    // Timer fallback toggle
    state = { ...state, isPlaying: !state.isPlaying };
    if (state.isPlaying) {
      resumeTimerFallback();
    } else {
      pauseTimerFallback();
    }
    emitProgress();
  }
}

/** Pause playback */
export async function pause(): Promise<void> {
  if (sound) {
    await sound.pauseAsync();
  } else {
    pauseTimerFallback();
    state = { ...state, isPlaying: false };
    emitProgress();
  }
}

/** Resume playback */
export async function play(): Promise<void> {
  if (sound) {
    await sound.playAsync();
  } else {
    state = { ...state, isPlaying: true };
    resumeTimerFallback();
    emitProgress();
  }
}

/** Seek to a specific position (0..1) */
export async function seekTo(fraction: number): Promise<void> {
  const clamped = Math.max(0, Math.min(1, fraction));

  if (sound) {
    const posMs = clamped * state.duration * 1000;
    await sound.setPositionAsync(posMs);
  }

  state = {
    ...state,
    elapsed: clamped * state.duration,
    progress: clamped,
  };
  emitProgress();
}

/** Get current state snapshot */
export function getState(): PlaybackState {
  return { ...state };
}

/** Stop and reset */
export async function stop(): Promise<void> {
  await unloadCurrent();
  stopTimerFallback();

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

/** Format seconds → "M:SS" */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Timer Fallback (for mock data with no preview URL) ─────

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

export default {
  loadTrack, togglePlayPause, pause, play, seekTo,
  getState, stop, onProgress, onTrackEnd, formatTime,
};
