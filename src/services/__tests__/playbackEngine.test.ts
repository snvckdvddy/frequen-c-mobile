/**
 * playbackEngine: unplayable-track wiring, playback intent, and logging.
 *
 * The engine is the seam between the router (which hears the SoundCloud
 * Widget's verdict) and useHostPlaybackEngine (which skips). These tests
 * check the verdict makes it through, that the load line is logged at info
 * level so it shows up in release builds, and that each load tells the
 * backends whether the host actually wants playback (`autoplay`).
 *
 * That last part keeps a restored room from losing its current track: cold
 * launch loads the track and waits for the host's tap (verified on device
 * 2026-11-02), so only a load the host asked for may start the dead-track
 * clock.
 *
 * The router and the adapter/API layers are mocked: this suite is about the
 * engine's own subscription, fan-out, and bookkeeping, not playback.
 */

import type {
  PlaybackProgress,
  ProgressListener,
  TrackLoadRequest,
  UnplayableEvent,
  UnplayableListener,
} from '../playback/PlaybackBackend';

const routerUnplayableListeners: UnplayableListener[] = [];
const routerProgressListeners: ProgressListener[] = [];

const IDLE_PROGRESS: PlaybackProgress = {
  isPlaying: false, elapsed: 0, duration: 0, progress: 0, isLoading: false, error: null,
};

const mockPlaybackRouter = {
  onProgress: jest.fn((listener: ProgressListener) => {
    routerProgressListeners.push(listener);
    return () => {
      const idx = routerProgressListeners.indexOf(listener);
      if (idx >= 0) routerProgressListeners.splice(idx, 1);
    };
  }),
  onTrackEnd: jest.fn(() => () => {}),
  onUnplayable: jest.fn((listener: UnplayableListener) => {
    routerUnplayableListeners.push(listener);
    return () => {
      const idx = routerUnplayableListeners.indexOf(listener);
      if (idx >= 0) routerUnplayableListeners.splice(idx, 1);
    };
  }),
  load: jest.fn(async (_request: TrackLoadRequest) => {}),
  stop: jest.fn(async () => {}),
  getProgress: jest.fn((): PlaybackProgress => IDLE_PROGRESS),
  play: jest.fn(async () => {}),
  pause: jest.fn(async () => {}),
  seek: jest.fn(),
  setVoltageSag: jest.fn(),
};

jest.mock('../playback/PlaybackRouter', () => ({
  playbackRouter: mockPlaybackRouter,
}));

// The engine imports these at module load; neither is used for SDK sources.
jest.mock('../adapters/musicServiceAdapter', () => ({
  getAdapterForSource: jest.fn(),
}));
jest.mock('../api', () => ({
  currentServices: {},
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from '../../utils/logger';

type Engine = typeof import('../playbackEngine');

const DEAD_TRACK: UnplayableEvent = {
  trackId: 'qt_1',
  source: 'soundcloud',
  sourceId: 'sc_1',
  reason: 'start-timeout',
};

/** A fresh engine module, so its router subscription and intent start clean. */
function freshEngine(): Engine {
  let engine: Engine | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    engine = require('../playbackEngine');
  });
  return engine as Engine;
}

function fireRouterUnplayable(event: UnplayableEvent): void {
  [...routerUnplayableListeners].forEach((fn) => fn(event));
}

/** What the backend would report: a progress snapshot for the engine to see. */
function fireRouterProgress(partial: Partial<PlaybackProgress>): void {
  [...routerProgressListeners].forEach((fn) => fn({ ...IDLE_PROGRESS, ...partial }));
}

/** The load request the router received most recently. */
function lastLoadRequest(): TrackLoadRequest {
  const calls = mockPlaybackRouter.load.mock.calls;
  return calls[calls.length - 1][0];
}

function loadSoundCloud(
  engine: Engine,
  id = 'qt_1',
  options?: Parameters<Engine['loadTrack']>[5],
): Promise<void> {
  return engine.loadTrack(id, 200, undefined, `sc_${id}`, 'soundcloud', options);
}

beforeEach(() => {
  jest.clearAllMocks();
  routerUnplayableListeners.length = 0;
  routerProgressListeners.length = 0;
  mockPlaybackRouter.getProgress.mockReturnValue(IDLE_PROGRESS);
});

describe('playbackEngine.onTrackUnplayable', () => {
  test('delivers the router\'s verdict to engine listeners after a track is loaded', async () => {
    const engine = freshEngine();
    const received: UnplayableEvent[] = [];
    engine.onTrackUnplayable((e) => received.push(e));

    await engine.loadTrack('qt_1', 200, undefined, 'sc_1', 'soundcloud');
    fireRouterUnplayable(DEAD_TRACK);

    expect(received).toEqual([DEAD_TRACK]);
  });

  test('fans out to every listener', async () => {
    const engine = freshEngine();
    const a = jest.fn();
    const b = jest.fn();
    engine.onTrackUnplayable(a);
    engine.onTrackUnplayable(b);

    await engine.loadTrack('qt_1', 200, undefined, 'sc_1', 'soundcloud');
    fireRouterUnplayable(DEAD_TRACK);

    expect(a).toHaveBeenCalledWith(DEAD_TRACK);
    expect(b).toHaveBeenCalledWith(DEAD_TRACK);
  });

  test('stops delivering after unsubscribe', async () => {
    const engine = freshEngine();
    const listener = jest.fn();
    const unsubscribe = engine.onTrackUnplayable(listener);

    await engine.loadTrack('qt_1', 200, undefined, 'sc_1', 'soundcloud');
    unsubscribe();
    fireRouterUnplayable(DEAD_TRACK);

    expect(listener).not.toHaveBeenCalled();
  });

  test('subscribes to the router once, however many tracks load', async () => {
    const engine = freshEngine();

    await engine.loadTrack('qt_1', 200, undefined, 'sc_1', 'soundcloud');
    await engine.loadTrack('qt_2', 200, undefined, 'sc_2', 'soundcloud');

    expect(mockPlaybackRouter.onUnplayable).toHaveBeenCalledTimes(1);
  });
});

describe('playbackEngine.loadTrack logging', () => {
  test('logs the track load at info level (visible in release builds)', async () => {
    const engine = freshEngine();

    await engine.loadTrack('qt_1', 200, undefined, 'sc_1', 'soundcloud');

    expect(logger.info).toHaveBeenCalledWith(
      'playback',
      'Load track',
      expect.objectContaining({ trackId: 'qt_1', source: 'soundcloud', sourceId: 'sc_1' }),
    );
  });

  test('says in the load line whether the host asked for playback', async () => {
    const engine = freshEngine();

    await loadSoundCloud(engine);
    await engine.play();
    await loadSoundCloud(engine, 'qt_2');

    const loadLines = (logger.info as jest.Mock).mock.calls.filter((call) => call[1] === 'Load track');
    expect(loadLines.map((call) => call[2].autoplay)).toEqual([false, true]);
  });
});

describe('playbackEngine playback intent (TrackLoadRequest.autoplay)', () => {
  test('a cold-launch load is a restore, not a request for playback', async () => {
    const engine = freshEngine();

    await loadSoundCloud(engine);

    expect(lastLoadRequest().autoplay).toBe(false);
  });

  test('after the host presses play, the next load is a request', async () => {
    const engine = freshEngine();
    await loadSoundCloud(engine);

    await engine.play();
    await loadSoundCloud(engine, 'qt_2');

    expect(lastLoadRequest().autoplay).toBe(true);
  });

  test('the play/pause button counts: toggling to play, then to pause', async () => {
    const engine = freshEngine();

    mockPlaybackRouter.getProgress.mockReturnValue({ ...IDLE_PROGRESS, isPlaying: false });
    await engine.togglePlayPause();
    expect(mockPlaybackRouter.play).toHaveBeenCalledTimes(1);
    await loadSoundCloud(engine);
    expect(lastLoadRequest().autoplay).toBe(true);

    mockPlaybackRouter.getProgress.mockReturnValue({ ...IDLE_PROGRESS, isPlaying: true });
    await engine.togglePlayPause();
    expect(mockPlaybackRouter.pause).toHaveBeenCalledTimes(1);
    await loadSoundCloud(engine, 'qt_2');
    expect(lastLoadRequest().autoplay).toBe(false);
  });

  test('a track change while the host is paused is not a request', async () => {
    const engine = freshEngine();
    await engine.play();
    await engine.pause();

    await loadSoundCloud(engine);

    expect(lastLoadRequest().autoplay).toBe(false);
  });

  test('audio that is really playing counts, even if nobody pressed play', async () => {
    // The bridge autoplays, so the first track of a fresh room can start on
    // its own. The track after it is an auto-advance and must be watched.
    const engine = freshEngine();
    await loadSoundCloud(engine);
    expect(lastLoadRequest().autoplay).toBe(false);

    fireRouterProgress({ isPlaying: true, elapsed: 1.2, duration: 200 });
    await loadSoundCloud(engine, 'qt_2');

    expect(lastLoadRequest().autoplay).toBe(true);
  });

  test('the optimistic playing-at-0:00 report does not count as audio', async () => {
    const engine = freshEngine();
    await loadSoundCloud(engine);

    fireRouterProgress({ isPlaying: true, elapsed: 0 });
    await loadSoundCloud(engine, 'qt_2');

    expect(lastLoadRequest().autoplay).toBe(false);
  });

  test('a progress report already in flight cannot undo an explicit pause', async () => {
    const engine = freshEngine();
    await loadSoundCloud(engine); // the engine only hears the router after a first load
    await engine.play();
    await engine.pause();

    fireRouterProgress({ isPlaying: true, elapsed: 35, duration: 200 });
    await loadSoundCloud(engine, 'qt_2');

    expect(lastLoadRequest().autoplay).toBe(false);
  });

  test('a new load ends the pause, so the next track\'s audio counts again', async () => {
    const engine = freshEngine();
    await engine.play();
    await engine.pause();
    await loadSoundCloud(engine); // paused: not a request, and it ends the pause

    fireRouterProgress({ isPlaying: true, elapsed: 2, duration: 200 });
    await loadSoundCloud(engine, 'qt_2');

    expect(lastLoadRequest().autoplay).toBe(true);
  });

  test('Retry asks for playback outright, and that sticks for later loads', async () => {
    const engine = freshEngine();

    await loadSoundCloud(engine, 'qt_1', { autoplay: true });
    expect(lastLoadRequest().autoplay).toBe(true);

    await loadSoundCloud(engine, 'qt_2');
    expect(lastLoadRequest().autoplay).toBe(true);
  });

  test('skipping while playing keeps the next track watched (stop leaves the intent alone)', async () => {
    const engine = freshEngine();
    await engine.play();

    await engine.stop();
    await loadSoundCloud(engine);

    expect(lastLoadRequest().autoplay).toBe(true);
  });

  test('resetting returns to a restore state (new session, hosting started or ended)', async () => {
    const engine = freshEngine();
    await engine.play();

    engine.resetPlaybackIntent();
    await loadSoundCloud(engine);

    expect(lastLoadRequest().autoplay).toBe(false);
  });

  test('reset also clears a pause, so real audio counts again afterwards', async () => {
    const engine = freshEngine();
    await loadSoundCloud(engine); // the engine only hears the router after a first load
    await engine.play();
    await engine.pause();

    engine.resetPlaybackIntent();
    fireRouterProgress({ isPlaying: true, elapsed: 3, duration: 200 });
    await loadSoundCloud(engine, 'qt_2');

    expect(lastLoadRequest().autoplay).toBe(true);
  });

  test('logs intent changes at info level, once per change', async () => {
    const engine = freshEngine();

    await engine.play();
    await engine.play();
    await engine.pause();

    const intentLines = (logger.info as jest.Mock).mock.calls
      .filter((call) => String(call[1]).startsWith('Playback intent'))
      .map((call) => call[1]);
    expect(intentLines).toEqual([
      'Playback intent idle -> wanted',
      'Playback intent wanted -> paused',
    ]);
  });
});
