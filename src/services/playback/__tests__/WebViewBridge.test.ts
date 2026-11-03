/**
 * WebViewSDKBackend: dead SoundCloud track detection tests.
 *
 * Some SoundCloud tracks (label releases, embed-restricted uploads) load in
 * the Widget but never play: the host sees 0:00, guests see HOST PAUSED, and
 * nothing errors. The backend watches each SoundCloud load and raises
 * onUnplayable when the Widget errors before the track starts, or when the
 * track hasn't produced real playback within SC_START_TIMEOUT_MS.
 *
 * Fake timers drive the watchdog; the bridge page is simulated by feeding
 * handleWebViewMessage the same JSON the real bridge posts.
 */

import type { TrackLoadRequest, UnplayableEvent } from '../PlaybackBackend';

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from '../../../utils/logger';
import { SC_START_TIMEOUT_MS, WebViewSDKBackend } from '../WebViewBridge';

// ─── Helpers ───────────────────────────────────────────────

function scRequest(overrides: Partial<TrackLoadRequest> = {}): TrackLoadRequest {
  return {
    trackId: 'qt_1',
    sourceId: '12345',
    source: 'soundcloud',
    durationSec: 200,
    ...overrides,
  };
}

/** A backend with a mounted WebView whose bridge page has reported ready. */
function makeBackend() {
  const backend = new WebViewSDKBackend();
  const posted: Array<Record<string, unknown>> = [];
  backend.registerWebView((message) => posted.push(JSON.parse(message)));
  const unplayable: UnplayableEvent[] = [];
  backend.onUnplayable((event) => unplayable.push(event));
  const bridge = (msg: Record<string, unknown>) => backend.handleWebViewMessage(JSON.stringify(msg));
  bridge({ type: 'ready' });
  return { backend, posted, unplayable, bridge };
}

describe('WebViewSDKBackend dead-track detection (SoundCloud)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ─── Start timeout ───────────────────────────────────────

  test('reports a track that never starts once the start window passes', async () => {
    const { backend, unplayable } = makeBackend();
    await backend.load(scRequest());

    jest.advanceTimersByTime(SC_START_TIMEOUT_MS - 1);
    expect(unplayable).toHaveLength(0);

    jest.advanceTimersByTime(1);
    expect(unplayable).toEqual([
      { trackId: 'qt_1', source: 'soundcloud', sourceId: '12345', reason: 'start-timeout' },
    ]);
  });

  test("the bridge's optimistic 'playing at 0:00' progress does not count as started", async () => {
    const { backend, unplayable, bridge } = makeBackend();
    await backend.load(scRequest());

    // What the real bridge posts for a track that never plays: an
    // optimistic playing/0 report at load, then paused/0 polling, plus a
    // stale position while paused.
    bridge({ type: 'progress', isPlaying: true, elapsed: 0, duration: 0 });
    bridge({ type: 'progress', isPlaying: false, elapsed: 0, duration: 0 });
    bridge({ type: 'progress', isPlaying: false, elapsed: 42, duration: 200 });

    jest.advanceTimersByTime(SC_START_TIMEOUT_MS);
    expect(unplayable).toHaveLength(1);
    expect(unplayable[0].reason).toBe('start-timeout');
  });

  test('real playback (playing, past 0:00) cancels the watch', async () => {
    const { backend, unplayable, bridge } = makeBackend();
    await backend.load(scRequest());

    bridge({ type: 'progress', isPlaying: true, elapsed: 0.4, duration: 200 });

    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 3);
    expect(unplayable).toHaveLength(0);
  });

  test('declaring a track unplayable clears the loading and playing state', async () => {
    const { backend, bridge } = makeBackend();
    await backend.load(scRequest());
    bridge({ type: 'progress', isPlaying: true, elapsed: 0, duration: 0 });

    jest.advanceTimersByTime(SC_START_TIMEOUT_MS);

    expect(backend.getProgress()).toMatchObject({ isPlaying: false, isLoading: false });
  });

  // ─── Widget error ────────────────────────────────────────

  test('an error before the track starts is reported immediately, once', async () => {
    const { backend, unplayable, bridge } = makeBackend();
    await backend.load(scRequest());

    bridge({ type: 'error', message: 'SoundCloud Widget reported an error' });
    expect(unplayable).toEqual([
      {
        trackId: 'qt_1',
        source: 'soundcloud',
        sourceId: '12345',
        reason: 'widget-error',
        message: 'SoundCloud Widget reported an error',
      },
    ]);

    // The Widget can repeat itself, and the start timer must not add a second verdict.
    bridge({ type: 'error', message: 'SoundCloud Widget reported an error' });
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);
    expect(unplayable).toHaveLength(1);
  });

  test('a skip-worthy error does not leave an error banner behind', async () => {
    // The old path put the message on progress.error, where the next 250ms
    // progress tick wiped it (the "no error shown" symptom). The verdict
    // goes through onUnplayable now, so progress.error stays clean.
    const { backend, bridge } = makeBackend();
    await backend.load(scRequest());

    bridge({ type: 'error', message: 'SoundCloud Widget reported an error' });

    expect(backend.getProgress().error).toBeNull();
  });

  test('an error after playback has started is surfaced but does not skip', async () => {
    const { backend, unplayable, bridge } = makeBackend();
    await backend.load(scRequest());
    bridge({ type: 'progress', isPlaying: true, elapsed: 3, duration: 200 });

    bridge({ type: 'error', message: 'mid-track hiccup' });

    expect(unplayable).toHaveLength(0);
    expect(backend.getProgress().error).toBe('mid-track hiccup');
  });

  // ─── Scope ───────────────────────────────────────────────

  test('does not watch non-SoundCloud sources', async () => {
    const { backend, unplayable, bridge } = makeBackend();
    await backend.load(scRequest({ source: 'spotify', sourceId: 'sp_1' }));

    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);
    expect(unplayable).toHaveLength(0);

    bridge({ type: 'error', message: 'Spotify Premium required' });
    expect(unplayable).toHaveLength(0);
    expect(backend.getProgress().error).toBe('Spotify Premium required');
  });

  // ─── Host intent and lifecycle ───────────────────────────

  test('pausing cancels the watch and playing again restarts it', async () => {
    const { backend, unplayable } = makeBackend();
    await backend.load(scRequest());

    await backend.pause();
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);
    expect(unplayable).toHaveLength(0);

    await backend.play();
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS - 1);
    expect(unplayable).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(unplayable).toHaveLength(1);
  });

  test('play on a track that already started does not restart the watch', async () => {
    const { backend, unplayable, bridge } = makeBackend();
    await backend.load(scRequest());
    bridge({ type: 'progress', isPlaying: true, elapsed: 5, duration: 200 });

    await backend.play();
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);

    expect(unplayable).toHaveLength(0);
  });

  test('a newer load supersedes the previous track\'s watch', async () => {
    const { backend, unplayable } = makeBackend();
    await backend.load(scRequest({ trackId: 'qt_A', sourceId: 'A' }));
    jest.advanceTimersByTime(8_000);

    await backend.load(scRequest({ trackId: 'qt_B', sourceId: 'B' }));
    // A's original deadline (12s after its load) passes with no verdict.
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS - 8_000);
    expect(unplayable).toHaveLength(0);

    // B gets its own full window.
    jest.advanceTimersByTime(8_000);
    expect(unplayable).toHaveLength(1);
    expect(unplayable[0]).toMatchObject({ trackId: 'qt_B', sourceId: 'B' });
  });

  test('stop cancels the watch', async () => {
    const { backend, unplayable } = makeBackend();
    await backend.load(scRequest());

    await backend.stop();
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);

    expect(unplayable).toHaveLength(0);
  });

  test('track end cancels the watch', async () => {
    const { backend, unplayable, bridge } = makeBackend();
    await backend.load(scRequest());

    bridge({ type: 'trackEnd' });
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);

    expect(unplayable).toHaveLength(0);
  });

  test('unmounting the WebView cancels the watch', async () => {
    const { backend, unplayable } = makeBackend();
    await backend.load(scRequest());

    backend.unregisterWebView();
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);

    expect(unplayable).toHaveLength(0);
  });

  test('the watch starts when the queued load is finally sent, not before', async () => {
    const backend = new WebViewSDKBackend();
    const unplayable: UnplayableEvent[] = [];
    backend.onUnplayable((event) => unplayable.push(event));
    backend.registerWebView(() => {});

    // Bridge page not ready yet: the load is only queued.
    await backend.load(scRequest());
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS * 2);
    expect(unplayable).toHaveLength(0);

    backend.handleWebViewMessage(JSON.stringify({ type: 'ready' }));
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS - 1);
    expect(unplayable).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(unplayable).toHaveLength(1);
  });

  test('stops notifying a listener that unsubscribed', async () => {
    const { backend } = makeBackend();
    const seen: UnplayableEvent[] = [];
    const unsubscribe = backend.onUnplayable((event) => seen.push(event));
    unsubscribe();

    await backend.load(scRequest());
    jest.advanceTimersByTime(SC_START_TIMEOUT_MS);

    expect(seen).toHaveLength(0);
  });

  // ─── Lifecycle logging (visible in release builds) ───────

  test('logs the key lifecycle steps at info level', async () => {
    const { backend, bridge } = makeBackend();
    await backend.load(scRequest());
    await backend.play();
    bridge({ type: 'progress', isPlaying: true, elapsed: 1, duration: 200 });

    const infoMessages = (logger.info as jest.Mock).mock.calls.map((call) => call[1]);
    expect(infoMessages).toEqual(
      expect.arrayContaining([
        'WebView bridge ready',
        'Load command sent',
        'Play command sent',
        'SoundCloud playback started',
      ]),
    );
  });

  test('logs a dead track as a warning', async () => {
    const { backend } = makeBackend();
    await backend.load(scRequest());

    jest.advanceTimersByTime(SC_START_TIMEOUT_MS);

    expect(logger.warn).toHaveBeenCalledWith(
      'WebViewSDK',
      'SoundCloud track unplayable',
      expect.objectContaining({ trackId: 'qt_1', reason: 'start-timeout' }),
    );
  });
});
