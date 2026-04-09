/**
 * useIsrcCrossMatch — Playable-track resolver tests.
 *
 * These tests lock in the priority walk (Apple > SoundCloud > Tidal > iTunes),
 * the skip-early contracts (non-Spotify, missing title/artist), the failure
 * path (fetch throws → original track back), and the attribution contract
 * (`metadataSource: 'spotify'` on any resolved track).
 *
 * The hook transitively imports `fetchClient` (pulls in expo-device) and
 * `logger`, both of which must be mocked so ts-jest doesn't trip on the
 * Expo module transform. See `musicServiceAdapter.test.ts` for the same
 * pattern applied to the adapter routing layer.
 */

import type { Track } from '../../types';

// ─── Mock apiFetch ──────────────────────────────────────────
// jest.mock factories are hoisted above const declarations, so we can't
// reference a `const jest.fn()` directly inside the factory. The arrow
// wrapper defers access until the mock is actually invoked, by which point
// the const has been initialized.
const mockApiFetch = jest.fn();

jest.mock('../../services/fetchClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import AFTER mocks are set up so the module-under-test resolves the
// mocked `apiFetch` / `logger` instead of the real ones.
import { resolvePlayableTrack } from '../useIsrcCrossMatch';

// ─── Test fixtures ──────────────────────────────────────────
// Build a minimal valid Track for each test. `source` is required on the
// Track type, and the hook's skip-early contracts key off `source`,
// `title`, and `artist`, so these are the fields every fixture must carry.

function makeSpotifyTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'sp_1',
    title: 'Around the World',
    artist: 'Daft Punk',
    album: 'Homework',
    albumArt: 'https://spotify.cdn/art.jpg',
    duration: 429,
    source: 'spotify',
    sourceId: '0DiWol3AO6WpXZgp0goxAV',
    isrc: 'FRSCV0100213',
    ...overrides,
  };
}

function makeAppleMusicTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'am_1',
    title: 'Around the World',
    artist: 'Daft Punk',
    album: 'Homework',
    albumArt: 'https://apple.cdn/art.jpg',
    duration: 429,
    source: 'appleMusic',
    sourceId: '123456789',
    ...overrides,
  };
}

function makeSoundcloudTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'sc_1',
    title: 'Around the World',
    artist: 'Daft Punk',
    album: 'Homework',
    albumArt: 'https://soundcloud.cdn/art.jpg',
    duration: 429,
    source: 'soundcloud',
    sourceId: 'sc-987654',
    ...overrides,
  };
}

function makeTidalTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'td_1',
    title: 'Around the World',
    artist: 'Daft Punk',
    album: 'Homework',
    albumArt: 'https://tidal.cdn/art.jpg',
    duration: 429,
    source: 'tidal',
    sourceId: '222333444',
    ...overrides,
  };
}

function makeItunesTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'it_1',
    title: 'Around the World',
    artist: 'Daft Punk',
    album: 'Homework',
    albumArt: 'https://itunes.cdn/art.jpg',
    duration: 30, // iTunes is preview-only
    source: 'itunes',
    sourceId: '555666777',
    previewUrl: 'https://itunes.cdn/preview.m4a',
    ...overrides,
  };
}

describe('resolvePlayableTrack', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  // ─── Skip-early contracts ──────────────────────────────────

  describe('skip-early contracts', () => {
    it('returns non-Spotify track unchanged without calling the backend', async () => {
      const input = makeAppleMusicTrack();
      const out = await resolvePlayableTrack(input);
      expect(out).toBe(input); // reference equality — same object, no copy
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('returns SoundCloud track unchanged without calling the backend', async () => {
      const input = makeSoundcloudTrack();
      const out = await resolvePlayableTrack(input);
      expect(out).toBe(input);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('returns Tidal track unchanged without calling the backend', async () => {
      const input = makeTidalTrack();
      const out = await resolvePlayableTrack(input);
      expect(out).toBe(input);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('returns Spotify track unchanged when title is missing', async () => {
      const input = makeSpotifyTrack({ title: '' });
      const out = await resolvePlayableTrack(input);
      expect(out).toBe(input);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('returns Spotify track unchanged when artist is missing', async () => {
      const input = makeSpotifyTrack({ artist: '' });
      const out = await resolvePlayableTrack(input);
      expect(out).toBe(input);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  // ─── Priority walk (Apple > SoundCloud > Tidal > iTunes) ──

  describe('priority walk', () => {
    it('prefers Apple Music over all other providers', async () => {
      const apple = makeAppleMusicTrack();
      const sc = makeSoundcloudTrack();
      const td = makeTidalTrack();
      const it = makeItunesTrack();
      mockApiFetch.mockResolvedValueOnce({
        appleMusic: apple, soundcloud: sc, tidal: td, itunes: it,
      });

      const out = await resolvePlayableTrack(makeSpotifyTrack());

      expect(out.source).toBe('appleMusic');
      expect(out.sourceId).toBe(apple.sourceId);
    });

    it('falls through to SoundCloud when Apple Music is missing', async () => {
      const sc = makeSoundcloudTrack();
      const td = makeTidalTrack();
      mockApiFetch.mockResolvedValueOnce({
        soundcloud: sc, tidal: td, itunes: makeItunesTrack(),
      });

      const out = await resolvePlayableTrack(makeSpotifyTrack());

      expect(out.source).toBe('soundcloud');
      expect(out.sourceId).toBe(sc.sourceId);
    });

    it('falls through to Tidal when Apple Music + SoundCloud are missing', async () => {
      const td = makeTidalTrack();
      mockApiFetch.mockResolvedValueOnce({
        tidal: td, itunes: makeItunesTrack(),
      });

      const out = await resolvePlayableTrack(makeSpotifyTrack());

      expect(out.source).toBe('tidal');
      expect(out.sourceId).toBe(td.sourceId);
    });

    it('falls through to iTunes when only iTunes matched', async () => {
      const it = makeItunesTrack();
      mockApiFetch.mockResolvedValueOnce({ itunes: it });

      const out = await resolvePlayableTrack(makeSpotifyTrack());

      expect(out.source).toBe('itunes');
      expect(out.sourceId).toBe(it.sourceId);
      expect(out.previewUrl).toBe(it.previewUrl);
    });

    it('returns original Spotify track when the backend resolves nothing', async () => {
      mockApiFetch.mockResolvedValueOnce({});

      const input = makeSpotifyTrack();
      const out = await resolvePlayableTrack(input);

      expect(out).toBe(input); // unchanged — stays on the Tier 3 allowlist path
    });
  });

  // ─── Failure handling ──────────────────────────────────────

  describe('failure handling', () => {
    it('returns original track when the backend rejects (network down)', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      const input = makeSpotifyTrack();
      const out = await resolvePlayableTrack(input);

      expect(out).toBe(input);
    });

    it('returns original track when the backend returns a 5xx error', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('HTTP 503 Service Unavailable'));

      const input = makeSpotifyTrack();
      const out = await resolvePlayableTrack(input);

      expect(out).toBe(input);
    });
  });

  // ─── Attribution + bookkeeping carry-over ──────────────────

  describe('attribution and bookkeeping', () => {
    it('sets metadataSource = "spotify" on a resolved Apple Music track', async () => {
      mockApiFetch.mockResolvedValueOnce({ appleMusic: makeAppleMusicTrack() });

      const out = await resolvePlayableTrack(makeSpotifyTrack());

      expect(out.metadataSource).toBe('spotify');
    });

    it('carries original ISRC forward even if the resolved track lacks one', async () => {
      mockApiFetch.mockResolvedValueOnce({
        // iTunes search often drops ISRC even on exact fuzzy hits
        itunes: makeItunesTrack({ isrc: undefined }),
      });

      const input = makeSpotifyTrack({ isrc: 'FRSCV0100213' });
      const out = await resolvePlayableTrack(input);

      expect(out.isrc).toBe('FRSCV0100213');
      expect(out.source).toBe('itunes');
    });

    it('uses resolved track ISRC when the original Spotify track had none', async () => {
      mockApiFetch.mockResolvedValueOnce({
        appleMusic: makeAppleMusicTrack({ isrc: 'USSM12345678' }),
      });

      const input = makeSpotifyTrack({ isrc: undefined });
      const out = await resolvePlayableTrack(input);

      expect(out.isrc).toBe('USSM12345678');
    });

    it('preserves queue bookkeeping fields from the original track', async () => {
      mockApiFetch.mockResolvedValueOnce({ appleMusic: makeAppleMusicTrack() });

      const input = makeSpotifyTrack({
        addedBy: { userId: 'u_42', username: 'claude' },
        votes: 3,
        voltageBoost: 0.5,
        reactions: [{ userId: 'u_42', type: 'fire' }],
      });
      const out = await resolvePlayableTrack(input);

      expect(out.addedBy).toEqual({ userId: 'u_42', username: 'claude' });
      expect(out.votes).toBe(3);
      expect(out.voltageBoost).toBe(0.5);
      expect(out.reactions).toEqual([{ userId: 'u_42', type: 'fire' }]);
      // But the source DID upgrade
      expect(out.source).toBe('appleMusic');
    });
  });

  // ─── Request shape contract ────────────────────────────────

  describe('request shape', () => {
    it('POSTs to /match/resolve with isrc + title + artist in the body', async () => {
      mockApiFetch.mockResolvedValueOnce({});

      await resolvePlayableTrack(makeSpotifyTrack({
        isrc: 'FRSCV0100213',
        title: 'Around the World',
        artist: 'Daft Punk',
      }));

      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      const [path, options] = mockApiFetch.mock.calls[0] as [string, { method: string; body: string }];
      expect(path).toBe('/match/resolve');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        isrc: 'FRSCV0100213',
        title: 'Around the World',
        artist: 'Daft Punk',
      });
    });

    it('sends isrc as undefined when the original track has no ISRC', async () => {
      mockApiFetch.mockResolvedValueOnce({});

      await resolvePlayableTrack(makeSpotifyTrack({ isrc: undefined }));

      expect(mockApiFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockApiFetch.mock.calls[0] as [string, { body: string }];
      const body = JSON.parse(options.body) as { isrc?: string; title: string; artist: string };
      expect(body.isrc).toBeUndefined();
      expect(body.title).toBe('Around the World');
      expect(body.artist).toBe('Daft Punk');
    });
  });
});
