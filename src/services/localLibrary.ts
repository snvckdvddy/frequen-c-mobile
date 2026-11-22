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
import type { QueueTrack, Track } from '../types';
import { logger } from '../utils/logger';
import { decodeBase64, id3TagLength, parseId3v2, type Id3Tags } from './id3';

const STORAGE_KEY = 'frequenc_local_library_v1';
const LOCAL_DIR = `${FileSystem.documentDirectory}local-library/`;

/** Bytes needed to learn how long the ID3v2 tag is (its fixed header). */
const ID3_HEADER_BYTES = 10;
/**
 * Most of a tag that is read. Title, artist and album are small and sit ahead
 * of any cover art, so a tag bigger than this is read up to this point only.
 */
const MAX_TAG_READ_BYTES = 512 * 1024;
/** Tag text becomes a queue track other phones see; keep a hostile tag from bloating it. */
const MAX_TAG_TEXT_CHARS = 200;

export interface LocalTrackRecord {
  id: string;          // local_<ts>_<rand>
  uri: string;         // file:// inside the app document directory
  filename: string;    // original picker filename
  title: string;       // ID3 title; the filename cleaned for display when the file has none
  artist?: string;     // ID3 artist; absent without a tag and on records saved before tags were read
  album?: string;      // ID3 album
  durationSec: number; // probed via expo-av at import; 0 = unknown
  addedAt: string;
  /** The file's tag has been read (found or not), so the backfill does not look again. */
  tagsChecked?: boolean;
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

type LibraryListener = (library: LocalTrackRecord[]) => void;
const libraryListeners = new Set<LibraryListener>();

/**
 * Run `listener` with the new list whenever an import, a removal or the tag
 * backfill changes the library. Every mounted view of it (the Library tab
 * stays mounted while the room sheet opens over it) shows the same files.
 * Returns the unsubscribe function.
 */
export function subscribeToLocalLibrary(listener: LibraryListener): () => void {
  libraryListeners.add(listener);
  return () => {
    libraryListeners.delete(listener);
  };
}

/** Tell subscribers about a library that has just been saved. A listener that throws never fails the write. */
function announceLibrary(library: LocalTrackRecord[]): void {
  libraryListeners.forEach((listener) => {
    try {
      listener(library);
    } catch (err) {
      logger.warn('localLibrary', 'A library listener threw', err);
    }
  });
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

function clipTagText(value: string | undefined): string | undefined {
  return value ? value.slice(0, MAX_TAG_TEXT_CHARS) : undefined;
}

async function readByteRange(uri: string, position: number, length: number): Promise<Uint8Array> {
  // expo-file-system only honours position/length together with base64.
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position,
    length,
  });
  return decodeBase64(base64);
}

/**
 * Title, artist and album from the file's ID3v2 tag. Reads the 10-byte header
 * to learn the tag size, then only that many bytes (capped), never the audio.
 * Never throws: a file without a readable tag gives {} and the caller falls
 * back to the filename.
 */
export async function readLocalTags(uri: string): Promise<Id3Tags> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.size < ID3_HEADER_BYTES) return {};
    const tagLength = id3TagLength(await readByteRange(uri, 0, ID3_HEADER_BYTES));
    if (tagLength === 0) return {};
    const length = Math.min(tagLength, MAX_TAG_READ_BYTES, info.size);
    const tags = parseId3v2(await readByteRange(uri, 0, length));
    return {
      title: clipTagText(tags.title),
      artist: clipTagText(tags.artist),
      album: clipTagText(tags.album),
    };
  } catch (err) {
    logger.warn('localLibrary', 'Could not read ID3 tag (filename used instead)', err);
    return {};
  }
}

// Import, remove and the tag backfill each read the list, change it and write
// it back. Running them one at a time keeps a slow import from overwriting a
// removal (or the other way round).
let libraryWrites: Promise<unknown> = Promise.resolve();

function withLibraryLock<T>(task: () => Promise<T>): Promise<T> {
  const run = libraryWrites.then(task, task);
  libraryWrites = run.catch(() => undefined);
  return run;
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

  const assets = result.assets;
  await ensureDir();

  return withLibraryLock(async () => {
    const library = await listLocalTracks();

    for (const asset of assets) {
      try {
        const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const ext = (asset.name?.split('.').pop() || 'mp3').toLowerCase();
        const dest = `${LOCAL_DIR}${id}.${ext}`;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        const durationSec = await probeDurationSec(dest);
        const tags = await readLocalTags(dest);
        library.push({
          id,
          uri: dest,
          filename: asset.name || id,
          title: tags.title || titleFromFilename(asset.name || id),
          artist: tags.artist,
          album: tags.album,
          durationSec,
          addedAt: new Date().toISOString(),
          tagsChecked: true,
        });
      } catch (err) {
        logger.warn('localLibrary', `Import failed for ${asset.name}`, err);
      }
    }

    await persist(library);
    announceLibrary(library);
    return library;
  });
}

/**
 * Read the tag of every record that has not been checked yet (files imported
 * before tags were read) and fill in title, artist and album. Each file is
 * looked at once; a file with no tag keeps its filename title. Returns the
 * updated library and never throws.
 */
export function backfillLocalTags(): Promise<LocalTrackRecord[]> {
  return withLibraryLock(async () => {
    const library = await listLocalTracks();
    const pending = library.filter((rec) => !rec.tagsChecked);
    if (pending.length === 0) return library;

    for (const rec of pending) {
      const tags = await readLocalTags(rec.uri);
      rec.tagsChecked = true;
      if (tags.title) rec.title = tags.title;
      if (tags.artist) rec.artist = tags.artist;
      if (tags.album) rec.album = tags.album;
    }

    try {
      await persist(library);
    } catch (err) {
      logger.warn('localLibrary', 'Could not save tags read from existing files', err);
    }
    announceLibrary(library);
    return library;
  });
}

/** Delete the copied file and drop the record. Returns the updated library. */
export function removeLocalTrack(id: string): Promise<LocalTrackRecord[]> {
  return withLibraryLock(async () => {
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
    announceLibrary(next);
    return next;
  });
}

/** Shape a library record as a queueable Track. */
export function localRecordToTrack(rec: LocalTrackRecord): Track {
  return {
    id: rec.id,
    title: rec.title,
    artist: rec.artist || 'Local file',
    album: rec.album,
    duration: rec.durationSec || 30,
    source: 'local',
    sourceId: rec.id,
    previewUrl: rec.uri,
  };
}

/**
 * Local files exist on THIS phone and play from the room's output device, so
 * only the host can queue them. One rule for every surface that offers local
 * files (the Library tab and the in-room add-track sheet), so they cannot
 * drift apart.
 */
export function canQueueLocalFiles(input: {
  hasActiveSession: boolean;
  hostId: string | undefined;
  userId: string | undefined;
}): boolean {
  return input.hasActiveSession && !!input.userId && input.hostId === input.userId;
}

/**
 * The row sent to the server when a local file is queued: the track, who
 * added it, and an empty vote state. Both queue surfaces build it here and
 * hand it to the same addToQueue call.
 */
export function localRecordToQueueTrack(
  rec: LocalTrackRecord,
  user: { id: string; username: string },
  now: Date = new Date(),
): QueueTrack {
  return {
    ...localRecordToTrack(rec),
    addedBy: { userId: user.id, username: user.username },
    addedById: user.id,
    addedAt: now.toISOString(),
    votes: 0,
    voltageBoost: 0,
    reactions: [],
  };
}

/** m:ss for a track length in seconds; a file whose length is unknown reads --:--. */
export function formatLocalDuration(sec: number): string {
  if (!sec) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "Artist · m:ss" for a list row; just the length when the file has no artist tag. */
export function describeLocalFile(rec: LocalTrackRecord): string {
  const length = formatLocalDuration(rec.durationSec);
  return rec.artist ? `${rec.artist} · ${length}` : length;
}
