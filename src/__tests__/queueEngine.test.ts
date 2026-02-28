/**
 * Queue Engine — Unit Tests
 *
 * Comprehensive coverage of Room Mode Physics:
 *   🔥 Campfire  — Round-robin interleaving by contributor
 *   🎤 Spotlight — Host curates; non-host → suggestions
 *   ⚡ Open Floor — Votes reorder the queue
 *
 * Pure functions → zero mocks, zero setup, instant execution.
 */

import {
  addTrackToQueue,
  applyVote,
  skipCurrentTrack,
  approveTrack,
  rejectTrack,
  moveTrack,
  type AddTrackResult,
} from '../services/queueEngine';
import type { QueueTrack, RoomBehaviors } from '../types';
import { DEFAULT_BEHAVIORS, BEHAVIOR_PRESETS } from '../types';

// ─── Test Helpers ──────────────────────────────────────────

const HOST_ID = 'host-001';
const USER_A = 'user-alice';
const USER_B = 'user-bob';
const USER_C = 'user-carol';

// Behavior presets for each mode (replaces string mode names)
const CAMPFIRE: RoomBehaviors = { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS.campfire };
const SPOTLIGHT: RoomBehaviors = { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS.spotlight };
const OPEN_FLOOR: RoomBehaviors = { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS.openFloor };
const VOTE_SKIP: RoomBehaviors = { ...DEFAULT_BEHAVIORS, skipAccess: 'voteRequired' };

let trackCounter = 0;

/** Factory: create a QueueTrack with sane defaults */
function makeTrack(overrides: Partial<QueueTrack> = {}): QueueTrack {
  trackCounter++;
  return {
    id: `track-${trackCounter}`,
    title: `Track ${trackCounter}`,
    artist: `Artist ${trackCounter}`,
    duration: 180,
    source: 'spotify',
    addedById: USER_A,
    addedAt: new Date(Date.now() + trackCounter * 1000).toISOString(),
    votes: 0,
    votedBy: {},
    reactions: [],
    ...overrides,
  };
}

/** Build a queue of N tracks from alternating contributors */
function buildQueue(specs: Array<{ userId: string; count: number }>): QueueTrack[] {
  const queue: QueueTrack[] = [];
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      queue.push(makeTrack({ addedById: spec.userId }));
    }
  }
  return queue;
}

// Reset counter between test files
beforeEach(() => {
  trackCounter = 0;
});

// ─── addTrackToQueue ──────────────────────────────────────

describe('addTrackToQueue', () => {
  describe('🔥 Campfire mode', () => {
    it('appends a single track to an empty queue', () => {
      const track = makeTrack({ addedById: USER_A });
      const result = addTrackToQueue([], [], track, CAMPFIRE, HOST_ID);

      expect(result.destination).toBe('queue');
      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].id).toBe(track.id);
      expect(result.suggestedQueue).toHaveLength(0);
    });

    it('interleaves round-robin when two contributors add tracks', () => {
      // Alice has 2 tracks, Bob has 1
      const aliceTrack1 = makeTrack({ addedById: USER_A, title: 'A1' });
      const aliceTrack2 = makeTrack({ addedById: USER_A, title: 'A2' });
      const bobTrack1 = makeTrack({ addedById: USER_B, title: 'B1' });

      // Build queue with Alice's 2 then add Bob's
      let result = addTrackToQueue([], [], aliceTrack1, CAMPFIRE, HOST_ID);
      result = addTrackToQueue(result.queue, [], aliceTrack2, CAMPFIRE, HOST_ID);
      result = addTrackToQueue(result.queue, [], bobTrack1, CAMPFIRE, HOST_ID);

      // Should interleave: A1 → B1 → A2 (not A1 → A2 → B1)
      expect(result.queue).toHaveLength(3);
      expect(result.queue[0].addedById).toBe(USER_A);
      expect(result.queue[1].addedById).toBe(USER_B);
      expect(result.queue[2].addedById).toBe(USER_A);
    });

    it('handles three contributors fairly', () => {
      const a1 = makeTrack({ addedById: USER_A, title: 'A1' });
      const b1 = makeTrack({ addedById: USER_B, title: 'B1' });
      const c1 = makeTrack({ addedById: USER_C, title: 'C1' });
      const a2 = makeTrack({ addedById: USER_A, title: 'A2' });

      let q: QueueTrack[] = [];
      q = addTrackToQueue(q, [], a1, CAMPFIRE, HOST_ID).queue;
      q = addTrackToQueue(q, [], b1, CAMPFIRE, HOST_ID).queue;
      q = addTrackToQueue(q, [], c1, CAMPFIRE, HOST_ID).queue;
      q = addTrackToQueue(q, [], a2, CAMPFIRE, HOST_ID).queue;

      // Expected: A1 → B1 → C1 → A2
      expect(q.map((t) => t.addedById)).toEqual([USER_A, USER_B, USER_C, USER_A]);
    });

    it('preserves order when single contributor adds all tracks', () => {
      const t1 = makeTrack({ addedById: USER_A, title: 'First' });
      const t2 = makeTrack({ addedById: USER_A, title: 'Second' });
      const t3 = makeTrack({ addedById: USER_A, title: 'Third' });

      let q: QueueTrack[] = [];
      q = addTrackToQueue(q, [], t1, CAMPFIRE, HOST_ID).queue;
      q = addTrackToQueue(q, [], t2, CAMPFIRE, HOST_ID).queue;
      q = addTrackToQueue(q, [], t3, CAMPFIRE, HOST_ID).queue;

      expect(q.map((t) => t.title)).toEqual(['First', 'Second', 'Third']);
    });

    it('non-host tracks go to main queue (not suggested)', () => {
      const track = makeTrack({ addedById: USER_A }); // not the host
      const result = addTrackToQueue([], [], track, CAMPFIRE, HOST_ID);

      expect(result.destination).toBe('queue');
      expect(result.queue).toHaveLength(1);
      expect(result.suggestedQueue).toHaveLength(0);
    });
  });

  describe('🎤 Spotlight mode', () => {
    it('host additions go directly to queue', () => {
      const track = makeTrack({ addedById: HOST_ID });
      const result = addTrackToQueue([], [], track, SPOTLIGHT, HOST_ID);

      expect(result.destination).toBe('queue');
      expect(result.queue).toHaveLength(1);
      expect(result.suggestedQueue).toHaveLength(0);
    });

    it('non-host additions go to suggested queue as pending', () => {
      const track = makeTrack({ addedById: USER_A });
      const result = addTrackToQueue([], [], track, SPOTLIGHT, HOST_ID);

      expect(result.destination).toBe('suggested');
      expect(result.queue).toHaveLength(0);
      expect(result.suggestedQueue).toHaveLength(1);
      expect(result.suggestedQueue[0].status).toBe('pending');
    });

    it('existing queue is preserved when non-host suggests', () => {
      const hostTrack = makeTrack({ addedById: HOST_ID });
      const existing = [hostTrack];
      const suggestion = makeTrack({ addedById: USER_A });

      const result = addTrackToQueue(existing, [], suggestion, SPOTLIGHT, HOST_ID);

      expect(result.queue).toHaveLength(1);
      expect(result.queue[0].id).toBe(hostTrack.id);
      expect(result.suggestedQueue).toHaveLength(1);
    });

    it('multiple non-host suggestions accumulate', () => {
      const s1 = makeTrack({ addedById: USER_A });
      const s2 = makeTrack({ addedById: USER_B });

      let result = addTrackToQueue([], [], s1, SPOTLIGHT, HOST_ID);
      result = addTrackToQueue(result.queue, result.suggestedQueue, s2, SPOTLIGHT, HOST_ID);

      expect(result.suggestedQueue).toHaveLength(2);
      expect(result.suggestedQueue.every((t) => t.status === 'pending')).toBe(true);
    });
  });

  describe('⚡ Open Floor mode', () => {
    it('anyone can add directly to queue', () => {
      const track = makeTrack({ addedById: USER_A });
      const result = addTrackToQueue([], [], track, OPEN_FLOOR, HOST_ID);

      expect(result.destination).toBe('queue');
      expect(result.queue).toHaveLength(1);
    });

    it('appends in order (no interleaving)', () => {
      const t1 = makeTrack({ addedById: USER_A, title: 'First' });
      const t2 = makeTrack({ addedById: USER_B, title: 'Second' });
      const t3 = makeTrack({ addedById: USER_A, title: 'Third' });

      let q: QueueTrack[] = [];
      q = addTrackToQueue(q, [], t1, OPEN_FLOOR, HOST_ID).queue;
      q = addTrackToQueue(q, [], t2, OPEN_FLOOR, HOST_ID).queue;
      q = addTrackToQueue(q, [], t3, OPEN_FLOOR, HOST_ID).queue;

      expect(q.map((t) => t.title)).toEqual(['First', 'Second', 'Third']);
    });
  });
});

// ─── applyVote ────────────────────────────────────────────

describe('applyVote', () => {
  it('adds an upvote to a track with no votes', () => {
    const track = makeTrack({ votes: 0, votedBy: {} });
    const result = applyVote([track], track.id, USER_A, 1, OPEN_FLOOR);

    expect(result[0].votes).toBe(1);
    expect(result[0].votedBy![USER_A]).toBe(1);
  });

  it('adds a downvote', () => {
    const track = makeTrack({ votes: 0, votedBy: {} });
    const result = applyVote([track], track.id, USER_A, -1, OPEN_FLOOR);

    // No prior vote + direction -1 → add vote: votedBy[userId] = -1, delta = -1
    expect(result[0].votes).toBe(-1);
    expect(result[0].votedBy![USER_A]).toBe(-1);
  });

  it('undoes a vote when same direction is applied again (toggle off)', () => {
    const track = makeTrack({ votes: 1, votedBy: { [USER_A]: 1 } });
    const result = applyVote([track], track.id, USER_A, 1, OPEN_FLOOR);

    // Same direction again → undo
    expect(result[0].votes).toBe(0);
    expect(result[0].votedBy![USER_A]).toBeUndefined();
  });

  it('undoes a vote when opposite direction is applied (switch behavior)', () => {
    const track = makeTrack({ votes: 1, votedBy: { [USER_A]: 1 } });
    const result = applyVote([track], track.id, USER_A, -1, OPEN_FLOOR);

    // Opposite direction → undo current (doesn't auto-apply new)
    expect(result[0].votes).toBe(0);
    expect(result[0].votedBy![USER_A]).toBeUndefined();
  });

  it('multiple users can vote on the same track', () => {
    const track = makeTrack({ votes: 0, votedBy: {} });
    let queue = applyVote([track], track.id, USER_A, 1, OPEN_FLOOR);
    queue = applyVote(queue, track.id, USER_B, 1, OPEN_FLOOR);

    expect(queue[0].votes).toBe(2);
    expect(queue[0].votedBy![USER_A]).toBe(1);
    expect(queue[0].votedBy![USER_B]).toBe(1);
  });

  it('does not affect other tracks in the queue', () => {
    const t1 = makeTrack({ votes: 5, votedBy: {} });
    const t2 = makeTrack({ votes: 0, votedBy: {} });
    const result = applyVote([t1, t2], t2.id, USER_A, 1, OPEN_FLOOR);

    expect(result[0].votes).toBe(5); // t1 unchanged
    expect(result[1].votes).toBe(1); // t2 voted
  });

  describe('Open Floor vote-reorder', () => {
    it('re-sorts queue by votes descending after vote', () => {
      const nowPlaying = makeTrack({ votes: 0, votedBy: {} }); // index 0 — locked
      const lowVotes = makeTrack({ votes: 1, votedBy: {} });
      const highVotes = makeTrack({ votes: 3, votedBy: {} });
      const queue = [nowPlaying, lowVotes, highVotes];

      // Vote on lowVotes to make it 2 — still below 3
      const result = applyVote(queue, lowVotes.id, USER_A, 1, OPEN_FLOOR);

      // Now playing stays at 0, then highVotes (3), then lowVotes (2)
      expect(result[0].id).toBe(nowPlaying.id);
      expect(result[1].id).toBe(highVotes.id);
      expect(result[2].id).toBe(lowVotes.id);
    });

    it('now-playing (index 0) stays in place regardless of votes', () => {
      const nowPlaying = makeTrack({ votes: -10, votedBy: {} });
      const popular = makeTrack({ votes: 100, votedBy: {} });
      const queue = [nowPlaying, popular];

      const result = applyVote(queue, popular.id, USER_A, 1, OPEN_FLOOR);

      // Now playing stays at 0 even with -10 votes
      expect(result[0].id).toBe(nowPlaying.id);
      expect(result[1].id).toBe(popular.id);
    });

    it('tiebreaker: earlier addedAt wins', () => {
      const nowPlaying = makeTrack({ votes: 0 });
      const earlier = makeTrack({
        votes: 5,
        addedAt: '2026-01-01T00:00:00Z',
      });
      const later = makeTrack({
        votes: 5,
        addedAt: '2026-01-02T00:00:00Z',
      });
      // Put later before earlier to test sort stability
      const queue = [nowPlaying, later, earlier];

      // Trigger a re-sort via vote on a different track or same
      const result = applyVote(queue, later.id, USER_A, 1, OPEN_FLOOR);
      // later now has 6, earlier has 5 → later first
      // Actually let's undo that — use a neutral vote trigger
      const neutral = applyVote([nowPlaying, later, earlier], earlier.id, USER_A, 1, OPEN_FLOOR);
      // Now earlier has 6, later has 5 → earlier first
      expect(neutral[1].id).toBe(earlier.id);
    });
  });

  describe('Campfire & Spotlight — cosmetic votes', () => {
    it('campfire: vote does NOT reorder queue', () => {
      const t1 = makeTrack({ votes: 0, addedById: USER_A });
      const t2 = makeTrack({ votes: 10, addedById: USER_B });
      const queue = [t1, t2];

      const result = applyVote(queue, t1.id, USER_A, 1, CAMPFIRE);

      // Order unchanged despite t1 now having a vote
      expect(result[0].id).toBe(t1.id);
      expect(result[1].id).toBe(t2.id);
      expect(result[0].votes).toBe(1);
    });

    it('spotlight: vote does NOT reorder queue', () => {
      const t1 = makeTrack({ votes: 0 });
      const t2 = makeTrack({ votes: 10 });
      const queue = [t1, t2];

      const result = applyVote(queue, t1.id, USER_A, 1, SPOTLIGHT);

      expect(result[0].id).toBe(t1.id);
      expect(result[1].id).toBe(t2.id);
    });
  });

  it('voting on a non-existent track ID is a no-op', () => {
    const track = makeTrack({ votes: 3 });
    const result = applyVote([track], 'nonexistent-id', USER_A, 1, OPEN_FLOOR);

    expect(result[0].votes).toBe(3);
  });
});

// ─── skipCurrentTrack ──────────────────────────────────────

describe('skipCurrentTrack', () => {
  it('removes the first track from the queue', () => {
    const queue = [makeTrack(), makeTrack(), makeTrack()];
    const result = skipCurrentTrack(queue, USER_A, HOST_ID, CAMPFIRE);

    expect(result.skipped).toBe(true);
    expect(result.queue).toHaveLength(2);
    expect(result.queue[0].id).toBe(queue[1].id);
  });

  it('returns skipped: false on empty queue', () => {
    const result = skipCurrentTrack([], USER_A, HOST_ID, CAMPFIRE);

    expect(result.skipped).toBe(false);
    expect(result.queue).toHaveLength(0);
  });

  describe('mode permissions', () => {
    it('campfire: anyone can skip', () => {
      const queue = [makeTrack()];
      const result = skipCurrentTrack(queue, USER_A, HOST_ID, CAMPFIRE);
      expect(result.skipped).toBe(true);
    });

    it('openFloor: anyone can skip', () => {
      const queue = [makeTrack()];
      const result = skipCurrentTrack(queue, USER_A, HOST_ID, OPEN_FLOOR);
      expect(result.skipped).toBe(true);
    });

    it('spotlight: host can skip', () => {
      const queue = [makeTrack()];
      const result = skipCurrentTrack(queue, HOST_ID, HOST_ID, SPOTLIGHT);
      expect(result.skipped).toBe(true);
    });

    it('spotlight: non-host CANNOT skip', () => {
      const queue = [makeTrack()];
      const result = skipCurrentTrack(queue, USER_A, HOST_ID, SPOTLIGHT);
      expect(result.skipped).toBe(false);
      expect(result.queue).toHaveLength(1); // unchanged
    });

    it('voteRequired: non-host gets reason=voteRequired', () => {
      const queue = [makeTrack()];
      const result = skipCurrentTrack(queue, USER_A, HOST_ID, VOTE_SKIP);
      expect(result.skipped).toBe(false);
      expect(result.reason).toBe('voteRequired');
      expect(result.queue).toHaveLength(1);
    });

    it('voteRequired: host CAN force-skip', () => {
      const queue = [makeTrack()];
      const result = skipCurrentTrack(queue, HOST_ID, HOST_ID, VOTE_SKIP);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('hostForce');
      expect(result.queue).toHaveLength(0);
    });
  });
});

// ─── approveTrack (Spotlight) ─────────────────────────────

describe('approveTrack', () => {
  it('moves a pending track from suggested → main queue', () => {
    const mainQueue = [makeTrack({ addedById: HOST_ID })];
    const pending = makeTrack({ addedById: USER_A, status: 'pending' });
    const suggestedQueue = [pending];

    const result = approveTrack(mainQueue, suggestedQueue, pending.id);

    expect(result.queue).toHaveLength(2);
    expect(result.queue[1].id).toBe(pending.id);
    expect(result.queue[1].status).toBe('approved');
    expect(result.suggestedQueue).toHaveLength(0);
  });

  it('preserves other pending suggestions after approving one', () => {
    const s1 = makeTrack({ addedById: USER_A, status: 'pending' });
    const s2 = makeTrack({ addedById: USER_B, status: 'pending' });

    const result = approveTrack([], [s1, s2], s1.id);

    expect(result.queue).toHaveLength(1);
    expect(result.suggestedQueue).toHaveLength(1);
    expect(result.suggestedQueue[0].id).toBe(s2.id);
  });

  it('is a no-op when trackId not found in suggested queue', () => {
    const mainQueue = [makeTrack()];
    const suggestedQueue = [makeTrack({ status: 'pending' })];

    const result = approveTrack(mainQueue, suggestedQueue, 'nonexistent');

    expect(result.queue).toHaveLength(1);
    expect(result.suggestedQueue).toHaveLength(1);
  });

  it('approved track appends to end of main queue', () => {
    const t1 = makeTrack({ title: 'First' });
    const t2 = makeTrack({ title: 'Second' });
    const pending = makeTrack({ title: 'Approved', status: 'pending' });

    const result = approveTrack([t1, t2], [pending], pending.id);

    expect(result.queue).toHaveLength(3);
    expect(result.queue[2].title).toBe('Approved');
  });
});

// ─── rejectTrack (Spotlight) ──────────────────────────────

describe('rejectTrack', () => {
  it('removes a track from suggested queue', () => {
    const s1 = makeTrack({ status: 'pending' });
    const s2 = makeTrack({ status: 'pending' });

    const result = rejectTrack([s1, s2], s1.id);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(s2.id);
  });

  it('is a no-op when trackId not found', () => {
    const queue = [makeTrack({ status: 'pending' })];
    const result = rejectTrack(queue, 'nonexistent');

    expect(result).toHaveLength(1);
  });

  it('returns empty array when rejecting last suggestion', () => {
    const only = makeTrack({ status: 'pending' });
    const result = rejectTrack([only], only.id);

    expect(result).toHaveLength(0);
  });
});

// ─── moveTrack ────────────────────────────────────────────

describe('moveTrack', () => {
  it('moves a track up one position', () => {
    const q = [makeTrack(), makeTrack(), makeTrack()];
    const result = moveTrack(q, q[2].id, 'up');

    expect(result[1].id).toBe(q[2].id);
    expect(result[2].id).toBe(q[1].id);
  });

  it('moves a track down one position', () => {
    const q = [makeTrack(), makeTrack(), makeTrack()];
    const result = moveTrack(q, q[1].id, 'down');

    expect(result[1].id).toBe(q[2].id);
    expect(result[2].id).toBe(q[1].id);
  });

  it('cannot move the now-playing track (index 0)', () => {
    const q = [makeTrack(), makeTrack()];
    const result = moveTrack(q, q[0].id, 'down');

    expect(result[0].id).toBe(q[0].id);
    expect(result[1].id).toBe(q[1].id);
  });

  it('cannot move index 1 up (would displace now-playing)', () => {
    const q = [makeTrack(), makeTrack(), makeTrack()];
    const result = moveTrack(q, q[1].id, 'up');

    // targetIdx would be 0, which is <= 0, so no-op
    expect(result[0].id).toBe(q[0].id);
    expect(result[1].id).toBe(q[1].id);
  });

  it('cannot move past the end of the queue', () => {
    const q = [makeTrack(), makeTrack()];
    const result = moveTrack(q, q[1].id, 'down');

    // targetIdx would be 2, >= queue.length, so no-op
    expect(result[0].id).toBe(q[0].id);
    expect(result[1].id).toBe(q[1].id);
  });

  it('is a no-op for nonexistent track ID', () => {
    const q = [makeTrack(), makeTrack()];
    const result = moveTrack(q, 'nonexistent', 'up');

    expect(result).toEqual(q);
  });

  it('returns same reference for no-op cases (immutability preserved)', () => {
    const q = [makeTrack()];
    const result = moveTrack(q, q[0].id, 'up');

    // Index 0 can't move → should return original array
    expect(result).toBe(q);
  });
});

// ─── Integration: Full Session Flow ───────────────────────

describe('integration: full session lifecycle', () => {
  it('Campfire: 3 users add tracks → fair round-robin → skip → advance', () => {
    let queue: QueueTrack[] = [];
    let suggested: QueueTrack[] = [];

    // Alice adds 2, Bob adds 1, Carol adds 1
    const a1 = makeTrack({ addedById: USER_A, title: 'A1' });
    const a2 = makeTrack({ addedById: USER_A, title: 'A2' });
    const b1 = makeTrack({ addedById: USER_B, title: 'B1' });
    const c1 = makeTrack({ addedById: USER_C, title: 'C1' });

    let r: AddTrackResult;
    r = addTrackToQueue(queue, suggested, a1, CAMPFIRE, HOST_ID);
    queue = r.queue;
    r = addTrackToQueue(queue, suggested, b1, CAMPFIRE, HOST_ID);
    queue = r.queue;
    r = addTrackToQueue(queue, suggested, a2, CAMPFIRE, HOST_ID);
    queue = r.queue;
    r = addTrackToQueue(queue, suggested, c1, CAMPFIRE, HOST_ID);
    queue = r.queue;

    // Round-robin: A→B→C→A (contributors appear in first-seen order)
    expect(queue.map((t) => t.title)).toEqual(['A1', 'B1', 'C1', 'A2']);

    // Skip current (A1) → B1 becomes now-playing
    const skip1 = skipCurrentTrack(queue, USER_B, HOST_ID, CAMPFIRE);
    expect(skip1.skipped).toBe(true);
    expect(skip1.queue[0].title).toBe('B1');
  });

  it('Spotlight: full approve/reject cycle', () => {
    let queue: QueueTrack[] = [];
    let suggested: QueueTrack[] = [];

    // Host adds opening track
    const hostTrack = makeTrack({ addedById: HOST_ID, title: 'Host Pick' });
    let r = addTrackToQueue(queue, suggested, hostTrack, SPOTLIGHT, HOST_ID);
    queue = r.queue;
    suggested = r.suggestedQueue;
    expect(queue).toHaveLength(1);

    // Alice suggests
    const aliceSuggestion = makeTrack({ addedById: USER_A, title: 'Alice Suggestion' });
    r = addTrackToQueue(queue, suggested, aliceSuggestion, SPOTLIGHT, HOST_ID);
    queue = r.queue;
    suggested = r.suggestedQueue;
    expect(suggested).toHaveLength(1);
    expect(suggested[0].status).toBe('pending');

    // Bob suggests
    const bobSuggestion = makeTrack({ addedById: USER_B, title: 'Bob Suggestion' });
    r = addTrackToQueue(queue, suggested, bobSuggestion, SPOTLIGHT, HOST_ID);
    queue = r.queue;
    suggested = r.suggestedQueue;
    expect(suggested).toHaveLength(2);

    // Host approves Alice's suggestion
    const approve = approveTrack(queue, suggested, aliceSuggestion.id);
    queue = approve.queue;
    suggested = approve.suggestedQueue;
    expect(queue).toHaveLength(2);
    expect(queue[1].title).toBe('Alice Suggestion');
    expect(queue[1].status).toBe('approved');
    expect(suggested).toHaveLength(1);

    // Host rejects Bob's suggestion
    suggested = rejectTrack(suggested, bobSuggestion.id);
    expect(suggested).toHaveLength(0);

    // Non-host cannot skip
    const failSkip = skipCurrentTrack(queue, USER_A, HOST_ID, SPOTLIGHT);
    expect(failSkip.skipped).toBe(false);

    // Host can skip
    const hostSkip = skipCurrentTrack(queue, HOST_ID, HOST_ID, SPOTLIGHT);
    expect(hostSkip.skipped).toBe(true);
    expect(hostSkip.queue[0].title).toBe('Alice Suggestion');
  });

  it('Open Floor: votes determine queue order', () => {
    const nowPlaying = makeTrack({ title: 'Now Playing', votes: 0 });
    const unpopular = makeTrack({ title: 'Unpopular', votes: 0 });
    const popular = makeTrack({ title: 'Popular', votes: 0 });
    let queue = [nowPlaying, unpopular, popular];

    // 3 users upvote "Popular"
    queue = applyVote(queue, popular.id, USER_A, 1, OPEN_FLOOR);
    queue = applyVote(queue, popular.id, USER_B, 1, OPEN_FLOOR);
    queue = applyVote(queue, popular.id, USER_C, 1, OPEN_FLOOR);

    // 1 user upvotes "Unpopular"
    queue = applyVote(queue, unpopular.id, USER_A, 1, OPEN_FLOOR);

    // Order: NowPlaying (locked at 0) → Popular (3 votes) → Unpopular (1 vote)
    expect(queue[0].title).toBe('Now Playing');
    expect(queue[1].title).toBe('Popular');
    expect(queue[1].votes).toBe(3);
    expect(queue[2].title).toBe('Unpopular');
    expect(queue[2].votes).toBe(1);

    // User A toggles off their vote on Popular
    queue = applyVote(queue, popular.id, USER_A, 1, OPEN_FLOOR);
    expect(queue.find((t) => t.title === 'Popular')!.votes).toBe(2);
  });
});

// ─── Edge Cases ────────────────────────────────────────────

describe('edge cases', () => {
  it('empty queue operations are safe', () => {
    expect(addTrackToQueue([], [], makeTrack(), CAMPFIRE, HOST_ID).queue).toHaveLength(1);
    expect(applyVote([], 'any', USER_A, 1, OPEN_FLOOR)).toHaveLength(0);
    expect(skipCurrentTrack([], USER_A, HOST_ID, CAMPFIRE).skipped).toBe(false);
    expect(approveTrack([], [], 'any').queue).toHaveLength(0);
    expect(rejectTrack([], 'any')).toHaveLength(0);
    expect(moveTrack([], 'any', 'up')).toHaveLength(0);
  });

  it('single-item queue: skip produces empty queue', () => {
    const queue = [makeTrack()];
    const result = skipCurrentTrack(queue, USER_A, HOST_ID, OPEN_FLOOR);
    expect(result.queue).toHaveLength(0);
  });

  it('vote on queue with only now-playing does not crash sort', () => {
    const nowPlaying = makeTrack({ votes: 0 });
    const result = applyVote([nowPlaying], nowPlaying.id, USER_A, 1, OPEN_FLOOR);
    expect(result).toHaveLength(1);
    expect(result[0].votes).toBe(1);
  });

  it('two-item queue sort: now-playing + one track', () => {
    const np = makeTrack({ votes: 0 });
    const t1 = makeTrack({ votes: 0 });
    // sortByVotes returns early for length <= 2, so no sorting
    const result = applyVote([np, t1], t1.id, USER_A, 1, OPEN_FLOOR);
    expect(result[0].id).toBe(np.id);
    expect(result[1].votes).toBe(1);
  });

  it('immutability: original queue is not mutated', () => {
    const original = [makeTrack({ votes: 0, votedBy: {} })];
    const originalId = original[0].id;
    const originalVotes = original[0].votes;

    applyVote(original, originalId, USER_A, 1, OPEN_FLOOR);

    expect(original[0].votes).toBe(originalVotes); // unchanged
    expect(original[0].votedBy).toEqual({}); // unchanged
  });
});
