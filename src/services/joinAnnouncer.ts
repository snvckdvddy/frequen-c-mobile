/**
 * Join announcements: decides which participant-joined events the host
 * should hear about (the "X joined" toast and the device notification).
 *
 * The server announces a user whenever they arrive with no live socket in the
 * room. A locked phone causes exactly that on its own: the OS freezes the app,
 * the server drops the dead socket after its ping timeout and broadcasts
 * participant-left, and unlocking reconnects and broadcasts participant-joined.
 * Both events are true, but the second is a guest coming back, not a new
 * arrival. Announcing it on every unlock buried the host in "joined" alerts.
 *
 * Rule: a join is news only if we have seen no join or leave for that id in
 * the last REJOIN_QUIET_MS. Every event, announced or not, restarts that
 * clock, so a guest whose phone keeps sleeping and waking stays quiet as long
 * as the gaps stay under the window, while one who has been gone longer counts
 * as arriving again.
 *
 * Pure and clock-injected so it can be tested without timers or React.
 */

/**
 * How long after a user's last join or leave a new join still counts as the
 * same visit. Must comfortably exceed a locked phone's round trip: the server
 * drops the socket within about a minute of the lock, and a guest can leave the
 * phone asleep for many minutes before checking it.
 */
export const REJOIN_QUIET_MS = 10 * 60 * 1000;

export class JoinAnnouncer {
  private readonly lastEventAt = new Map<string, number>();
  private readonly quietMs: number;

  constructor(quietMs: number = REJOIN_QUIET_MS) {
    this.quietMs = quietMs;
  }

  /**
   * Record a participant-joined event. Returns true when the host should be
   * told: nothing has been seen for this id, or the last event was at least
   * quietMs ago.
   */
  onJoined(id: string, now: number): boolean {
    const last = this.lastEventAt.get(id);
    this.lastEventAt.set(id, now);
    return last === undefined || now - last >= this.quietMs;
  }

  /** Record a participant-left event so a quick return reads as a reconnect. */
  onLeft(id: string, now: number): void {
    this.lastEventAt.set(id, now);
  }
}
