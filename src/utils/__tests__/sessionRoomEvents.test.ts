/**
 * Room event decision tests: skip attribution, the track-ended toast, and
 * the guest playback clock.
 *
 * Pure logic only. Each group pins a bug from the two-device runs:
 * a skip announced as "Preview ended" instead of who skipped, and a guest
 * timer that carried the previous song's elapsed time into the next one.
 */

import {
  describeTrackSkipped,
  providerHoldsOtherRoom,
  resetPlaybackForTrackChange,
  resolveSyncedElapsed,
  shouldAnnounceTrackEnd,
  shouldResetGuestClock,
  type SkipContext,
} from '../sessionRoomEvents';

function makeContext(overrides: Partial<SkipContext> & { roster?: Record<string, string> } = {}): SkipContext {
  const { roster = {}, ...rest } = overrides;
  return {
    selfId: 'guest',
    selfUsername: 'caleb',
    lookupUsername: (userId) => roster[userId],
    ...rest,
  };
}

describe('providerHoldsOtherRoom', () => {
  test('is true on the new screen first render, before the connection has switched', () => {
    // Room A ended and its receipt was never dismissed; the user opens room B.
    expect(
      providerHoldsOtherRoom({ routeSessionId: 'B', connectionId: 'A', loadedSessionId: 'A' }),
    ).toBe(true);
    expect(
      providerHoldsOtherRoom({ routeSessionId: 'B', connectionId: null, loadedSessionId: null }),
    ).toBe(true);
  });

  test('is true after the connection switched but before the old room state was cleared', () => {
    expect(
      providerHoldsOtherRoom({ routeSessionId: 'B', connectionId: 'B', loadedSessionId: 'A' }),
    ).toBe(true);
  });

  test('is false once the provider holds the room the route asks for', () => {
    expect(
      providerHoldsOtherRoom({ routeSessionId: 'B', connectionId: 'B', loadedSessionId: 'B' }),
    ).toBe(false);
  });

  test("is false while the new room is still loading, so the screen's own loading and error states take over", () => {
    expect(
      providerHoldsOtherRoom({ routeSessionId: 'B', connectionId: 'B', loadedSessionId: null }),
    ).toBe(false);
    expect(
      providerHoldsOtherRoom({ routeSessionId: 'B', connectionId: 'B', loadedSessionId: undefined }),
    ).toBe(false);
  });

  test('is false when the route names no room', () => {
    expect(
      providerHoldsOtherRoom({ routeSessionId: undefined, connectionId: 'A', loadedSessionId: 'A' }),
    ).toBe(false);
    expect(
      providerHoldsOtherRoom({ routeSessionId: '', connectionId: 'A', loadedSessionId: 'A' }),
    ).toBe(false);
  });

  test('is false when returning to the room the provider already holds', () => {
    // Host minimizes the room and taps the active patch to come back.
    expect(
      providerHoldsOtherRoom({ routeSessionId: 'A', connectionId: 'A', loadedSessionId: 'A' }),
    ).toBe(false);
  });
});

describe('describeTrackSkipped', () => {
  test('names the skipper from the roster', () => {
    const line = describeTrackSkipped({ userId: 'host' }, makeContext({ roster: { host: 'dj_host' } }));

    expect(line).toBe('dj_host skipped');
  });

  test('names the user on their own device too', () => {
    // The skipper's device used to say "Preview ended" for their own skip.
    const line = describeTrackSkipped({ userId: 'guest' }, makeContext());

    expect(line).toBe('caleb skipped');
  });

  test('never says "preview ended" for a skip', () => {
    const lines = [
      describeTrackSkipped({ userId: 'host' }, makeContext({ roster: { host: 'dj_host' } })),
      describeTrackSkipped({ userId: 'guest' }, makeContext()),
      describeTrackSkipped({ userId: 'ghost' }, makeContext()),
    ];

    lines.forEach((line) => expect(line).not.toMatch(/preview/i));
  });

  test('stays honest when the skipper is not on any list we have', () => {
    // The server sends an id, never a username; an unknown id gets no invented name.
    const line = describeTrackSkipped({ userId: 'ghost' }, makeContext());

    expect(line).toBe('Track skipped.');
  });

  test('still names the host for a forced skip', () => {
    const line = describeTrackSkipped(
      { userId: 'host', forced: true },
      makeContext({ roster: { host: 'dj_host' } }),
    );

    expect(line).toBe('dj_host skipped');
  });

  test('reports a vote skip with its vote count', () => {
    const line = describeTrackSkipped({ userId: 'vote', voteSkip: true, votes: 3 }, makeContext());

    expect(line).toBe('Track skipped by vote (3 votes).');
  });

  test('reports a vote skip without a count when the server sent none', () => {
    const line = describeTrackSkipped({ userId: 'vote', voteSkip: true }, makeContext());

    expect(line).toBe('Track skipped by vote.');
  });

  test('has nothing to say without a payload or a skipper', () => {
    expect(describeTrackSkipped(undefined, makeContext())).toBeNull();
    expect(describeTrackSkipped(null, makeContext())).toBeNull();
    expect(describeTrackSkipped({}, makeContext())).toBeNull();
  });
});

describe('shouldAnnounceTrackEnd', () => {
  test('announces a natural end on the host, whose engine ended the track', () => {
    expect(shouldAnnounceTrackEnd('ended', true)).toBe(true);
  });

  test('never announces a skip as an ending', () => {
    expect(shouldAnnounceTrackEnd('skip', true)).toBe(false);
    expect(shouldAnnounceTrackEnd('skip', false)).toBe(false);
  });

  test('never announces on a guest, which has no engine to end anything', () => {
    expect(shouldAnnounceTrackEnd('ended', false)).toBe(false);
  });
});

describe('resolveSyncedElapsed', () => {
  test('honors a position of zero', () => {
    // The host just started a new track. `position || previous` read this as
    // "no position" and kept the old song's 3:07.
    expect(resolveSyncedElapsed(0, 187)).toBe(0);
  });

  test('takes the reported position', () => {
    expect(resolveSyncedElapsed(42.5, 187)).toBe(42.5);
  });

  test('keeps the previous value when the report has no usable position', () => {
    expect(resolveSyncedElapsed(undefined, 12)).toBe(12);
    expect(resolveSyncedElapsed(null, 12)).toBe(12);
    expect(resolveSyncedElapsed(Number.NaN, 12)).toBe(12);
    expect(resolveSyncedElapsed(Number.POSITIVE_INFINITY, 12)).toBe(12);
  });

  test('never goes below zero', () => {
    expect(resolveSyncedElapsed(-3, 12)).toBe(0);
  });
});

describe('shouldResetGuestClock', () => {
  test('restarts a guest clock when the track changes', () => {
    expect(
      shouldResetGuestClock({ isHostDevice: false, previousTrackId: 'a', nextTrackId: 'b' }),
    ).toBe(true);
  });

  test('restarts a guest clock when the queue runs dry or the first track arrives', () => {
    expect(
      shouldResetGuestClock({ isHostDevice: false, previousTrackId: 'a', nextTrackId: null }),
    ).toBe(true);
    expect(
      shouldResetGuestClock({ isHostDevice: false, previousTrackId: null, nextTrackId: 'a' }),
    ).toBe(true);
  });

  test('leaves the clock alone when the server repeats the track already playing', () => {
    // A reconnect re-announces the current track; that is not a new song.
    expect(
      shouldResetGuestClock({ isHostDevice: false, previousTrackId: 'a', nextTrackId: 'a' }),
    ).toBe(false);
    expect(
      shouldResetGuestClock({ isHostDevice: false, previousTrackId: null, nextTrackId: null }),
    ).toBe(false);
  });

  test('never touches the host clock, which is the engine and replaced wholesale', () => {
    expect(
      shouldResetGuestClock({ isHostDevice: true, previousTrackId: 'a', nextTrackId: 'b' }),
    ).toBe(false);
  });
});

describe('resetPlaybackForTrackChange', () => {
  const midSong = { isPlaying: true, elapsed: 187, progress: 0.9, duration: 208 };

  test('starts the new track at zero and keeps it playing', () => {
    const next = resetPlaybackForTrackChange(midSong, true);

    expect(next.elapsed).toBe(0);
    expect(next.progress).toBe(0);
    expect(next.isPlaying).toBe(true);
  });

  test('keeps the rest of the playback state', () => {
    const next = resetPlaybackForTrackChange(midSong, true);

    expect(next.duration).toBe(208);
  });

  test('stops when the queue ran out and there is no track', () => {
    const next = resetPlaybackForTrackChange(midSong, false);

    expect(next.isPlaying).toBe(false);
    expect(next.elapsed).toBe(0);
  });

  test('hands back the same object when nothing changes, so React skips a render', () => {
    const idle = { isPlaying: true, elapsed: 0, progress: 0 };

    expect(resetPlaybackForTrackChange(idle, true)).toBe(idle);
  });

  test('does not mutate the previous state', () => {
    const before = { ...midSong };
    resetPlaybackForTrackChange(midSong, true);

    expect(midSong).toEqual(before);
  });
});

describe('guest clock across a track change', () => {
  test('the old song elapsed time does not survive into the next song', () => {
    // 3:07 into the last song, playing.
    let clock = { isPlaying: true, elapsed: 187, progress: 0.9 };

    // track-changed arrives; the host is still loading the next song.
    clock = resetPlaybackForTrackChange(clock, true);
    expect(clock.elapsed).toBe(0);

    // The host's next report says "not started yet, position 0".
    clock = { ...clock, isPlaying: false, elapsed: resolveSyncedElapsed(0, clock.elapsed) };
    expect(clock.elapsed).toBe(0);

    // Then it really starts.
    clock = { ...clock, isPlaying: true, elapsed: resolveSyncedElapsed(1.4, clock.elapsed) };
    expect(clock.elapsed).toBe(1.4);
  });
});
