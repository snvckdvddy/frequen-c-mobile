/**
 * Queue Engine — Behavioral Toggles Architecture
 *
 * Pure functions that govern how tracks enter, move, and leave the queue
 * based on granular behavioral toggles (not rigid room modes).
 * No side effects, no state — fully testable.
 *
 * Queue Ordering Strategies:
 *   roundRobin   — Interleave tracks by contributor (fair turns)
 *   voteWeighted — Votes reorder the queue (democratic)
 *   fifo         — First in, first out (position order)
 *
 * Approval Gate:
 *   requiresApproval=true — Non-host additions go to suggestedQueue
 *   requiresApproval=false — All additions go directly to queue
 *
 * Skip Access:
 *   anyone       — Any participant can skip
 *   hostOnly     — Only the host can skip
 *   voteRequired — Skip requires majority vote (future)
 */

import type { QueueTrack, RoomBehaviors, DEFAULT_BEHAVIORS } from '../types';

// ─── Result type for addTrackToQueue ────────────────────────
export interface AddTrackResult {
  queue: QueueTrack[];
  suggestedQueue: QueueTrack[];
  /** Where the track landed */
  destination: 'queue' | 'suggested';
}

// ─── Add Track ──────────────────────────────────────────────
/**
 * Insert a track into the queue according to behavioral toggles.
 *
 * requiresApproval=true + non-host → suggested queue (pending).
 * Otherwise → main queue, ordered by queueOrdering strategy.
 */
export function addTrackToQueue(
  queue: QueueTrack[],
  suggestedQueue: QueueTrack[],
  track: QueueTrack,
  behaviors: RoomBehaviors,
  hostId: string
): AddTrackResult {
  // Approval gate: non-host adds need approval when toggle is on
  if (behaviors.requiresApproval && track.addedById !== hostId) {
    const pendingTrack: QueueTrack = { ...track, status: 'pending' };
    return {
      queue,
      suggestedQueue: [...suggestedQueue, pendingTrack],
      destination: 'suggested',
    };
  }

  // Track goes directly to queue
  const appended = [...queue, track];

  // Apply ordering strategy
  switch (behaviors.queueOrdering) {
    case 'roundRobin':
      return { queue: interleaveRoundRobin(appended), suggestedQueue, destination: 'queue' };
    case 'voteWeighted':
      return { queue: appended, suggestedQueue, destination: 'queue' }; // votes handle sorting separately
    case 'fifo':
    default:
      return { queue: appended, suggestedQueue, destination: 'queue' };
  }
}

// ─── Apply Vote ─────────────────────────────────────────────
/**
 * Toggle-aware voting. One vote per user per track.
 *
 * When voteReordersQueue is true, re-sort by votes after update.
 * When false, votes are still tracked (cosmetic/social signal) but don't reorder.
 */
export function applyVote(
  queue: QueueTrack[],
  trackId: string,
  userId: string,
  direction: 1 | -1,
  behaviors: RoomBehaviors
): QueueTrack[] {
  const updated = queue.map((t) => {
    if (t.id !== trackId) return t;

    const votedBy = { ...(t.votedBy || {}) };
    const prev = votedBy[userId];
    let delta = 0;

    if (prev === direction) {
      // Same direction again → undo vote
      delete votedBy[userId];
      delta = -direction;
    } else if (prev === undefined) {
      // No prior vote → add
      votedBy[userId] = direction;
      delta = direction;
    } else {
      // Opposite direction → undo current vote
      delete votedBy[userId];
      delta = -prev;
    }

    return { ...t, votes: (t.votes ?? 0) + delta, votedBy };
  });

  // Only re-sort if the toggle says votes have queue impact
  if (behaviors.voteReordersQueue) {
    return sortByVotes(updated);
  }

  return updated;
}

// ─── Skip Current Track ─────────────────────────────────────
/**
 * Remove the first track from the queue.
 *
 * Checks skipAccess toggle:
 *   'anyone' — any participant can skip
 *   'hostOnly' — only the host
 *   'voteRequired' — host can force-skip; others must use vote-skip
 */
export function skipCurrentTrack(
  queue: QueueTrack[],
  userId: string,
  hostId: string,
  behaviors: RoomBehaviors
): { queue: QueueTrack[]; skipped: boolean; reason?: string } {
  if (queue.length === 0) return { queue, skipped: false };

  if (behaviors.skipAccess === 'hostOnly' && userId !== hostId) {
    return { queue, skipped: false, reason: 'hostOnly' };
  }

  if (behaviors.skipAccess === 'voteRequired') {
    // Host can force-skip; everyone else uses the vote-skip system
    if (userId === hostId) {
      return { queue: queue.slice(1), skipped: true, reason: 'hostForce' };
    }
    return { queue, skipped: false, reason: 'voteRequired' };
  }

  return { queue: queue.slice(1), skipped: true };
}

// ─── Approve Track (when requiresApproval is on) ────────────
/**
 * Move a track from suggestedQueue → mainQueue.
 * Sets status to 'approved'.
 */
export function approveTrack(
  queue: QueueTrack[],
  suggestedQueue: QueueTrack[],
  trackId: string
): { queue: QueueTrack[]; suggestedQueue: QueueTrack[] } {
  const track = suggestedQueue.find((t) => t.id === trackId);
  if (!track) return { queue, suggestedQueue };

  const approved: QueueTrack = { ...track, status: 'approved' };
  return {
    queue: [...queue, approved],
    suggestedQueue: suggestedQueue.filter((t) => t.id !== trackId),
  };
}

// ─── Reject Track ───────────────────────────────────────────
/**
 * Remove a track from suggestedQueue entirely.
 */
export function rejectTrack(
  suggestedQueue: QueueTrack[],
  trackId: string
): QueueTrack[] {
  return suggestedQueue.filter((t) => t.id !== trackId);
}

// ─── Move Track (Manual Reorder) ────────────────────────
/**
 * Move a track up or down in the queue.
 * Cannot move past position 0 (now playing stays put).
 */
export function moveTrack(
  queue: QueueTrack[],
  trackId: string,
  direction: 'up' | 'down'
): QueueTrack[] {
  const idx = queue.findIndex((t) => t.id === trackId);
  if (idx < 0) return queue;
  if (idx === 0) return queue;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx <= 0) return queue;
  if (targetIdx >= queue.length) return queue;

  const next = [...queue];
  [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
  return next;
}

// ─── Internal: Round-Robin Interleave ───────────────────────
/**
 * Interleave tracks so contributors take turns.
 * Preserves relative order within each contributor's tracks.
 */
function interleaveRoundRobin(queue: QueueTrack[]): QueueTrack[] {
  if (queue.length <= 1) return queue;

  const groups = new Map<string, QueueTrack[]>();
  const contributorOrder: string[] = [];

  for (const track of queue) {
    const key = track.addedById;
    if (!groups.has(key)) {
      groups.set(key, []);
      contributorOrder.push(key);
    }
    groups.get(key)!.push(track);
  }

  if (groups.size <= 1) return queue;

  const result: QueueTrack[] = [];
  let remaining = queue.length;

  while (remaining > 0) {
    for (const contributor of contributorOrder) {
      const tracks = groups.get(contributor)!;
      if (tracks.length > 0) {
        result.push(tracks.shift()!);
        remaining--;
      }
    }
  }

  return result;
}

// ─── Internal: Sort by Votes ────────────────────────────────
/**
 * Sort queue by votes descending. Tiebreaker: earlier addedAt wins.
 * The first track (now playing) stays in place — only sort queue[1..n].
 */
function sortByVotes(queue: QueueTrack[]): QueueTrack[] {
  if (queue.length <= 2) return queue;

  const [nowPlaying, ...rest] = queue;

  rest.sort((a, b) => {
    const votesDiff = (b.votes ?? 0) - (a.votes ?? 0);
    if (votesDiff !== 0) return votesDiff;
    return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
  });

  return [nowPlaying, ...rest];
}
