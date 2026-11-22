/**
 * Pure decisions behind the room hook's socket handlers and the room screen:
 * what to say when a track is skipped, when "track ended" is true, how a
 * guest's playback clock reacts to track changes and host position reports,
 * and when the screen must not paint because the provider still holds the
 * previous room. Kept free of React and React Native so the rules can be
 * unit tested.
 */

// ─── Room switch ────────────────────────────────────────────

/**
 * True while the provider still holds a different room than the route asks
 * for. The provider outlives every screen and keeps the previous room's
 * state (session, queue, chat, an undismissed receipt) until its connection
 * switches and its per-session reset lands, a couple of renders after the new
 * screen first renders. Painting in that window shows the old room, or its
 * receipt, in the new room's place. Nothing loaded yet is not "another room":
 * the screen's own loading and error states cover that.
 */
export function providerHoldsOtherRoom(input: {
  routeSessionId: string | null | undefined;
  connectionId: string | null | undefined;
  loadedSessionId: string | null | undefined;
}): boolean {
  const { routeSessionId, connectionId, loadedSessionId } = input;
  if (!routeSessionId) return false;
  return (
    connectionId !== routeSessionId ||
    (!!loadedSessionId && loadedSessionId !== routeSessionId)
  );
}

// ─── Skip attribution ───────────────────────────────────────

/** What the server sends with `track-skipped`. It names the skipper by id, never by username. */
export interface TrackSkippedPayload {
  userId?: string;
  forced?: boolean;
  voteSkip?: boolean;
  votes?: number;
}

export interface SkipContext {
  selfId: string | undefined;
  selfUsername: string | undefined;
  /** Resolve a user id to a display name from whatever the room has shown us. */
  lookupUsername: (userId: string) => string | undefined;
}

/**
 * The line to show when a track is skipped, or null when there is nothing to
 * say. The skipper is announced to everyone, including themselves: their own
 * device used to show "Preview ended" instead, because the local advance was
 * the only thing that spoke.
 */
export function describeTrackSkipped(
  data: TrackSkippedPayload | null | undefined,
  ctx: SkipContext,
): string | null {
  if (!data) return null;
  if (data.voteSkip) {
    return `Track skipped by vote${data.votes ? ` (${data.votes} votes)` : ''}.`;
  }
  if (!data.userId) return null;
  const name = data.userId === ctx.selfId ? ctx.selfUsername : ctx.lookupUsername(data.userId);
  return name ? `${name} skipped` : 'Track skipped.';
}

// ─── Track end announcement ─────────────────────────────────

/** Why the local queue advanced. A skip is announced by who skipped, not as an ending. */
export type AdvanceReason = 'ended' | 'skip';

/**
 * Whether the local queue advance should announce that the track ended.
 * Only the host's engine ends tracks, and only when nobody skipped: on a
 * guest every advance is a skip, and a skip is not a "preview ended".
 */
export function shouldAnnounceTrackEnd(reason: AdvanceReason, isHostDevice: boolean): boolean {
  return reason !== 'skip' && isHostDevice;
}

// ─── Guest playback clock ───────────────────────────────────

/** The slice of the playback state a guest's clock cares about. */
export interface PlaybackClock {
  isPlaying: boolean;
  elapsed: number;
  progress: number;
}

/**
 * Elapsed seconds after a host position report. Zero is a real position (a
 * track that just started); only a missing or non-finite value keeps the
 * previous one. The handler used `position || previous`, which read every
 * report of 0 as "no value" and held the old song's elapsed time into the
 * new one.
 */
export function resolveSyncedElapsed(
  position: number | null | undefined,
  previousElapsed: number,
): number {
  return typeof position === 'number' && Number.isFinite(position)
    ? Math.max(0, position)
    : previousElapsed;
}

/**
 * Whether the current track changing should restart the clock. Only a guest's
 * clock: the host's is the engine's and is replaced wholesale. And only a real
 * change: the server repeats the current track on reconnect, and that is not
 * a new song.
 */
export function shouldResetGuestClock(input: {
  isHostDevice: boolean;
  previousTrackId: string | null;
  nextTrackId: string | null;
}): boolean {
  return !input.isHostDevice && input.previousTrackId !== input.nextTrackId;
}

/**
 * Playback state for a guest right after the current track changed. The new
 * track starts at zero; with no track at all nothing is playing. Returns the
 * same object when nothing would change so React can skip the render.
 */
export function resetPlaybackForTrackChange<T extends PlaybackClock>(
  prev: T,
  hasTrack: boolean,
): T {
  const isPlaying = hasTrack ? prev.isPlaying : false;
  if (prev.elapsed === 0 && prev.progress === 0 && prev.isPlaying === isPlaying) return prev;
  return { ...prev, elapsed: 0, progress: 0, isPlaying };
}
