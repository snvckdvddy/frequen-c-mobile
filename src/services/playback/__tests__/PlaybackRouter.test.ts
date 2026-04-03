/**
 * PlaybackRouter — Routing & Credential Flow Tests
 *
 * Tests the core routing logic: backend selection by track source,
 * credential fetching for SDK sources, fallback behavior, and
 * listener forwarding. All external dependencies are mocked.
 */

import type {
  PlaybackBackend,
  PlaybackProgress,
  TrackLoadRequest,
  ProgressListener,
  TrackEndListener,
} from '../PlaybackBackend';
import { SDK_SOURCES } from '../PlaybackBackend';
import type { TrackSource } from '../../../types';

// ─── Mock Backends ─────────────────────────────────────────
// Lightweight PlaybackBackend implementations for testing routing logic.

function createMockBackend(name: string, sources: TrackSource[], available = true): PlaybackBackend & {
  lastLoadRequest: TrackLoadRequest | null;
  loadCount: number;
  progressListeners: ProgressListener[];
  trackEndListeners: TrackEndListener[];
  fireProgress: (p: PlaybackProgress) => void;
  fireTrackEnd: () => void;
  voltageSagCalls: boolean[];
} {
  const progressListeners: ProgressListener[] = [];
  const trackEndListeners: TrackEndListener[] = [];
  let lastLoadRequest: TrackLoadRequest | null = null;
  let loadCount = 0;
  const voltageSagCalls: boolean[] = [];

  const backend: PlaybackBackend & {
    lastLoadRequest: TrackLoadRequest | null;
    loadCount: number;
    progressListeners: ProgressListener[];
    trackEndListeners: TrackEndListener[];
    voltageSagCalls: boolean[];
    fireProgress: (p: PlaybackProgress) => void;
    fireTrackEnd: () => void;
  } = {
    name,
    supportedSources: sources,
    lastLoadRequest: null as TrackLoadRequest | null,
    loadCount: 0,
    progressListeners,
    trackEndListeners,
    voltageSagCalls,
    isAvailable: () => available,
    load: jest.fn(async (req: TrackLoadRequest) => {
      backend.lastLoadRequest = req;
      backend.loadCount++;
    }),
    pause: jest.fn(async () => {}),
    play: jest.fn(async () => {}),
    seek: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    getProgress: jest.fn((): PlaybackProgress => ({
      isPlaying: false, elapsed: 0, duration: 0, progress: 0,
      isLoading: false, error: null,
    })),
    onProgress: jest.fn((listener: ProgressListener) => {
      progressListeners.push(listener);
      return () => {
        const idx = progressListeners.indexOf(listener);
        if (idx >= 0) progressListeners.splice(idx, 1);
      };
    }),
    onTrackEnd: jest.fn((listener: TrackEndListener) => {
      trackEndListeners.push(listener);
      return () => {
        const idx = trackEndListeners.indexOf(listener);
        if (idx >= 0) trackEndListeners.splice(idx, 1);
      };
    }),
    setVoltageSag: jest.fn(async (active: boolean) => {
      voltageSagCalls.push(active);
    }),
    fireProgress: (p: PlaybackProgress) => {
      progressListeners.forEach((fn) => fn(p));
    },
    fireTrackEnd: () => {
      trackEndListeners.forEach((fn) => fn());
    },
  };
  return backend;
}

// ─── Mock apiFetch ─────────────────────────────────────────

const mockApiFetch = jest.fn();

// ─── Mock module imports ───────────────────────────────────
// We mock the actual module dependencies so PlaybackRouter uses our fakes.

const mockExpoAv = createMockBackend('MockExpoAv', [
  'soundcloud', 'tidal', 'itunes', 'youtube', 'spotify', 'appleMusic',
]);
const mockWebViewSDK = createMockBackend('MockWebViewSDK', ['spotify', 'appleMusic'], true);

jest.mock('../ExpoAvBackend', () => ({
  ExpoAvBackend: jest.fn().mockImplementation(() => mockExpoAv),
}));

jest.mock('../WebViewBridge', () => ({
  webViewSDKBackend: mockWebViewSDK,
}));

jest.mock('../../fetchClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import AFTER mocks are set up
import { PlaybackRouter } from '../PlaybackRouter';

// ─── Test Helpers ──────────────────────────────────────────

function makeRequest(source: TrackSource, overrides: Partial<TrackLoadRequest> = {}): TrackLoadRequest {
  return {
    trackId: `qt_test_${source}`,
    sourceId: `${source}_track_123`,
    source,
    durationSec: 240,
    previewUrl: `https://cdn.example.com/preview/${source}.mp3`,
    ...overrides,
  };
}

const SPOTIFY_CREDS = {
  source: 'spotify',
  sourceId: 'spotify_track_123',
  accessCredential: 'sp_fresh_token_abc',
  queuerId: 'user_queuer_01',
};

const APPLE_CREDS = {
  source: 'appleMusic',
  sourceId: 'apple_song_456',
  musicUserCredential: 'mut_abc123',
  developerCredential: 'eyJdev.token',
  queuerId: 'user_queuer_02',
};

// ─── Tests ─────────────────────────────────────────────────

describe('SDK_SOURCES constant', () => {
  test('contains exactly spotify and appleMusic', () => {
    expect(SDK_SOURCES.has('spotify')).toBe(true);
    expect(SDK_SOURCES.has('appleMusic')).toBe(true);
    expect(SDK_SOURCES.size).toBe(2);
  });

  test('does not contain CDN-backed sources', () => {
    expect(SDK_SOURCES.has('soundcloud')).toBe(false);
    expect(SDK_SOURCES.has('tidal')).toBe(false);
    expect(SDK_SOURCES.has('itunes')).toBe(false);
    expect(SDK_SOURCES.has('youtube')).toBe(false);
  });
});

describe('PlaybackRouter', () => {
  let router: PlaybackRouter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockExpoAv.loadCount = 0;
    mockExpoAv.lastLoadRequest = null;
    mockExpoAv.voltageSagCalls.length = 0;
    mockWebViewSDK.loadCount = 0;
    mockWebViewSDK.lastLoadRequest = null;
    mockWebViewSDK.voltageSagCalls.length = 0;
    mockApiFetch.mockReset();
    router = new PlaybackRouter();
  });

  // ─── Backend Selection ─────────────────────────────────

  describe('backend selection', () => {
    test('routes spotify to WebViewSDK when available', async () => {
      mockApiFetch.mockResolvedValue(SPOTIFY_CREDS);
      await router.load(makeRequest('spotify'));
      expect(mockWebViewSDK.load).toHaveBeenCalled();
      expect(mockExpoAv.load).not.toHaveBeenCalled();
    });

    test('routes appleMusic to WebViewSDK when available', async () => {
      mockApiFetch.mockResolvedValue(APPLE_CREDS);
      await router.load(makeRequest('appleMusic'));
      expect(mockWebViewSDK.load).toHaveBeenCalled();
      expect(mockExpoAv.load).not.toHaveBeenCalled();
    });

    const cdnSources: TrackSource[] = ['soundcloud', 'tidal', 'itunes', 'youtube'];
    test.each(cdnSources)('routes %s to ExpoAv', async (source) => {
      await router.load(makeRequest(source));
      expect(mockExpoAv.load).toHaveBeenCalled();
      expect(mockWebViewSDK.load).not.toHaveBeenCalled();
    });

    test('does NOT fetch credentials for CDN sources', async () => {
      await router.load(makeRequest('soundcloud'));
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  // ─── Credential Fetching ───────────────────────────────

  describe('credential fetching', () => {
    test('fetches credentials for spotify tracks', async () => {
      mockApiFetch.mockResolvedValue(SPOTIFY_CREDS);
      await router.load(makeRequest('spotify'));
      expect(mockApiFetch).toHaveBeenCalledWith('/playback/credentials/qt_test_spotify');
    });

    test('fetches credentials for appleMusic tracks', async () => {
      mockApiFetch.mockResolvedValue(APPLE_CREDS);
      await router.load(makeRequest('appleMusic'));
      expect(mockApiFetch).toHaveBeenCalledWith('/playback/credentials/qt_test_appleMusic');
    });

    test('injects credentials into load request for spotify', async () => {
      mockApiFetch.mockResolvedValue(SPOTIFY_CREDS);
      await router.load(makeRequest('spotify'));
      const loadArg = (mockWebViewSDK.load as jest.Mock).mock.calls[0][0] as TrackLoadRequest;
      expect(loadArg.accessCredential).toBe('sp_fresh_token_abc');
    });

    test('injects developer + user credentials for appleMusic', async () => {
      mockApiFetch.mockResolvedValue(APPLE_CREDS);
      await router.load(makeRequest('appleMusic'));
      const loadArg = (mockWebViewSDK.load as jest.Mock).mock.calls[0][0] as TrackLoadRequest;
      expect(loadArg.musicUserCredential).toBe('mut_abc123');
      expect(loadArg.developerCredential).toBe('eyJdev.token');
    });
  });

  // ─── Fallback Behavior ─────────────────────────────────

  describe('fallback to ExpoAv', () => {
    test('falls back when credential fetch fails', async () => {
      mockApiFetch.mockRejectedValue(new Error('Network error'));
      await router.load(makeRequest('spotify'));
      expect(mockExpoAv.load).toHaveBeenCalled();
      expect(mockWebViewSDK.load).not.toHaveBeenCalled();
    });

    test('falls back when credential fetch returns 401', async () => {
      mockApiFetch.mockRejectedValue({ status: 401, message: 'Unauthorized' });
      await router.load(makeRequest('appleMusic'));
      expect(mockExpoAv.load).toHaveBeenCalled();
      expect(mockWebViewSDK.load).not.toHaveBeenCalled();
    });
  });

  // ─── Transport Delegation ──────────────────────────────

  describe('transport controls', () => {
    test('delegates pause to active backend', async () => {
      await router.load(makeRequest('soundcloud'));
      await router.pause();
      expect(mockExpoAv.pause).toHaveBeenCalled();
    });

    test('delegates play to active backend', async () => {
      await router.load(makeRequest('soundcloud'));
      await router.play();
      expect(mockExpoAv.play).toHaveBeenCalled();
    });

    test('delegates seek to active backend', async () => {
      await router.load(makeRequest('soundcloud'));
      await router.seek(0.5);
      expect(mockExpoAv.seek).toHaveBeenCalledWith(0.5);
    });

    test('stop clears active backend', async () => {
      await router.load(makeRequest('soundcloud'));
      await router.stop();
      expect(mockExpoAv.stop).toHaveBeenCalled();
    });

    test('transport no-ops when no active backend', async () => {
      await router.pause();
      await router.play();
      await router.seek(0.5);
      // Should not throw
    });
  });

  // ─── Listener Forwarding ──────────────────────────────

  describe('listener forwarding', () => {
    test('forwards progress events from active backend', async () => {
      const received: PlaybackProgress[] = [];
      router.onProgress((p) => received.push(p));

      await router.load(makeRequest('soundcloud'));

      // Simulate progress from ExpoAv backend
      const fakeProgress: PlaybackProgress = {
        isPlaying: true, elapsed: 30, duration: 240,
        progress: 0.125, isLoading: false, error: null,
      };
      mockExpoAv.fireProgress(fakeProgress);

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(fakeProgress);
    });

    test('forwards trackEnd events from active backend', async () => {
      let endCount = 0;
      router.onTrackEnd(() => endCount++);

      await router.load(makeRequest('soundcloud'));
      mockExpoAv.fireTrackEnd();

      expect(endCount).toBe(1);
    });

    test('unsubscribe stops forwarding', async () => {
      const received: PlaybackProgress[] = [];
      const unsub = router.onProgress((p) => received.push(p));

      await router.load(makeRequest('soundcloud'));
      unsub();

      mockExpoAv.fireProgress({
        isPlaying: true, elapsed: 10, duration: 240,
        progress: 0.04, isLoading: false, error: null,
      });

      expect(received).toHaveLength(0);
    });

    test('detaches old backend listeners on new load', async () => {
      const received: PlaybackProgress[] = [];
      router.onProgress((p) => received.push(p));

      // Load first track (ExpoAv)
      await router.load(makeRequest('soundcloud'));

      // Load second track (also ExpoAv, but listeners should be re-attached)
      await router.load(makeRequest('tidal'));

      // Fire progress — should only receive once (not doubled)
      mockExpoAv.fireProgress({
        isPlaying: true, elapsed: 5, duration: 180,
        progress: 0.028, isLoading: false, error: null,
      });

      expect(received).toHaveLength(1);
    });
  });

  // ─── Voltage Sag ──────────────────────────────────────

  describe('voltage sag', () => {
    test('propagates to both backends', async () => {
      await router.setVoltageSag(true);
      expect(mockExpoAv.setVoltageSag).toHaveBeenCalledWith(true);
      expect(mockWebViewSDK.setVoltageSag).toHaveBeenCalledWith(true);
    });

    test('propagates disable to both backends', async () => {
      await router.setVoltageSag(false);
      expect(mockExpoAv.setVoltageSag).toHaveBeenCalledWith(false);
      expect(mockWebViewSDK.setVoltageSag).toHaveBeenCalledWith(false);
    });
  });

  // ─── Progress Snapshot ─────────────────────────────────

  describe('getProgress', () => {
    test('returns zero state when no backend active', () => {
      const p = router.getProgress();
      expect(p.isPlaying).toBe(false);
      expect(p.elapsed).toBe(0);
      expect(p.duration).toBe(0);
    });

    test('delegates to active backend', async () => {
      const expected: PlaybackProgress = {
        isPlaying: true, elapsed: 60, duration: 240,
        progress: 0.25, isLoading: false, error: null,
      };
      (mockExpoAv.getProgress as jest.Mock).mockReturnValue(expected);

      await router.load(makeRequest('soundcloud'));
      expect(router.getProgress()).toEqual(expected);
    });
  });
});
