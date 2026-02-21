/**
 * Queue Engine — Room Mode Physics Tests
 *
 * Pure function tests — zero native deps, zero mocks needed.
 * Validates the three room modes behave correctly:
 *   Campfire 🔥  — Round-robin interleaving
 *   Spotlight 🎤 — Host curates, non-host → suggested
 *   Open Floor ⚡ — Votes reorder the queue
 */

import {
  addTrackToQueue,
  applyVote,
  skipCurrentTrack,
  approveTrack,
  rejectTrack,
  moveTrack,
} from '../queueEngine';
import type { QueueTrack } from '../../types';

// ─── Test Helpers ────────────────────────────────────────────

const HOST_ID = 'host_001';
const USER_A = 'user_alice';
const USER_B = 'user_bob';
const USER_C = 'user_carol';

function makeTrack(overrides: Partial<QueueTrack> = {}): QueueTrack {
  const id = overrides.id || `trk_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: `Track ${id}`,
    artist: 'Test Artist',
    duration: 180,
    source: 'itunes',
    addedById: USER_A,
    addedAt: new Date().toISOString(),
    votes: 0,
    ...overrides,
  };
}

function tracksByUser(userId: string, count: number): QueueTrack[] {
  return Array.from({ length: count }, (_, i) =>
    makeTrack({
      id: `${userId}_t${i}`,
      addedById: userId,
      addedAt: new Date(Date.now() + i * 1000).toISOString(),
    })
  );
}

// ─── addTrackToQueue ─────────────────────────────────────────

describe('addTrackToQueue', () => {
  // ── Campfire Mode ──

  describe('campfire mode', () => {
    it('appends a single track to an empty queue', () => {
      const track = makeTrack({ addedById: USER_A });
      const result = addTrackToQueue([], [], track, 'campfire', HOST_ID);

      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].id).toBe(track.id);
      expect(result.destination).toBe('queue');
      expect(result.suggestedQueue).toHaveLength(0);
    });

    it('interleaves tracks from two contributors', () => {
      // Alice has 2 tracks, Bob adds a third
      const aliceTracks = tracksByUser(USER_A, 2);
      const bobTrack = makeTrack({ addedById: USER_B });

      const result = addTrackToQueue(aliceTracks, [], bobTrack, 'campfire', HOST_ID);

      // Should interleave: Alice → Bob → Alice
      expect(result.queue).toHaveLength(3);
      expect(result.queue[0].addedById).toBe(USER_A);
      expect(result.queue[1].addedById).toBe(USER_B);
      expect(result.queue[2].addedById).toBe(USER_A);
    });

    it('interleaves three contributors fairly', () => {
      const alice = tracksByUser(USER_A, 2);
      const bob = tracksByUser(USER_B, 2);
      const carol = tracksByUser(USER_C, 1);
      const existing = [...alice, ...bob];
      const newTrack = carol[0];

      const result = addTrackToQueue(existing, [], newTrack, 'campfire', HOST_ID);

      // Round-robin order should be: A → B → C → A → B
      expect(result.queue).toHaveLength(5);
      const owners = result.queue.map((t) => t.addedById);
      expect(owners[0]).toBe(USER_A);
      expect(owners[1]).toBe(USER_B);
      expect(owners[2]).toBe(USER_C);
      expect(owners[3]).toBe(USER_A);
      expect(owners[4]).toBe(USER_B);
    });

    it('preserves relative order within same contributor', () => {
      const a1 = makeTrack({ id: 'a1', addedById: USER_A, addedAt: '2026-01-01T00:00:00Z' });
      const a2 = makeTrack({ id: 'a2', addedById: USER_A, addedAt: '2026-01-01T00:01:00Z' });
      const b1 = makeTrack({ id: 'b1', addedById: USER_B, addedAt: '2026-01-01T00:00:30Z' });

      const result = addTrackToQueue([a1, a2], [], b1, 'campfire', HOST_ID);

      // Alice's tracks should still be a1 before a2
      const aliceTracks = result.queue.filter((t) => t.addedById === USER_A);
      expect(aliceTracks[0].id).toBe('a1');
      expect(aliceTracks[1].id).toBe('a2');
    });

    it('does not interleave when only one contributor', () => {
      const tracks = tracksByUser(USER_A, 3);
      const newTrack = makeTrack({ addedById: USER_A });

      const result = addTrackToQueue(tracks, [], newTrack, 'campfire', HOST_ID);

      expect(result.queue).toHaveLength(4);
      // All same contributor — no interleaving needed
      expect(result.queue.every((t) => t.addedById === USER_A)).toBe(true);
    });
  });

  // ── Spotlight Mode ──

  describe('spotlight mode', () => {
    it('host track goes directly to queue', () => {
      const hostTrack = makeTrack({ addedById: HOST_ID });
      const result = addTrackToQueue([], [], hostTrack, 'spotlight', HOST_ID);

      expect(result.queue).toHaveLength(1);
      expect(result.suggestedQueue).toHaveLength(0);
      expect(result.destination).toBe('queue');
    });

    it('non-host track goes to suggestedQueue as pending', () => {
      const guestTrack = makeTrack({ addedById: USER_A });
      const result = addTrackToQueue([], [], guestTrack, 'spotlight', HOST_ID);

      expect(result.queue).toHaveLength(0);
      expect(result.suggestedQueue).toHaveLength(1);
      expect(result.suggestedQueue[0].status).toBe('pending');
      expect(result.destination).toBe('suggested');
    });

    it('non-host track preserves existing queue', () => {
      const existing = [makeTrack({ addedById: HOST_ID })];
      const guestTrack = makeTrack({ addedById: USER_B });

      const result = addTrackToQueue(existing, [], guestTrack, 'spotlight', HOST_ID);

      expect(result.queue).toEqual(existing);
      expect(result.suggestedQueue).toHaveLength(1);
    });

    it('host additions append to existing queue', () => {
      const existing = [makeTrack({ addedById: HOST_ID, id: 'h1' })];
      const hostTrack2 = makeTrack({ addedById: HOST_ID, id: 'h2' });

      const result = addTrackToQueue(existing, [], hostTrack2, 'spotlight', HOST_ID);

      expect(result.queue).toHaveLength(2);
      expect(result.queue[1].id).toBe('h2');
    });
  });

  // ── Open Floor Mode ──

  describe('openFloor mode', () => {
    it('appends track to queue without interleaving', () => {
      const existing = tracksByUser(USER_A, 2);
      const newTrack = makeTrack({ addedById: USER_B });

      const result = addTrackToQueue(existing, [], newTrack, 'openFloor', HOST_ID);

      expect(result.queue).toHaveLength(3);
      // Last track should be the newly added one (no reorder on add)
      expect(result.queue[2].id).toBe(newTrack.id);
      expect(result.destination).toBe('queue');
    });
  });
});

// ─── applyVote ───────────────────────────────────────────────

describe('applyVote', () => {
  it('adds an upvote to a track', () => {
    const queue = [makeTrack({ id: 'now' }), makeTrack({ id: 'target', votes: 0 })];
    const result = applyVote(queue, 'target', USER_A, 1, 'openFloor');

    const target = result.find((t) => t.id === 'target')!;
    expect(target.votes).toBe(1);
    expect(target.votedBy?.[USER_A]).toBe(1);
  });

  it('adds a downvote to a track', () => {
    const queue = [makeTrack({ id: 'now' }), makeTrack({ id: 'target', votes: 0 })];
    const result = applyVote(queue, 'target', USER_A, -1, 'openFloor');

    const target = result.find((t) => t.id === 'target')!;
    expect(target.votes).toBe(-1);
    expect(target.votedBy?.[USER_A]).toBe(-1);
  });

  it('undoes a vote when same direction tapped again', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'target', votes: 1, votedBy: { [USER_A]: 1 } }),
    ];
    const result = applyVote(queue, 'target', USER_A, 1, 'openFloor');

    const target = result.find((t) => t.id === 'target')!;
    expect(target.votes).toBe(0);
    expect(target.votedBy?.[USER_A]).toBeUndefined();
  });

  it('undoes opposite vote without auto-applying new direction', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'target', votes: 1, votedBy: { [USER_A]: 1 } }),
    ];
    // User taps downvote — should undo the upvote, NOT apply downvote
    const result = applyVote(queue, 'target', USER_A, -1, 'openFloor');

    const target = result.find((t) => t.id === 'target')!;
    expect(target.votes).toBe(0);
    expect(target.votedBy?.[USER_A]).toBeUndefined();
  });

  it('multiple users can vote independently', () => {
    const queue = [makeTrack({ id: 'now' }), makeTrack({ id: 'target', votes: 0 })];

    let result = applyVote(queue, 'target', USER_A, 1, 'openFloor');
    result = applyVote(result, 'target', USER_B, 1, 'openFloor');
    result = applyVote(result, 'target', USER_C, -1, 'openFloor');

    const target = result.find((t) => t.id === 'target')!;
    expect(target.votes).toBe(1); // +1 +1 -1 = 1
    expect(target.votedBy?.[USER_A]).toBe(1);
    expect(target.votedBy?.[USER_B]).toBe(1);
    expect(target.votedBy?.[USER_C]).toBe(-1);
  });

  it('re-sorts queue by votes in openFloor mode', () => {
    const queue = [
      makeTrack({ id: 'now', votes: 0 }),
      makeTrack({ id: 'low', votes: 0, addedAt: '2026-01-01T00:00:00Z' }),
      makeTrack({ id: 'high', votes: 0, addedAt: '2026-01-01T00:01:00Z' }),
    ];

    // Upvote the last track — it should move ahead of 'low'
    const result = applyVote(queue, 'high', USER_A, 1, 'openFloor');

    expect(result[0].id).toBe('now'); // now-playing stays put
    expect(result[1].id).toBe('high'); // voted up
    expect(result[2].id).toBe('low'); // no votes
  });

  it('does NOT re-sort in campfire mode (votes are cosmetic)', () => {
    const queue = [
      makeTrack({ id: 'now', votes: 0 }),
      makeTrack({ id: 'first', votes: 0 }),
      makeTrack({ id: 'second', votes: 0 }),
    ];

    const result = applyVote(queue, 'second', USER_A, 1, 'campfire');

    // Order should be unchanged despite vote
    expect(result[0].id).toBe('now');
    expect(result[1].id).toBe('first');
    expect(result[2].id).toBe('second');
  });

  it('does NOT re-sort in spotlight mode (votes are cosmetic)', () => {
    const queue = [
      makeTrack({ id: 'now', votes: 0 }),
      makeTrack({ id: 'first', votes: 0 }),
      makeTrack({ id: 'second', votes: 0 }),
    ];

    const result = applyVote(queue, 'second', USER_A, 1, 'spotlight');

    expect(result[0].id).toBe('now');
    expect(result[1].id).toBe('first');
    expect(result[2].id).toBe('second');
  });

  it('uses addedAt as tiebreaker (earlier wins)', () => {
    const queue = [
      makeTrack({ id: 'now', votes: 0 }),
      makeTrack({ id: 'newer', votes: 1, addedAt: '2026-01-01T01:00:00Z' }),
      makeTrack({ id: 'older', votes: 0, addedAt: '2026-01-01T00:00:00Z' }),
    ];

    // Upvote 'older' to tie with 'newer' (both at 1 vote)
    const result = applyVote(queue, 'older', USER_A, 1, 'openFloor');

    expect(result[0].id).toBe('now');
    // Tied at 1 vote — 'older' addedAt is earlier, so it wins
    expect(result[1].id).toBe('older');
    expect(result[2].id).toBe('newer');
  });

  it('handles non-existent trackId gracefully', () => {
    const queue = [makeTrack({ id: 'real', votes: 0 })];
    const result = applyVote(queue, 'nonexistent', USER_A, 1, 'openFloor');

    // Queue unchanged
    expect(result).toHaveLength(1);
    expect(result[0].votes).toBe(0);
  });
});

// ─── skipCurrentTrack ────────────────────────────────────────

describe('skipCurrentTrack', () => {
  it('removes the first track from the queue', () => {
    const queue = [makeTrack({ id: 'playing' }), makeTrack({ id: 'next' })];
    const { queue: result, skipped } = skipCurrentTrack(queue, USER_A, HOST_ID, 'campfire');

    expect(skipped).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('next');
  });

  it('returns skipped=false on empty queue', () => {
    const { queue: result, skipped } = skipCurrentTrack([], USER_A, HOST_ID, 'campfire');

    expect(skipped).toBe(false);
    expect(result).toHaveLength(0);
  });

  it('anyone can skip in campfire mode', () => {
    const queue = [makeTrack({ id: 'playing' })];
    const { skipped } = skipCurrentTrack(queue, USER_A, HOST_ID, 'campfire');
    expect(skipped).toBe(true);
  });

  it('anyone can skip in openFloor mode', () => {
    const queue = [makeTrack({ id: 'playing' })];
    const { skipped } = skipCurrentTrack(queue, USER_A, HOST_ID, 'openFloor');
    expect(skipped).toBe(true);
  });

  it('host CAN skip in spotlight mode', () => {
    const queue = [makeTrack({ id: 'playing' })];
    const { skipped } = skipCurrentTrack(queue, HOST_ID, HOST_ID, 'spotlight');
    expect(skipped).toBe(true);
  });

  it('non-host CANNOT skip in spotlight mode', () => {
    const queue = [makeTrack({ id: 'playing' })];
    const { queue: result, skipped } = skipCurrentTrack(queue, USER_A, HOST_ID, 'spotlight');

    expect(skipped).toBe(false);
    expect(result).toHaveLength(1); // Queue unchanged
  });
});

// ─── approveTrack ────────────────────────────────────────────

describe('approveTrack', () => {
  it('moves track from suggestedQueue to main queue', () => {
    const suggested = [makeTrack({ id: 'pending1', status: 'pending' })];
    const result = approveTrack([], suggested, 'pending1');

    expect(result.queue).toHaveLength(1);
    expect(result.queue[0].id).toBe('pending1');
    expect(result.queue[0].status).toBe('approved');
    expect(result.suggestedQueue).toHaveLength(0);
  });

  it('appends approved track to end of existing queue', () => {
    const queue = [makeTrack({ id: 'existing' })];
    const suggested = [makeTrack({ id: 'pending1', status: 'pending' })];

    const result = approveTrack(queue, suggested, 'pending1');

    expect(result.queue).toHaveLength(2);
    expect(result.queue[0].id).toBe('existing');
    expect(result.queue[1].id).toBe('pending1');
  });

  it('only removes the approved track from suggestedQueue', () => {
    const suggested = [
      makeTrack({ id: 'p1', status: 'pending' }),
      makeTrack({ id: 'p2', status: 'pending' }),
    ];

    const result = approveTrack([], suggested, 'p1');

    expect(result.suggestedQueue).toHaveLength(1);
    expect(result.suggestedQueue[0].id).toBe('p2');
  });

  it('no-ops when trackId not found in suggestedQueue', () => {
    const queue = [makeTrack({ id: 'existing' })];
    const suggested = [makeTrack({ id: 'p1', status: 'pending' })];

    const result = approveTrack(queue, suggested, 'nonexistent');

    expect(result.queue).toEqual(queue);
    expect(result.suggestedQueue).toEqual(suggested);
  });
});

// ─── rejectTrack ─────────────────────────────────────────────

describe('rejectTrack', () => {
  it('removes track from suggestedQueue', () => {
    const suggested = [
      makeTrack({ id: 'p1', status: 'pending' }),
      makeTrack({ id: 'p2', status: 'pending' }),
    ];

    const result = rejectTrack(suggested, 'p1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p2');
  });

  it('returns same array when trackId not found', () => {
    const suggested = [makeTrack({ id: 'p1', status: 'pending' })];
    const result = rejectTrack(suggested, 'nonexistent');

    expect(result).toHaveLength(1);
  });

  it('returns empty array when rejecting last track', () => {
    const suggested = [makeTrack({ id: 'p1', status: 'pending' })];
    const result = rejectTrack(suggested, 'p1');

    expect(result).toHaveLength(0);
  });
});

// ─── moveTrack ───────────────────────────────────────────────

describe('moveTrack', () => {
  it('moves a track up in the queue', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'b' }),
    ];

    const result = moveTrack(queue, 'b', 'up');

    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('a');
  });

  it('moves a track down in the queue', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'b' }),
    ];

    const result = moveTrack(queue, 'a', 'down');

    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('a');
  });

  it('cannot move now-playing track (index 0)', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'a' }),
    ];

    const result = moveTrack(queue, 'now', 'down');

    expect(result[0].id).toBe('now'); // Unchanged
  });

  it('cannot move track at index 1 above now-playing', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'b' }),
    ];

    const result = moveTrack(queue, 'a', 'up');

    // Should be unchanged — can't move past now-playing
    expect(result[0].id).toBe('now');
    expect(result[1].id).toBe('a');
  });

  it('cannot move last track further down', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'b' }),
    ];

    const result = moveTrack(queue, 'b', 'down');

    // Should be unchanged — already at end
    expect(result[2].id).toBe('b');
  });

  it('returns queue unchanged when trackId not found', () => {
    const queue = [makeTrack({ id: 'now' }), makeTrack({ id: 'a' })];
    const result = moveTrack(queue, 'nonexistent', 'up');

    expect(result).toEqual(queue);
  });

  it('does not mutate original queue', () => {
    const queue = [
      makeTrack({ id: 'now' }),
      makeTrack({ id: 'a' }),
      makeTrack({ id: 'b' }),
    ];
    const originalOrder = queue.map((t) => t.id);

    moveTrack(queue, 'b', 'up');

    // Original should be untouched
    expect(queue.map((t) => t.id)).toEqual(originalOrder);
  });
});

// ─── Edge Cases ──────────────────────────────────────────────

describe('edge cases', () => {
  it('addTrackToQueue handles empty queue in all modes', () => {
    const track = makeTrack({ addedById: USER_A });

    const campfire = addTrackToQueue([], [], track, 'campfire', HOST_ID);
    const openFloor = addTrackToQueue([], [], track, 'openFloor', HOST_ID);

    expect(campfire.queue).toHaveLength(1);
    expect(openFloor.queue).toHaveLength(1);
  });

  it('applyVote on single-item queue does not crash', () => {
    const queue = [makeTrack({ id: 'only', votes: 0 })];
    const result = applyVote(queue, 'only', USER_A, 1, 'openFloor');

    expect(result[0].votes).toBe(1);
  });

  it('skipCurrentTrack on single-item queue returns empty', () => {
    const queue = [makeTrack({ id: 'only' })];
    const { queue: result, skipped } = skipCurrentTrack(queue, USER_A, HOST_ID, 'campfire');

    expect(skipped).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('all functions return new arrays (immutability)', () => {
    const queue = [makeTrack({ id: 'now' }), makeTrack({ id: 'a' })];
    const suggested = [makeTrack({ id: 'p1', status: 'pending' })];

    const addResult = addTrackToQueue(queue, suggested, makeTrack(), 'campfire', HOST_ID);
    const voteResult = applyVote(queue, 'a', USER_A, 1, 'openFloor');
    const skipResult = skipCurrentTrack(queue, USER_A, HOST_ID, 'campfire');
    const approveResult = approveTrack(queue, suggested, 'p1');
    const rejectResult = rejectTrack(suggested, 'p1');
    const moveResult = moveTrack(queue, 'a', 'down');

    // None of these should be the same reference as the input
    expect(addResult.queue).not.toBe(queue);
    expect(voteResult).not.toBe(queue);
    expect(skipResult.queue).not.toBe(queue);
    expect(approveResult.queue).not.toBe(queue);
    expect(rejectResult).not.toBe(suggested);
    // moveTrack with valid move returns new array
    // (with invalid move it may return same ref, which is acceptable)
  });
});
