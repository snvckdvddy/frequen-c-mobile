/**
 * UnplayableSkipGuard: decides whether the host may auto-skip a track
 * that won't play.
 *
 * Skipping a dead SoundCloud track is cheap and right, but two things can
 * turn it into a loop or a bonfire:
 *
 *   1. The same queue entry coming back. If the server declines the
 *      advance (a Phase Cancel shield, a reconnect that re-sends the old
 *      current track), the host's queue snaps back to the dead track,
 *      which fails again, which skips again. Every queue entry is
 *      auto-skipped at most once ('already-tried').
 *
 *   2. A systemic failure that looks like a dead track: the Widget script
 *      never loads, the host is offline. Every track "fails", and skipping
 *      each one would burn the whole queue. After MAX_CONSECUTIVE_AUTO_SKIPS
 *      failures in a row with nothing playing in between, auto-skip stops
 *      ('streak-limit') and the host is told. A real track starting to play
 *      resets the streak.
 *
 * Plain TS with no React or native imports, so it is unit-testable.
 */

import type { UnplayableEvent } from './PlaybackBackend';

/** Dead tracks in a row before auto-skip gives up and hands control back. */
export const MAX_CONSECUTIVE_AUTO_SKIPS = 3;

export type UnplayableDecision =
  | 'skip'           // advance the queue past this track
  | 'already-tried'  // this entry was auto-skipped before; leave it for the host
  | 'streak-limit';  // too many dead tracks in a row; leave it for the host

export class UnplayableSkipGuard {
  private readonly tried = new Set<string>();
  private streak = 0;

  constructor(private readonly maxStreak: number = MAX_CONSECUTIVE_AUTO_SKIPS) {}

  /** What to do about this unplayable queue entry. 'skip' records the attempt. */
  evaluate(queueTrackId: string): UnplayableDecision {
    if (this.tried.has(queueTrackId)) return 'already-tried';
    if (this.streak >= this.maxStreak) return 'streak-limit';

    this.tried.add(queueTrackId);
    this.streak += 1;
    return 'skip';
  }

  /** A track is genuinely playing, so the failures so far were the tracks, not the setup. */
  recordPlayback(): void {
    this.streak = 0;
  }

  /** Forget everything (new session, or this device stopped hosting). */
  reset(): void {
    this.tried.clear();
    this.streak = 0;
  }
}

/** What the host is told for each way an unplayable track can be handled. */
export const UNPLAYABLE_MESSAGE: Record<UnplayableDecision, string> = {
  skip: "Can't play this track. Skipping.",
  'already-tried': "Can't play this track.",
  'streak-limit': 'Tracks keep failing to play. Skip this one yourself.',
};

export interface UnplayableHandlerDeps {
  guard: UnplayableSkipGuard;
  /** Queue-track ID the engine currently has loaded. */
  getCurrentTrackId: () => string | null;
  /** Tell the host (a toast). */
  notify: (message: string) => void;
  /** Move past the track: advance the local queue and tell the server. */
  advance: () => void;
}

/**
 * Act on an "unplayable" verdict from the engine. Returns what happened:
 * 'stale' when the verdict is for a track that is no longer current
 * (nothing is done), otherwise the guard's decision. The host is told in
 * every non-stale case; the queue only advances on 'skip'.
 */
export function handleUnplayableTrack(
  event: Pick<UnplayableEvent, 'trackId'>,
  deps: UnplayableHandlerDeps,
): UnplayableDecision | 'stale' {
  if (event.trackId !== deps.getCurrentTrackId()) return 'stale';

  const decision = deps.guard.evaluate(event.trackId);
  deps.notify(UNPLAYABLE_MESSAGE[decision]);
  if (decision === 'skip') deps.advance();
  return decision;
}
