/**
 * Queue Engine — Room Mode Physics
 *
 * Pure functions that govern how tracks enter, move, and leave the queue
 * based on the active room mode. No side effects, no state — fully testable.
 *
 * Campfire \uD83D\uDD25  — Round-robin interleaving by contributor
 * Spotlight \uD83C\uDFA4 — Host curates; non-host additions go to suggestions
 * Open Floor \u26A1 — Votes reorder the queue; democratic free-for-all
 */

import type { QueueTrack, RoomMode } from '../types';

// ─── Result type for addTrackToQueue ────────────────────────
// Spotlight mode may return a track in suggestedQueue instead of mainQueue.
export interface AddTrackResult {
  queue: QueueTrack[];
  suggestedQueue: QueueTrack[];
  /** Where the track landed */
  destination: 'queue' | 'suggested';
}

// ─── Add Track ──────────────────────────────────────────────
/**
 * Insert a track into the queue according to room mode rules.
 *
 * Campfire:   Append then interleave round-robin by contributor.
 * Spotlight:  Host → direct to queue. Non-host → suggested queue (pending).
 * Open Floor: Straight append (votes handle ordering separately).
 */
export function addTrackToQueue(
  queue: QueueTrack[],
  suggestedQueue: QueueTrack[],
  track: QueueTrack,
  roomMode: RoomMode,
  hostId: string
): AddTrackResult {
  switch (roomMode) {
    case 'campfire': {
      const appended = [...queue, track];
      return {
        queue: interleaveRoundRobin(appended),
        suggestedQueue,
        destination: 'queue',
      };
    }

    case 'spotlight': {
      if (track.addedById === hostId) {
        // Host additions go directly to the queue
        return {
          queue: [...queue, track],
          suggestedQueue,
          destination: 'queue',
        };
      }
      // Non-host additions go to the suggested queue as pending
      const pendingTrack: QueueTrack = { ...track, status: 'pending' };
      return {
        queue,
        suggestedQueue: [...suggestedQueue, pendingTrack],
        destination: 'suggested',
      };
    }

    case 'openFloor':
    default:
      return {
        queue: [...queue, track],
        suggestedQueue,
        destination: 'queue',
      };
  }
}

// ─── Apply Vote ─────────────────────────────────────────────
/**
 * Toggle-aware voting. One vote per user per track.
 *
 * - Same direction again → undo (remove vote)
 * - Opposite direction → switch vote
 * - No prior vote → add vote
 *
 * In Open Floor mode, re-sort by votes after update.
 * Campfire & Spotlight: votes are cosmetic only (no reorder).
 */
export function applyVote(
  queue: QueueTrack[],
  trackId: string,
  userId: string,
  direction: 1 | -1,
  roomMode: RoomMode
): QueueTrack[] {
  const updated = queue.map((t) => {
    if (t.id !== trackId) return t;

    const votedBy = { ...(t.votedBy || {}) };
    const prev = votedBy[userId]; // undefined | 1 | -1
    let delta = 0;

    if (prev === direction) {
      // Same direction again → undo vote
      delete votedBy[userId];
      delta = -direction; // reverse the prior vote
    } else if (prev === undefined) {
      // No prior vote → add
      votedBy[userId] = direction;
      delta = direction;
    } else {
      // Opposite direction → just undo current vote (tap again to vote new direction)
      delete votedBy[userId];
      delta = -prev; // remove the old vote, don't auto-apply new one
    }

    return { ...t, votes: (t.votes ?? 0) + delta, votedBy };
  });

  if (roomMode === 'openFloor') {
    return sortByVotes(updated);
  }

  // Campfire & Spotlight: votes don't reorder
  return updated;
}

// ─── Skip Current Track ─────────────────────────────────────
/**
 * Remove the first track from the queue.
 *
 * Campfire & Open Floor: Anyone can skip.
 * Spotlight: Only the host can skip. Non-host calls are no-ops.
 *
 * Returns { queue, skipped } so the caller knows if the skip happened.
 */
export function skipCurrentTrack(
  queue: QueueTrack[],
  userId: string,
  hostId: string,
  roomMode: RoomMode
): { queue: QueueTrack[]; skipped: boolean } {
  if (queue.length === 0) return { queue, skipped: false };

  if (roomMode === 'spotlight' && userId !== hostId) {
    // Non-host can't skip in Spotlight mode
    return { queue, skipped: false };
  }

  return { queue: queue.slice(1), skipped: true };
}

// ─── Approve Track (Spotlight only) ─────────────────────────
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

// ─── Reject Track (Spotlight only) ──────────────────────────
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
 * Returns the new queue.
 */
export function moveTrack(
  queue: QueueTrack[],
  trackId: string,
  direction: 'up' | 'down'
): QueueTrack[] {
  const idx = queue.findIndex((t) => t.id === trackId);
  if (idx < 0) return queue;

  // Can't move now-playing (index 0)
  if (idx === 0) return queue;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;

  // Can't move above now-playing (idx 1 can't go to 0)
  if (targetIdx <= 0) return queue;
  // Can't move past end
  if (targetIdx >= queue.length) return queue;

  const next = [...queue];
  [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
  return next;
}

// ─── Internal: Round-Robin Interleave ───────────────────────
/**
 * Interleave tracks so contributors take turns.
 * If Alice added 3 and Bob added 1: Alice → Bob → Alice → Alice
 * Preserves relative order within each contributor's tracks.
 */
function interleaveRoundRobin(queue: QueueTrack[]): QueueTrack[] {
  if (queue.length <= 1) return queue;

  // Group tracks by contributor, preserving order within each group
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

  // If only one contributor, nothing to interleave
  if (groups.size <= 1) return queue;

  // Round-robin: pick one track from each contributor in order, repeat
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

// ─── Internal: Sort by Votes (Open Floor) ───────────────────
/**
 * Sort queue by votes descending. Tiebreaker: earlier addedAt wins.
 * The first track (now playing) stays in place — only sort queue[1..n].
 */
function sortByVotes(queue: QueueTrack[]): QueueTrack[] {
  if (queue.length <= 2) return queue;

  // Keep the first track (now playing) in place
  const [nowPlaying, ...rest] = queue;

  rest.sort((a, b) => {
    const votesDiff = (b.votes ?? 0) - (a.votes ?? 0);
    if (votesDiff !== 0) return votesDiff;
    // Tiebreaker: earlier addedAt stays higher
    return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
  });

  return [nowPlaying, ...rest];
}
