/**
 * Session receipt (Master Bounce) tests.
 *
 * Pure logic only. These lock in the numbers a real two-device session got
 * wrong: the duration was the screen's mount time, the track count was
 * whatever was current, the head count shrank when the host left the
 * roster, the host showed as "Host", CV was the lifetime balance, and the
 * receipt of one room surfaced in the next.
 */

import {
  MIN_PLAYED_SECONDS,
  SessionReceiptLedger,
  hasPlayedLongEnough,
  receiptBelongsTo,
  sessionDurationSeconds,
  trackVoteCount,
} from '../sessionReceipt';
import type { QueueTrack } from '../../types';
import { BEHAVIOR_PRESETS, DEFAULT_BEHAVIORS } from '../../types';

function makeTrack(id: string, overrides: Partial<QueueTrack> = {}): QueueTrack {
  return {
    id,
    title: `Track ${id}`,
    artist: 'Test Artist',
    duration: 200,
    source: 'soundcloud',
    addedById: 'user_a',
    addedAt: '2026-11-11T18:00:00.000Z',
    votes: 0,
    ...overrides,
  };
}

// SQLite's datetime('now') shape, which is what the backend sends as createdAt.
const CREATED_AT = '2026-11-11 18:00:00';
const CREATED_AT_MS = Date.UTC(2026, 10, 11, 18, 0, 0);

describe('sessionDurationSeconds', () => {
  test('measures from room creation to the end', () => {
    const seconds = sessionDurationSeconds({
      createdAtMs: CREATED_AT_MS,
      connectedAtMs: CREATED_AT_MS + 60_000,
      endedAtMs: CREATED_AT_MS + (4 * 60 + 7) * 1000,
    });
    expect(seconds).toBe(247);
  });

  test('falls back to the connect time when the server gave no creation time', () => {
    const seconds = sessionDurationSeconds({
      createdAtMs: null,
      connectedAtMs: 1_000_000,
      endedAtMs: 1_000_000 + 90_000,
    });
    expect(seconds).toBe(90);
  });

  test('falls back to the connect time when the creation time is after the end', () => {
    // Device and server clocks disagree; a negative duration is worse than a short one.
    const seconds = sessionDurationSeconds({
      createdAtMs: 5_000_000,
      connectedAtMs: 1_000_000,
      endedAtMs: 1_000_000 + 30_000,
    });
    expect(seconds).toBe(30);
  });

  test('is never negative', () => {
    const seconds = sessionDurationSeconds({
      createdAtMs: null,
      connectedAtMs: 2_000_000,
      endedAtMs: 1_000_000,
    });
    expect(seconds).toBe(0);
  });

  test('rounds to whole seconds', () => {
    expect(
      sessionDurationSeconds({ createdAtMs: 0, connectedAtMs: 0, endedAtMs: 1499 }),
    ).toBe(1);
    expect(
      sessionDurationSeconds({ createdAtMs: 0, connectedAtMs: 0, endedAtMs: 1500 }),
    ).toBe(2);
  });
});

describe('trackVoteCount', () => {
  test('uses the net vote total', () => {
    expect(trackVoteCount({ votes: 4 })).toBe(4);
  });

  test('counts the votedBy map when there is no total', () => {
    // votedBy is a userId -> 1 | -1 map. The receipt used to read its
    // .length, which is undefined on an object, so every track showed 0.
    expect(trackVoteCount({ votedBy: { a: 1, b: 1 } })).toBe(2);
    expect(trackVoteCount({ votedBy: { a: 1, b: 1, c: -1 } })).toBe(1);
  });

  test('is never negative', () => {
    expect(trackVoteCount({ votes: -2 })).toBe(0);
    expect(trackVoteCount({ votedBy: { a: -1 } })).toBe(0);
  });

  test('is zero for a track nobody voted on', () => {
    expect(trackVoteCount({})).toBe(0);
  });
});

describe('receiptBelongsTo', () => {
  test('is true only for the session the receipt was frozen for', () => {
    const receipt = new SessionReceiptLedger('room_A', 0).close({ name: 'Room A' }, 1000);
    expect(receiptBelongsTo(receipt, 'room_A')).toBe(true);
  });

  test('is false for any other session, so a new room never inherits the old receipt', () => {
    const receipt = new SessionReceiptLedger('room_A', 0).close({ name: 'Room A' }, 1000);
    expect(receiptBelongsTo(receipt, 'room_B')).toBe(false);
    expect(receiptBelongsTo(receipt, '')).toBe(false);
  });

  test('is false when there is no receipt', () => {
    expect(receiptBelongsTo(null, 'room_A')).toBe(false);
    expect(receiptBelongsTo(undefined, 'room_A')).toBe(false);
  });
});

describe('SessionReceiptLedger participants', () => {
  test('counts everyone ever on the roster, even after they leave it', () => {
    const ledger = new SessionReceiptLedger('s1', CREATED_AT_MS);
    ledger.noteParticipants([
      { userId: 'host', username: 'dj_host' },
      { userId: 'guest', username: 'caleb' },
    ]);
    // The host leaves the roster right after the end event; the live
    // roster shrinks to one while the receipt is on screen.
    ledger.noteParticipants([{ userId: 'guest', username: 'caleb' }]);

    const receipt = ledger.close(
      { hostId: 'host', hostUsername: 'dj_host', createdAt: CREATED_AT },
      CREATED_AT_MS + 60_000,
    );
    expect(receipt.participantCount).toBe(2);
  });

  test('counts the host even if the roster never listed them', () => {
    const ledger = new SessionReceiptLedger('s1', CREATED_AT_MS);
    ledger.noteParticipant('guest', 'caleb');

    const receipt = ledger.close(
      { hostId: 'host', hostUsername: 'dj_host' },
      CREATED_AT_MS + 1000,
    );
    expect(receipt.participantCount).toBe(2);
  });

  test('does not double count a host who is already on the roster', () => {
    const ledger = new SessionReceiptLedger('s1', CREATED_AT_MS);
    ledger.noteParticipants([
      { userId: 'host', username: 'dj_host' },
      { userId: 'guest', username: 'caleb' },
    ]);

    const receipt = ledger.close({ hostId: 'host', hostUsername: 'dj_host' }, CREATED_AT_MS + 1000);
    expect(receipt.participantCount).toBe(2);
  });

  test('counts a person once however often they are reported', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteParticipant('guest', 'caleb');
    ledger.noteParticipant('guest', 'caleb');
    ledger.noteParticipants([{ userId: 'guest', username: 'caleb' }]);

    expect(ledger.close({}, 1000).participantCount).toBe(1);
  });

  test('keeps a real username when a later report has none', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteParticipant('u1', 'alice');
    ledger.noteParticipant('u1', '');

    expect(ledger.usernameFor('u1')).toBe('alice');
  });

  test('has no name for someone it has not seen', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteParticipant('u2', '');

    expect(ledger.usernameFor('u1')).toBeUndefined();
    expect(ledger.usernameFor('u2')).toBeUndefined();
  });
});

describe('SessionReceiptLedger host username', () => {
  test('comes from the session, not from a roster the host has left', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteParticipant('guest', 'caleb');

    const receipt = ledger.close({ hostId: 'host', hostUsername: 'dj_host' }, 1000);
    expect(receipt.hostUsername).toBe('dj_host');
  });

  test('falls back to the name the roster showed earlier', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteParticipant('host', 'dj_host');

    const receipt = ledger.close({ hostId: 'host' }, 1000);
    expect(receipt.hostUsername).toBe('dj_host');
  });

  test('says Host only when nothing knows the name', () => {
    const ledger = new SessionReceiptLedger('s1', 0);

    expect(ledger.close({ hostId: 'host' }, 1000).hostUsername).toBe('Host');
  });
});

describe('SessionReceiptLedger tracks', () => {
  test('lists played tracks in play order without duplicates', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteTrackPlayed(makeTrack('a'));
    ledger.noteTrackPlayed(makeTrack('b'));
    ledger.noteTrackPlayed(makeTrack('a'));

    const receipt = ledger.close({}, 1000);
    expect(receipt.tracksPlayed.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('refreshes a track snapshot but keeps its place in the order', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteTrackPlayed(makeTrack('a', { votes: 0 }));
    ledger.noteTrackPlayed(makeTrack('b'));
    ledger.noteTrackPlayed(makeTrack('a', { votes: 3 }));

    const receipt = ledger.close({}, 1000);
    expect(receipt.tracksPlayed.map((t) => t.id)).toEqual(['a', 'b']);
    expect(receipt.tracksPlayed[0].votes).toBe(3);
  });

  test('starts empty, so a session where nothing played reports no tracks', () => {
    const ledger = new SessionReceiptLedger('s1', 0);

    expect(ledger.close({}, 1000).tracksPlayed).toEqual([]);
  });

});

describe('hasPlayedLongEnough', () => {
  test('counts a guest track once playback reaches the mark', () => {
    // A guest has no engine, so no clock track id.
    const guest = { isHostDevice: false, nowPlayingId: 'b', clockTrackId: null };

    expect(hasPlayedLongEnough({ ...guest, elapsedSeconds: MIN_PLAYED_SECONDS })).toBe(true);
    expect(hasPlayedLongEnough({ ...guest, elapsedSeconds: 95 })).toBe(true);
  });

  test('does not count a track that was current for a moment', () => {
    const guest = { isHostDevice: false, nowPlayingId: 'b', clockTrackId: null };

    expect(hasPlayedLongEnough({ ...guest, elapsedSeconds: 0 })).toBe(false);
    expect(hasPlayedLongEnough({ ...guest, elapsedSeconds: MIN_PLAYED_SECONDS - 0.5 })).toBe(false);
  });

  test('counts a host track when the engine clock belongs to it', () => {
    const host = { isHostDevice: true, nowPlayingId: 'b', clockTrackId: 'b' };

    expect(hasPlayedLongEnough({ ...host, elapsedSeconds: MIN_PLAYED_SECONDS })).toBe(true);
    expect(hasPlayedLongEnough({ ...host, elapsedSeconds: 1 })).toBe(false);
  });

  test('does not credit the next track with the old song elapsed time on the host', () => {
    // The queue already moved to track b; the engine is still reporting a's 3:07.
    const lagging = { isHostDevice: true, nowPlayingId: 'b', clockTrackId: 'a', elapsedSeconds: 187 };

    expect(hasPlayedLongEnough(lagging)).toBe(false);
  });

  test('does not credit a host track before the engine has loaded anything', () => {
    expect(
      hasPlayedLongEnough({ isHostDevice: true, nowPlayingId: 'a', clockTrackId: null, elapsedSeconds: 40 }),
    ).toBe(false);
  });
});

describe('SessionReceiptLedger CV', () => {
  test('sums what the user earned during the session', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteCvEarned(5);
    ledger.noteCvEarned(3);
    ledger.noteCvEarned(10);

    expect(ledger.close({}, 1000).cvEarned).toBe(18);
  });

  test('ignores zero, negative and non-finite amounts', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteCvEarned(7);
    ledger.noteCvEarned(0);
    ledger.noteCvEarned(-4);
    ledger.noteCvEarned(Number.NaN);
    ledger.noteCvEarned(Number.POSITIVE_INFINITY);

    expect(ledger.close({}, 1000).cvEarned).toBe(7);
  });

  test('starts at zero for every session, whatever the user already had', () => {
    // The receipt once showed the lifetime balance (+236) as "earned".
    const first = new SessionReceiptLedger('s1', 0);
    first.noteCvEarned(236);
    first.close({}, 1000);

    const second = new SessionReceiptLedger('s2', 0);
    expect(second.close({}, 1000).cvEarned).toBe(0);
  });
});

describe('SessionReceiptLedger.close', () => {
  test('stamps the end time from the event and measures duration from room creation', () => {
    const ledger = new SessionReceiptLedger('s1', CREATED_AT_MS + 120_000);
    const endedAtMs = Date.UTC(2026, 10, 11, 18, 4, 7);

    const receipt = ledger.close({ createdAt: CREATED_AT }, endedAtMs);

    expect(receipt.endedAt).toBe('2026-11-11T18:04:07.000Z');
    expect(receipt.durationSeconds).toBe(247);
  });

  test('uses the connect time when the session has no creation time', () => {
    const ledger = new SessionReceiptLedger('s1', 10_000);

    expect(ledger.close({}, 70_000).durationSeconds).toBe(60);
  });

  test('carries the room name, mode and behaviors', () => {
    const behaviors = { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS.campfire };
    const ledger = new SessionReceiptLedger('s1', 0);

    const receipt = ledger.close({ name: 'Friday Night', roomMode: 'campfire', behaviors }, 1000);

    expect(receipt.sessionId).toBe('s1');
    expect(receipt.sessionName).toBe('Friday Night');
    expect(receipt.roomMode).toBe('campfire');
    expect(receipt.behaviors).toEqual(behaviors);
  });

  test('falls back to plain defaults when the session is unknown', () => {
    const ledger = new SessionReceiptLedger('s1', 0);

    const receipt = ledger.close(null, 1000);

    expect(receipt.sessionName).toBe('Session');
    expect(receipt.roomMode).toBe('campfire');
    expect(receipt.behaviors).toEqual(DEFAULT_BEHAVIORS);
    expect(receipt.hostUsername).toBe('Host');
  });

  test('is idempotent: a repeated end event returns the first receipt untouched', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    const first = ledger.close({ name: 'Friday Night' }, 1000);
    const second = ledger.close({ name: 'Something else' }, 999_000);

    expect(second).toBe(first);
    expect(second.sessionName).toBe('Friday Night');
    expect(second.endedAt).toBe(new Date(1000).toISOString());
  });

  test('ignores everything noted after the end', () => {
    const ledger = new SessionReceiptLedger('s1', 0);
    ledger.noteParticipant('guest', 'caleb');
    ledger.noteTrackPlayed(makeTrack('a'));
    ledger.noteCvEarned(5);
    const receipt = ledger.close({ hostId: 'host', hostUsername: 'dj_host' }, 1000);

    // The next room's traffic, or the host leaving, must not touch a receipt already on screen.
    ledger.noteParticipant('late', 'late_joiner');
    ledger.noteTrackPlayed(makeTrack('b'));
    ledger.noteCvEarned(50);

    expect(ledger.isClosed).toBe(true);
    expect(receipt.participantCount).toBe(2);
    expect(receipt.tracksPlayed.map((t) => t.id)).toEqual(['a']);
    expect(receipt.cvEarned).toBe(5);
  });
});

describe('a full two-device session, as the guest saw it', () => {
  test('reports the real numbers instead of the screen-time ones', () => {
    const ledger = new SessionReceiptLedger('room_A', CREATED_AT_MS + 30_000);

    // Host and guest on the roster; three songs reached the play threshold.
    ledger.noteParticipants([
      { userId: 'host', username: 'dj_host' },
      { userId: 'guest', username: 'caleb' },
    ]);
    ledger.noteTrackPlayed(makeTrack('one'));
    ledger.noteTrackPlayed(makeTrack('two'));
    ledger.noteTrackPlayed(makeTrack('three'));
    // CV events for this user: two track plays, a reaction, the session bonus.
    [5, 5, 3, 10].forEach((amount) => ledger.noteCvEarned(amount));
    // The host leaves the roster as the room ends.
    ledger.noteParticipants([{ userId: 'guest', username: 'caleb' }]);

    const receipt = ledger.close(
      { name: 'Friday Night', hostId: 'host', hostUsername: 'dj_host', createdAt: CREATED_AT },
      CREATED_AT_MS + 14 * 60_000 + 20_000,
    );

    expect(receipt.hostUsername).toBe('dj_host');
    expect(receipt.participantCount).toBe(2);
    expect(receipt.tracksPlayed).toHaveLength(3);
    expect(receipt.cvEarned).toBe(23);
    expect(receipt.durationSeconds).toBe(14 * 60 + 20);
    expect(receiptBelongsTo(receipt, 'room_A')).toBe(true);
    expect(receiptBelongsTo(receipt, 'room_B')).toBe(false);
  });
});
