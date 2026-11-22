/**
 * Local library import and tag backfill, against in-memory fakes for the
 * picker, the file system, AsyncStorage and the audio probe. The fake file
 * system answers expo-file-system's position/length reads from real bytes, so
 * the tag path runs end to end (header read, tag read, ID3 parse).
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const mockStore = new Map<string, string>();
const mockFiles = new Map<string, Uint8Array>();
const mockDirs = new Set<string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: async (key: string): Promise<string | null> => mockStore.get(key) ?? null,
    setItem: async (key: string, value: string): Promise<void> => {
      mockStore.set(key, value);
    },
    removeItem: async (key: string): Promise<void> => {
      mockStore.delete(key);
    },
  },
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: async () => ({
        sound: { unloadAsync: async () => undefined },
        status: { isLoaded: true, durationMillis: 4000 },
      }),
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///app/documents/',
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  getInfoAsync: async (uri: string) => {
    if (mockDirs.has(uri)) return { exists: true, isDirectory: true, uri };
    const bytes = mockFiles.get(uri);
    return bytes
      ? { exists: true, isDirectory: false, uri, size: bytes.length }
      : { exists: false, isDirectory: false, uri };
  },
  makeDirectoryAsync: async (uri: string) => {
    mockDirs.add(uri);
  },
  copyAsync: async ({ from, to }: { from: string; to: string }) => {
    const bytes = mockFiles.get(from);
    if (!bytes) throw new Error(`no such file: ${from}`);
    mockFiles.set(to, bytes);
  },
  deleteAsync: async (uri: string) => {
    mockFiles.delete(uri);
  },
  readAsStringAsync: jest.fn(),
}));

import {
  backfillLocalTags,
  canQueueLocalFiles,
  describeLocalFile,
  formatLocalDuration,
  importLocalTracks,
  listLocalTracks,
  localRecordToQueueTrack,
  localRecordToTrack,
  readLocalTags,
  removeLocalTrack,
  subscribeToLocalLibrary,
  type LocalTrackRecord,
} from '../localLibrary';

const STORAGE_KEY = 'frequenc_local_library_v1';
const MAX_TAG_READ_BYTES = 512 * 1024;

// ─── Fixtures ────────────────────────────────────────────────

function syncsafe(value: number): number[] {
  return [(value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f];
}

function textFrame(id: string, text: string): number[] {
  const body = [0, ...Array.from(text).map((ch) => ch.charCodeAt(0))];
  const size = [(body.length >>> 24) & 0xff, (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff];
  return [...Array.from(id).map((ch) => ch.charCodeAt(0)), ...size, 0, 0, ...body];
}

/** An ID3v2.3 tag (ISO-8859-1 text) followed by stand-in audio bytes. */
function mp3WithTag(tags: { title?: string; artist?: string; album?: string }, audioBytes = 4000): Uint8Array {
  const frames = [
    ...(tags.title ? textFrame('TIT2', tags.title) : []),
    ...(tags.artist ? textFrame('TPE1', tags.artist) : []),
    ...(tags.album ? textFrame('TALB', tags.album) : []),
  ];
  const header = [0x49, 0x44, 0x33, 3, 0, 0, ...syncsafe(frames.length)];
  return Uint8Array.from([...header, ...frames, ...new Array<number>(audioBytes).fill(0xaa)]);
}

function untaggedMp3(): Uint8Array {
  return Uint8Array.from([0xff, 0xfb, 0x90, 0x00, ...new Array<number>(4000).fill(0x55)]);
}

function record(overrides: Partial<LocalTrackRecord> & Pick<LocalTrackRecord, 'id' | 'uri' | 'title'>): LocalTrackRecord {
  return {
    filename: `${overrides.id}.mp3`,
    durationSec: 4,
    addedAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  };
}

function pickerReturns(...names: string[]): void {
  jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({
    canceled: false,
    assets: names.map((name) => ({ uri: `file:///cache/${name}`, name, lastModified: 0 })),
  });
}

function storedLibrary(): LocalTrackRecord[] {
  return JSON.parse(mockStore.get(STORAGE_KEY) ?? '[]') as LocalTrackRecord[];
}

const readAsString = jest.mocked(FileSystem.readAsStringAsync);

beforeEach(() => {
  mockStore.clear();
  mockFiles.clear();
  mockDirs.clear();
  readAsString.mockReset();
  readAsString.mockImplementation(async (uri, options) => {
    const bytes = mockFiles.get(uri);
    if (!bytes) throw new Error(`no such file: ${uri}`);
    const start = options?.position ?? 0;
    const end = options?.length === undefined ? bytes.length : start + options.length;
    return Buffer.from(bytes.subarray(start, end)).toString('base64');
  });
});

// ─── Import ──────────────────────────────────────────────────

describe('importLocalTracks', () => {
  it('uses the ID3 title and artist instead of the filename', async () => {
    mockFiles.set('file:///cache/gatea_tone_one.mp3', mp3WithTag({
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
    }));
    pickerReturns('gatea_tone_one.mp3');

    const library = await importLocalTracks();

    expect(library).toHaveLength(1);
    expect(library[0]).toMatchObject({
      filename: 'gatea_tone_one.mp3',
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
      durationSec: 4,
      tagsChecked: true,
    });
    expect(storedLibrary()).toEqual(library);
  });

  it('falls back to the cleaned filename when the file has no tag', async () => {
    mockFiles.set('file:///cache/gatea_tone-one.mp3', untaggedMp3());
    pickerReturns('gatea_tone-one.mp3');

    const [rec] = await importLocalTracks();

    expect(rec.title).toBe('gatea tone one');
    expect(rec.artist).toBeUndefined();
    expect(rec.album).toBeUndefined();
    expect(rec.tagsChecked).toBe(true);
  });

  it('takes the artist from the tag but the title from the filename when TIT2 is missing', async () => {
    mockFiles.set('file:///cache/no_title.mp3', mp3WithTag({ artist: 'Someone' }));
    pickerReturns('no_title.mp3');

    const [rec] = await importLocalTracks();

    expect(rec.title).toBe('no title');
    expect(rec.artist).toBe('Someone');
  });

  it('still imports the file, with its filename, when the tag cannot be read', async () => {
    mockFiles.set('file:///cache/broken.mp3', mp3WithTag({ title: 'Never read' }));
    pickerReturns('broken.mp3');
    readAsString.mockRejectedValue(new Error('read failed'));

    const [rec] = await importLocalTracks();

    expect(rec.title).toBe('broken');
    expect(rec.uri).toMatch(/^file:\/\/\/app\/documents\/local-library\/local_.+\.mp3$/);
  });

  it('reads the tag header and the tag only, never the audio that follows', async () => {
    const bytes = mp3WithTag({ title: 'Small tag' }, 100_000);
    mockFiles.set('file:///cache/big_audio.mp3', bytes);
    pickerReturns('big_audio.mp3');

    await importLocalTracks();

    const tagLength = 10 + (textFrame('TIT2', 'Small tag').length);
    expect(readAsString.mock.calls.map(([, options]) => [options?.position, options?.length])).toEqual([
      [0, 10],
      [0, tagLength],
    ]);
    expect(readAsString.mock.calls.every(([, options]) => options?.encoding === 'base64')).toBe(true);
  });

  it('keeps the existing library and reads nothing when the picker is cancelled', async () => {
    mockStore.set(STORAGE_KEY, JSON.stringify([record({ id: 'local_old', uri: 'file:///x.mp3', title: 'Old' })]));
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });

    const library = await importLocalTracks();

    expect(library.map((r) => r.id)).toEqual(['local_old']);
    expect(readAsString).not.toHaveBeenCalled();
  });

  it('appends to what is already in the library', async () => {
    mockStore.set(STORAGE_KEY, JSON.stringify([record({ id: 'local_old', uri: 'file:///x.mp3', title: 'Old' })]));
    mockFiles.set('file:///cache/new.mp3', mp3WithTag({ title: 'New One' }));
    pickerReturns('new.mp3');

    const library = await importLocalTracks();

    expect(library.map((r) => r.title)).toEqual(['Old', 'New One']);
  });
});

// ─── readLocalTags ───────────────────────────────────────────

describe('readLocalTags', () => {
  it('returns no tags for a file that does not exist', async () => {
    expect(await readLocalTags('file:///missing.mp3')).toEqual({});
  });

  it('returns no tags for a file shorter than an ID3 header', async () => {
    mockFiles.set('file:///tiny.mp3', Uint8Array.from([0x49, 0x44, 0x33]));
    expect(await readLocalTags('file:///tiny.mp3')).toEqual({});
    expect(readAsString).not.toHaveBeenCalled();
  });

  it('caps how much of an oversized tag it reads', async () => {
    const declared = 2 * 1024 * 1024;
    const frames = textFrame('TIT2', 'Early title');
    const bytes = new Uint8Array(10 + declared + 1000);
    bytes.set([0x49, 0x44, 0x33, 3, 0, 0, ...syncsafe(declared)], 0);
    bytes.set(frames, 10);
    mockFiles.set('file:///huge_tag.mp3', bytes);

    const tags = await readLocalTags('file:///huge_tag.mp3');

    expect(tags.title).toBe('Early title');
    expect(readAsString.mock.calls[1][1]?.length).toBe(MAX_TAG_READ_BYTES);
  });

  it('clips very long tag text', async () => {
    mockFiles.set('file:///long.mp3', mp3WithTag({ title: 'T'.repeat(500) }));
    const tags = await readLocalTags('file:///long.mp3');
    expect(tags.title).toHaveLength(200);
  });
});

// ─── Backfill ────────────────────────────────────────────────

describe('backfillLocalTags', () => {
  function seedLegacyLibrary(): void {
    mockFiles.set('file:///app/documents/local-library/a.mp3', mp3WithTag({
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
    }));
    mockFiles.set('file:///app/documents/local-library/b.mp3', untaggedMp3());
    mockStore.set(STORAGE_KEY, JSON.stringify([
      record({ id: 'a', uri: 'file:///app/documents/local-library/a.mp3', title: 'gatea tone one' }),
      record({ id: 'b', uri: 'file:///app/documents/local-library/b.mp3', title: 'plain file' }),
      record({ id: 'gone', uri: 'file:///app/documents/local-library/gone.mp3', title: 'deleted by the OS' }),
    ]));
  }

  it('fills in tags for records saved before tags were read and leaves the rest alone', async () => {
    seedLegacyLibrary();

    const library = await backfillLocalTags();

    expect(library.find((r) => r.id === 'a')).toMatchObject({
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
      tagsChecked: true,
    });
    expect(library.find((r) => r.id === 'b')).toMatchObject({ title: 'plain file', tagsChecked: true });
    expect(library.find((r) => r.id === 'b')?.artist).toBeUndefined();
    expect(library.find((r) => r.id === 'gone')).toMatchObject({ title: 'deleted by the OS', tagsChecked: true });
    expect(storedLibrary()).toEqual(library);
  });

  it('checks each file once', async () => {
    seedLegacyLibrary();

    await backfillLocalTags();
    const readsAfterFirst = readAsString.mock.calls.length;
    await backfillLocalTags();

    expect(readsAfterFirst).toBeGreaterThan(0);
    expect(readAsString.mock.calls.length).toBe(readsAfterFirst);
  });

  it('does not touch storage when nothing is pending', async () => {
    mockStore.set(STORAGE_KEY, JSON.stringify([
      record({ id: 'done', uri: 'file:///d.mp3', title: 'Done', tagsChecked: true }),
    ]));
    const before = mockStore.get(STORAGE_KEY);

    await backfillLocalTags();

    expect(mockStore.get(STORAGE_KEY)).toBe(before);
    expect(readAsString).not.toHaveBeenCalled();
  });

  it('finishes before a removal that was requested while it ran, so the removal is not undone', async () => {
    seedLegacyLibrary();
    let openGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const realRead = readAsString.getMockImplementation();
    readAsString.mockImplementation(async (uri, options) => {
      await gate; // hold the backfill mid-read
      return realRead ? realRead(uri, options) : '';
    });

    const backfill = backfillLocalTags();
    const removal = removeLocalTrack('b');
    openGate();
    await Promise.all([backfill, removal]);

    const stored = storedLibrary();
    expect(stored.map((r) => r.id)).toEqual(['a', 'gone']);
    expect(stored.find((r) => r.id === 'a')?.title).toBe('Gate A Tone One');
    expect(mockFiles.has('file:///app/documents/local-library/b.mp3')).toBe(false);
  });
});

// ─── Track shape ─────────────────────────────────────────────

describe('localRecordToTrack', () => {
  it('carries the tag artist and album into the queue track', () => {
    const track = localRecordToTrack(record({
      id: 'local_1',
      uri: 'file:///a.mp3',
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
    }));
    expect(track).toMatchObject({
      id: 'local_1',
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
      source: 'local',
      previewUrl: 'file:///a.mp3',
    });
  });

  it('labels a file without an artist tag as a local file', () => {
    const track = localRecordToTrack(record({ id: 'local_2', uri: 'file:///b.mp3', title: 'b' }));
    expect(track.artist).toBe('Local file');
    expect(track.album).toBeUndefined();
  });
});

// ─── Staying in sync across screens ──────────────────────────
// The Library tab stays mounted while the in-room add-track sheet opens over
// it, so a change made in one has to reach the other.

describe('subscribeToLocalLibrary', () => {
  const unsubscribers: Array<() => void> = [];

  function listen(): LocalTrackRecord[][] {
    const seen: LocalTrackRecord[][] = [];
    unsubscribers.push(subscribeToLocalLibrary((library) => seen.push(library)));
    return seen;
  }

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  });

  it('hands every subscriber the new library after an import', async () => {
    const first = listen();
    const second = listen();
    mockFiles.set('file:///cache/new.mp3', mp3WithTag({ title: 'New One' }));
    pickerReturns('new.mp3');

    const library = await importLocalTracks();

    expect(first).toEqual([library]);
    expect(second).toEqual([library]);
    expect(library.map((r) => r.title)).toEqual(['New One']);
  });

  it('says nothing when the picker is cancelled, since nothing changed', async () => {
    const seen = listen();
    jest.mocked(DocumentPicker.getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });

    await importLocalTracks();

    expect(seen).toEqual([]);
  });

  it('hands subscribers the library without the file after a removal', async () => {
    mockStore.set(STORAGE_KEY, JSON.stringify([
      record({ id: 'keep', uri: 'file:///keep.mp3', title: 'Keep', tagsChecked: true }),
      record({ id: 'drop', uri: 'file:///drop.mp3', title: 'Drop', tagsChecked: true }),
    ]));
    const seen = listen();

    await removeLocalTrack('drop');

    expect(seen).toHaveLength(1);
    expect(seen[0].map((r) => r.id)).toEqual(['keep']);
  });

  it('hands subscribers the tagged library after a backfill, and nothing when no file is pending', async () => {
    mockFiles.set('file:///app/documents/local-library/a.mp3', mp3WithTag({ title: 'Gate A Tone One', artist: 'Frequen-C Test' }));
    mockStore.set(STORAGE_KEY, JSON.stringify([
      record({ id: 'a', uri: 'file:///app/documents/local-library/a.mp3', title: 'gatea tone one' }),
    ]));
    const seen = listen();

    await backfillLocalTags();
    await backfillLocalTags();

    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toMatchObject({ title: 'Gate A Tone One', artist: 'Frequen-C Test', tagsChecked: true });
  });

  it('stops telling a subscriber once it has unsubscribed', async () => {
    const seen: LocalTrackRecord[][] = [];
    const unsubscribe = subscribeToLocalLibrary((library) => seen.push(library));
    unsubscribe();
    mockFiles.set('file:///cache/new.mp3', mp3WithTag({ title: 'New One' }));
    pickerReturns('new.mp3');

    await importLocalTracks();

    expect(seen).toEqual([]);
  });

  it('still finishes the import, and tells the other subscribers, when one throws', async () => {
    unsubscribers.push(subscribeToLocalLibrary(() => {
      throw new Error('listener broke');
    }));
    const seen = listen();
    mockFiles.set('file:///cache/new.mp3', mp3WithTag({ title: 'New One' }));
    pickerReturns('new.mp3');

    const library = await importLocalTracks();

    expect(library).toHaveLength(1);
    expect(storedLibrary()).toEqual(library);
    expect(seen).toEqual([library]);
  });
});

// ─── Queueing from a room ────────────────────────────────────
// The Library tab and the in-room add-track sheet both queue a local file; the
// rule for who may, and the row that goes to the server, come from here.

describe('canQueueLocalFiles', () => {
  it('lets the host of a live room queue local files', () => {
    expect(canQueueLocalFiles({ hasActiveSession: true, hostId: 'host', userId: 'host' })).toBe(true);
  });

  it('keeps a guest out, since the file would have to play from the host phone', () => {
    expect(canQueueLocalFiles({ hasActiveSession: true, hostId: 'host', userId: 'guest' })).toBe(false);
  });

  it('needs a live room, even for the user who hosted one', () => {
    expect(canQueueLocalFiles({ hasActiveSession: false, hostId: 'host', userId: 'host' })).toBe(false);
  });

  it('is false while the user or the host is not known yet', () => {
    expect(canQueueLocalFiles({ hasActiveSession: true, hostId: undefined, userId: undefined })).toBe(false);
    expect(canQueueLocalFiles({ hasActiveSession: true, hostId: 'host', userId: undefined })).toBe(false);
    expect(canQueueLocalFiles({ hasActiveSession: true, hostId: undefined, userId: 'host' })).toBe(false);
  });
});

describe('localRecordToQueueTrack', () => {
  const user = { id: 'user_1', username: 'caleb' };
  const rec = record({
    id: 'local_1',
    uri: 'file:///app/documents/local-library/local_1.mp3',
    title: 'Gate A Tone One',
    artist: 'Frequen-C Test',
    durationSec: 12,
  });

  it('is the local track plus who added it and an empty vote state', () => {
    const queued = localRecordToQueueTrack(rec, user, new Date('2026-11-22T12:00:00.000Z'));

    expect(queued).toEqual({
      ...localRecordToTrack(rec),
      addedBy: { userId: 'user_1', username: 'caleb' },
      addedById: 'user_1',
      addedAt: '2026-11-22T12:00:00.000Z',
      votes: 0,
      voltageBoost: 0,
      reactions: [],
    });
  });

  it('keeps what playback needs: the local source and the file URI', () => {
    const queued = localRecordToQueueTrack(rec, user);

    expect(queued.source).toBe('local');
    expect(queued.sourceId).toBe('local_1');
    expect(queued.previewUrl).toBe('file:///app/documents/local-library/local_1.mp3');
    expect(queued.duration).toBe(12);
  });

  it('stamps the add time from the clock when none is given', () => {
    const before = Date.now();
    const queued = localRecordToQueueTrack(rec, user);
    const stamped = Date.parse(queued.addedAt);

    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });
});

describe('formatLocalDuration', () => {
  it('reads minutes and zero-padded seconds', () => {
    expect(formatLocalDuration(5)).toBe('0:05');
    expect(formatLocalDuration(65)).toBe('1:05');
    expect(formatLocalDuration(600)).toBe('10:00');
  });

  it('reads --:-- for a file whose length is not known', () => {
    expect(formatLocalDuration(0)).toBe('--:--');
    expect(formatLocalDuration(Number.NaN)).toBe('--:--');
  });

  it('drops a fractional second instead of printing it', () => {
    expect(formatLocalDuration(65.7)).toBe('1:05');
  });
});

describe('describeLocalFile', () => {
  it('leads with the artist tag, then the length', () => {
    expect(describeLocalFile(record({ id: 'a', uri: 'file:///a.mp3', title: 'a', artist: 'Frequen-C Test', durationSec: 4 })))
      .toBe('Frequen-C Test · 0:04');
  });

  it('is just the length for a file with no artist tag', () => {
    expect(describeLocalFile(record({ id: 'b', uri: 'file:///b.mp3', title: 'b', durationSec: 245 }))).toBe('4:05');
  });

  it('keeps the artist when the length is unknown', () => {
    expect(describeLocalFile(record({ id: 'c', uri: 'file:///c.mp3', title: 'c', artist: 'Someone', durationSec: 0 })))
      .toBe('Someone · --:--');
  });
});

describe('listLocalTracks', () => {
  it('still reads records saved before artist and tag fields existed', async () => {
    mockStore.set(STORAGE_KEY, JSON.stringify([
      { id: 'old', uri: 'file:///o.mp3', filename: 'o.mp3', title: 'o', durationSec: 3, addedAt: '2026-01-01T00:00:00.000Z' },
    ]));
    const [rec] = await listLocalTracks();
    expect(rec.title).toBe('o');
    expect(rec.artist).toBeUndefined();
    expect(rec.tagsChecked).toBeUndefined();
  });
});
