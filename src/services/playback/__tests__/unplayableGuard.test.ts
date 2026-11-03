/**
 * UnplayableSkipGuard: skip-loop protection tests.
 *
 * The host auto-skips SoundCloud tracks the Widget can't play. These tests
 * lock in the two ways that must NOT turn into a loop or a queue wipe:
 * the same queue entry coming back, and a run of failures in a row.
 */

import {
  MAX_CONSECUTIVE_AUTO_SKIPS,
  UNPLAYABLE_MESSAGE,
  UnplayableSkipGuard,
  handleUnplayableTrack,
} from '../unplayableGuard';

describe('UnplayableSkipGuard', () => {
  test('skips a dead track the first time it is seen', () => {
    const guard = new UnplayableSkipGuard();
    expect(guard.evaluate('qt_1')).toBe('skip');
  });

  test('never auto-skips the same queue entry twice', () => {
    // The server can hand the same current track back (a refused advance,
    // a reconnect resync). Skipping it again would loop forever.
    const guard = new UnplayableSkipGuard();
    expect(guard.evaluate('qt_1')).toBe('skip');
    expect(guard.evaluate('qt_1')).toBe('already-tried');
    expect(guard.evaluate('qt_1')).toBe('already-tried');
  });

  test('keeps skipping different dead tracks up to the streak limit', () => {
    const guard = new UnplayableSkipGuard();
    const decisions = Array.from({ length: MAX_CONSECUTIVE_AUTO_SKIPS }, (_, i) =>
      guard.evaluate(`qt_${i}`),
    );
    expect(decisions).toEqual(Array(MAX_CONSECUTIVE_AUTO_SKIPS).fill('skip'));
  });

  test('stops at the streak limit instead of burning the whole queue', () => {
    const guard = new UnplayableSkipGuard();
    for (let i = 0; i < MAX_CONSECUTIVE_AUTO_SKIPS; i++) guard.evaluate(`qt_${i}`);

    expect(guard.evaluate('qt_next')).toBe('streak-limit');
    expect(guard.evaluate('qt_after')).toBe('streak-limit');
  });

  test('a track that really plays resets the streak', () => {
    const guard = new UnplayableSkipGuard();
    for (let i = 0; i < MAX_CONSECUTIVE_AUTO_SKIPS; i++) guard.evaluate(`qt_${i}`);
    expect(guard.evaluate('qt_blocked')).toBe('streak-limit');

    guard.recordPlayback();

    expect(guard.evaluate('qt_blocked')).toBe('skip');
  });

  test('the streak limit does not mark the blocked entry as tried', () => {
    // After the host sorts things out (retry, reconnect), that entry must
    // still be eligible rather than permanently "already-tried".
    const guard = new UnplayableSkipGuard(1);
    guard.evaluate('qt_1');
    expect(guard.evaluate('qt_2')).toBe('streak-limit');

    guard.recordPlayback();

    expect(guard.evaluate('qt_2')).toBe('skip');
  });

  test('already-tried wins over the streak limit', () => {
    const guard = new UnplayableSkipGuard(1);
    guard.evaluate('qt_1');
    expect(guard.evaluate('qt_1')).toBe('already-tried');
  });

  test('every remaining track is tried once when they all fail within the limit', () => {
    // Whole queue dead, shorter than the streak limit: each entry gets one
    // attempt, then the queue is empty and nothing is left to loop on.
    const guard = new UnplayableSkipGuard(5);
    const queue = ['qt_1', 'qt_2', 'qt_3'];
    expect(queue.map((id) => guard.evaluate(id))).toEqual(['skip', 'skip', 'skip']);
  });

  test('reset forgets tried entries and the streak', () => {
    const guard = new UnplayableSkipGuard(1);
    guard.evaluate('qt_1');
    expect(guard.evaluate('qt_2')).toBe('streak-limit');

    guard.reset();

    expect(guard.evaluate('qt_1')).toBe('skip');
  });
});

describe('handleUnplayableTrack', () => {
  function makeDeps(currentTrackId: string | null, guard = new UnplayableSkipGuard()) {
    return {
      guard,
      getCurrentTrackId: () => currentTrackId,
      notify: jest.fn(),
      advance: jest.fn(),
    };
  }

  test('tells the host and advances for a current dead track', () => {
    const deps = makeDeps('qt_1');

    expect(handleUnplayableTrack({ trackId: 'qt_1' }, deps)).toBe('skip');

    expect(deps.notify).toHaveBeenCalledWith("Can't play this track. Skipping.");
    expect(deps.advance).toHaveBeenCalledTimes(1);
  });

  test('ignores a verdict for a track that is no longer current', () => {
    // The host moved on (manual skip, resync) before the timer fired.
    const deps = makeDeps('qt_2');

    expect(handleUnplayableTrack({ trackId: 'qt_1' }, deps)).toBe('stale');

    expect(deps.notify).not.toHaveBeenCalled();
    expect(deps.advance).not.toHaveBeenCalled();
  });

  test('a stale verdict does not use up the guard', () => {
    const guard = new UnplayableSkipGuard();
    handleUnplayableTrack({ trackId: 'qt_1' }, makeDeps('qt_2', guard));

    expect(handleUnplayableTrack({ trackId: 'qt_1' }, makeDeps('qt_1', guard))).toBe('skip');
  });

  test('tells the host but does not advance when the entry was already tried', () => {
    const guard = new UnplayableSkipGuard();
    handleUnplayableTrack({ trackId: 'qt_1' }, makeDeps('qt_1', guard));
    const deps = makeDeps('qt_1', guard);

    expect(handleUnplayableTrack({ trackId: 'qt_1' }, deps)).toBe('already-tried');

    expect(deps.notify).toHaveBeenCalledWith(UNPLAYABLE_MESSAGE['already-tried']);
    expect(deps.advance).not.toHaveBeenCalled();
  });

  test('tells the host but does not advance once the streak limit is hit', () => {
    const guard = new UnplayableSkipGuard(2);
    handleUnplayableTrack({ trackId: 'qt_1' }, makeDeps('qt_1', guard));
    handleUnplayableTrack({ trackId: 'qt_2' }, makeDeps('qt_2', guard));
    const deps = makeDeps('qt_3', guard);

    expect(handleUnplayableTrack({ trackId: 'qt_3' }, deps)).toBe('streak-limit');

    expect(deps.notify).toHaveBeenCalledWith(UNPLAYABLE_MESSAGE['streak-limit']);
    expect(deps.advance).not.toHaveBeenCalled();
  });

  test('walks a fully dead queue once, advancing exactly once per entry', () => {
    const guard = new UnplayableSkipGuard(5);
    const queue = ['qt_1', 'qt_2', 'qt_3'];
    const advance = jest.fn();

    // The engine would load each next entry and fail it in turn; a stale
    // repeat verdict for an already-skipped entry changes nothing.
    queue.forEach((id) => {
      handleUnplayableTrack({ trackId: id }, { ...makeDeps(id, guard), advance });
      handleUnplayableTrack({ trackId: id }, { ...makeDeps(id, guard), advance });
    });

    expect(advance).toHaveBeenCalledTimes(queue.length);
  });
});
