/**
 * Local Library — device audio files as a first-class source.
 *
 * Canon (playback_model.md): local files are the ONE source with native
 * full playback — expo-av on a file:// URI, no WebView, no DRM, no
 * platform terms. Files are COPIED into the app's document directory at
 * import (the picker's cache URI is evictable; a queued track must not
 * vanish under the player), and metadata lives in AsyncStorage.
 *
 * Playback path: 'local' is not in SDK_SOURCES, so PlaybackRouter
 * dispatches to ExpoAvBackend with previewUrl = the file URI. The
 * backend stores the URI in queue_tracks like any other preview URL and
 * never touches audio.
 *
 * Host-only for now: the file exists on the host's device, so only the
 * host can queue from here. Guests queueing THEIR local files requires
 * the auto-host-handoff design pass (known_debt follow-up #1).
 */

import * as DocumentPicker from 'expo-document-picker';
// SDK 54 defaults expo-file-system to the new File/Directory API; the
// legacy namespace keeps the stable functional API this module uses.
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import type { Track } from '../types';
import { logger } from '../utils/logger';

const STORAGE_KEY = 'frequenc_local_library_v1';
const LOCAL_DIR = `${FileSystem.documentDirectory}local-library/`;

export interface LocalTrackRecord {
  id: string;          // local_<ts>_<rand>
  uri: string;         // file:// inside the app document directory
  filename: string;    // original picker filename
  title: string;       // filename cleaned for display
  durationSec: number; // probed via expo-av at import; 0 = unknown
  addedAt: string;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LOCAL_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true });
  }
}

async function persist(list: LocalTrackRecord[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export async function listLocalTracks(): Promise<LocalTrackRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalTrackRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn('localLibrary', 'Failed to read library', err);
    return [];
  }
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || name;
}

/**
 * Probe duration by loading the file without playing it. Costs one
 * decode at import time; queued playback then has an honest duration
 * for the playhead instead of the 30-second fallback.
 */
async function probeDurationSec(uri: string): Promise<number> {
  try {
    const { sound, status } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false },
    );
    const dur =
      status.isLoaded && status.durationMillis
        ? Math.round(status.durationMillis / 1000)
        : 0;
    await sound.unloadAsync();
    return dur;
  } catch {
    return 0;
  }
}

/**
 * Open the system file picker (audio only, multi-select), copy the
 * chosen files into the app's document directory, and append them to
 * the library. Returns the updated library either way (cancel = no-op).
 */
export async function importLocalTracks(): Promise<LocalTrackRecord[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) {
    return listLocalTracks();
  }

  await ensureDir();
  const library = await listLocalTracks();

  for (const asset of result.assets) {
    try {
      const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const ext = (asset.name?.split('.').pop() || 'mp3').toLowerCase();
      const dest = `${LOCAL_DIR}${id}.${ext}`;
      await FileSystem.copyAsync({ from: asset.uri, to: dest });
      const durationSec = await probeDurationSec(dest);
      library.push({
        id,
        uri: dest,
        filename: asset.name || id,
        title: titleFromFilename(asset.name || id),
        durationSec,
        addedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.warn('localLibrary', `Import failed for ${asset.name}`, err);
    }
  }

  await persist(library);
  return library;
}

/** Delete the copied file and drop the record. Returns the updated library. */
export async function removeLocalTrack(id: string): Promise<LocalTrackRecord[]> {
  const library = await listLocalTracks();
  const target = library.find((t) => t.id === id);
  if (target) {
    try {
      await FileSystem.deleteAsync(target.uri, { idempotent: true });
    } catch (err) {
      logger.warn('localLibrary', 'File delete failed (record dropped anyway)', err);
    }
  }
  const next = library.filter((t) => t.id !== id);
  await persist(next);
  return next;
}

/** Shape a library record as a queueable Track. */
export function localRecordToTrack(rec: LocalTrackRecord): Track {
  return {
    id: rec.id,
    title: rec.title,
    artist: 'Local file',
    duration: rec.durationSec || 30,
    source: 'local',
    sourceId: rec.id,
    previewUrl: rec.uri,
  };
}
