/**
 * frequenc-conductor — JS surface for conductor mode (lane 2).
 *
 * Android only. `Conductor` is null on iOS, in Expo Go, and on any APK built
 * before 1.2.0 (the native module ships in the binary, not in OTA updates),
 * so every caller must treat null as "conductor mode unavailable".
 */

import { NativeModule, requireOptionalNativeModule } from 'expo';

export interface NowPlaying {
  packageName: string;
  state: 'playing' | 'paused' | 'stopped' | 'buffering' | 'connecting' | 'skipping' | 'error' | 'none' | 'other';
  title: string | null;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
  positionMs: number | null;
  updatedAtMs: number;
}

type ConductorEvents = {
  onNowPlayingChange: (event: NowPlaying) => void;
};

declare class FrequencConductorNative extends NativeModule<ConductorEvents> {
  isNotificationAccessGranted(): boolean;
  openNotificationAccessSettings(): void;
  isPackageInstalled(packageName: string): boolean;
  startWatching(): boolean;
  stopWatching(): void;
  getNowPlaying(): NowPlaying[];
  playFromSearch(query: string, title: string | null, artist: string | null, packageName: string | null): Promise<boolean>;
  controllerPlayFromSearch(query: string, packageName: string): Promise<boolean>;
  controllerPlayFromUri(uri: string, packageName: string): Promise<boolean>;
  openUri(uri: string, packageName: string | null): Promise<boolean>;
  transport(action: 'play' | 'pause' | 'next' | 'previous', packageName: string | null): Promise<boolean>;
}

export const Conductor = requireOptionalNativeModule<FrequencConductorNative>('FrequencConductor');

/** Android package names of the music apps conductor mode can drive. */
export const MUSIC_APPS = {
  spotify: 'com.spotify.music',
  youtubeMusic: 'com.google.android.apps.youtube.music',
  appleMusic: 'com.apple.android.music',
  amazonMusic: 'com.amazon.mp3',
} as const;
