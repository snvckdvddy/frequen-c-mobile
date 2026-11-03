/**
 * playbackEngine: unplayable-track wiring tests.
 *
 * The engine is the seam between the router (which hears the SoundCloud
 * Widget's verdict) and useHostPlaybackEngine (which skips). These tests
 * check the verdict makes it through, and that the key load line is logged
 * at info level so it shows up in release builds.
 *
 * The router and the adapter/API layers are mocked: this suite is about the
 * engine's own subscription and fan-out, not playback.
 */

import type { UnplayableEvent, UnplayableListener } from '../playback/PlaybackBackend';

const routerUnplayableListeners: UnplayableListener[] = [];

const mockPlaybackRouter = {
  onProgress: jest.fn(() => () => {}),
  onTrackEnd: jest.fn(() => () => {}),
  onUnplayable: jest.fn((listener: UnplayableListener) => {
    routerUnplayableListeners.push(listener);
    return () => {
      const idx = routerUnplayableListeners.indexOf(listener);
      if (idx >= 0) routerUnplayableListeners.splice(idx, 1);
    };
  }),
  load: jest.fn(async () => {}),
  stop: jest.fn(async () => {}),
  getProgress: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
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

const DEAD_TRACK: UnplayableEvent = {
  trackId: 'qt_1',
  source: 'soundcloud',
  sourceId: 'sc_1',
  reason: 'start-timeout',
};

/** A fresh engine module, so its router subscription state starts clean. */
function freshEngine(): typeof import('../playbackEngine') {
  let engine: typeof import('../playbackEngine') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    engine = require('../playbackEngine');
  });
  return engine as typeof import('../playbackEngine');
}

function fireRouterUnplayable(event: UnplayableEvent): void {
  [...routerUnplayableListeners].forEach((fn) => fn(event));
}

beforeEach(() => {
  jest.clearAllMocks();
  routerUnplayableListeners.length = 0;
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
});
