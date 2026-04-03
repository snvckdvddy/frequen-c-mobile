/**
 * ExpoAvBackend — Plays audio from direct URLs via expo-av Audio.Sound.
 *
 * Handles SoundCloud CDN URLs, Tidal CDN URLs, and any other source
 * that provides a direct audio stream URL. This is the fallback backend
 * when WebView SDK playback is not available.
 */

import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess } from 'expo-av';
import type {
  PlaybackBackend,
  PlaybackProgress,
  ProgressListener,
  TrackEndListener,
  TrackLoadRequest,
} from './PlaybackBackend';
import type { TrackSource } from '../../types';
import { logger } from '../../utils/logger';

const SAG_VOLUME = 0.75;
const SAG_RATE = 0.98;
const NORMAL_VOLUME = 1.0;
const NORMAL_RATE = 1.0;
const MAX_RETRIES = 2;

export class ExpoAvBackend implements PlaybackBackend {
  readonly name = 'ExpoAv';
  // CDN sources are fully supported with direct audio URLs.
  // SDK sources (spotify, appleMusic) are listed for fallback: PlaybackRouter
  // routes here when the WebView is unavailable. Playback is degraded —
  // only a 30-second preview URL (if present), not full-length SDK streaming.
  readonly supportedSources: ReadonlyArray<TrackSource> = [
    'soundcloud', 'tidal', 'itunes', 'youtube',
    'spotify', 'appleMusic', // fallback only — degraded without SDK
  ];

  private sound: Audio.Sound | null = null;
  private progress: PlaybackProgress = {
    isPlaying: false,
    elapsed: 0,
    duration: 0,
    progress: 0,
    isLoading: false,
    error: null,
  };
  private progressListeners: ProgressListener[] = [];
  private trackEndListeners: TrackEndListener[] = [];
  private voltageSag = false;
  private audioModeSet = false;
  private currentTrackId: string | null = null;

  isAvailable(): boolean {
    // expo-av is always available
    return true;
  }

  async load(request: TrackLoadRequest): Promise<void> {
    const { trackId, durationSec, previewUrl } = request;
    this.currentTrackId = trackId;

    await this.ensureAudioMode();
    await this.unloadCurrent();

    this.progress = {
      isPlaying: false,
      elapsed: 0,
      duration: durationSec,
      progress: 0,
      isLoading: !!previewUrl,
      error: null,
    };
    this.emit();

    if (!previewUrl) {
      this.progress = { ...this.progress, isLoading: false, error: 'No audio URL available' };
      this.emit();
      return;
    }

    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          if (this.currentTrackId !== trackId) return; // Track changed while waiting
        }
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: previewUrl },
          {
            shouldPlay: true,
            progressUpdateIntervalMillis: 250,
            volume: this.voltageSag ? SAG_VOLUME : NORMAL_VOLUME,
            rate: this.voltageSag ? SAG_RATE : NORMAL_RATE,
            shouldCorrectPitch: true,
          },
          (status) => this.onPlaybackStatus(status),
        );
        this.sound = newSound;
        this.progress = { ...this.progress, isPlaying: true, isLoading: false, error: null };
        this.emit();
        return;
      } catch (err) {
        lastErr = err;
        logger.warn('ExpoAv', `Load attempt ${attempt + 1}/${MAX_RETRIES + 1} failed`, err);
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : 'Audio load failed';
    this.progress = { ...this.progress, isLoading: false, error: msg };
    this.emit();
  }

  async pause(): Promise<void> {
    if (this.sound) await this.sound.pauseAsync();
  }

  async play(): Promise<void> {
    if (this.sound) await this.sound.playAsync();
  }

  async seek(fraction: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, fraction));
    if (this.sound) {
      await this.sound.setPositionAsync(clamped * this.progress.duration * 1000);
    }
    this.progress = {
      ...this.progress,
      elapsed: clamped * this.progress.duration,
      progress: clamped,
    };
    this.emit();
  }

  async stop(): Promise<void> {
    await this.unloadCurrent();
    this.currentTrackId = null;
    this.progress = {
      isPlaying: false, elapsed: 0, duration: 0, progress: 0, isLoading: false, error: null,
    };
    this.emit();
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
    this.voltageSag = active;
    if (this.sound) {
      try {
        await this.sound.setVolumeAsync(active ? SAG_VOLUME : NORMAL_VOLUME);
        await this.sound.setRateAsync(active ? SAG_RATE : NORMAL_RATE, true);
      } catch { /* non-fatal */ }
    }
  }

  // ─── Private ─────────────────────────────────────────────

  private onPlaybackStatus(status: AVPlaybackStatus): void {
    if (!status.isLoaded) return;
    const s = status as AVPlaybackStatusSuccess;
    const durationSec = (s.durationMillis ?? 0) / 1000;
    const elapsedSec = (s.positionMillis ?? 0) / 1000;

    this.progress = {
      ...this.progress,
      isPlaying: s.isPlaying,
      elapsed: elapsedSec,
      duration: durationSec,
      progress: durationSec > 0 ? elapsedSec / durationSec : 0,
    };
    this.emit();

    if (s.didJustFinish) {
      this.progress = { ...this.progress, isPlaying: false };
      this.emit();
      this.trackEndListeners.forEach((fn) => fn());
    }
  }

  private emit(): void {
    const snapshot = { ...this.progress };
    this.progressListeners.forEach((fn) => fn(snapshot));
  }

  private async unloadCurrent(): Promise<void> {
    if (this.sound) {
      try { await this.sound.unloadAsync(); } catch { /* ignore */ }
      this.sound = null;
    }
  }

  private async ensureAudioMode(): Promise<void> {
    if (this.audioModeSet) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      this.audioModeSet = true;
    } catch { /* non-fatal */ }
  }
}
