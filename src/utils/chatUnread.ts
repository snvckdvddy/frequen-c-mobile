/**
 * Chat unread counting.
 *
 * Unread = chat lines from OTHER users that this user has not seen. "Seen" is
 * tracked by message id rather than by comparing the log length against a
 * snapshot, because the log that useSessionRoom exposes is not stable:
 *
 *  - the server replays its last 50 messages on every join-session, and the
 *    client re-sends join-session on every socket reconnect, so the whole
 *    log is replaced mid-session;
 *  - the server echoes a sender's own messages back to them;
 *  - leaving a room clears the log and rejoining reseeds it from history.
 *
 * A length diff miscounts in each case: own messages count, the replay
 * re-counts what was already read, and a replayed log that is shorter than
 * the old snapshot hides new messages until it grows past it.
 */

import type { ChatMessage } from '../types';

/** The only fields counting needs, so callers and tests can pass light objects. */
export type ChatLine = Pick<ChatMessage, 'id' | 'userId' | 'type'>;

// ─── Pure counting ──────────────────────────────────────────

/** True for a line that can ever be unread: a real message from someone else. */
export function isOtherUsersMessage(
  msg: ChatLine,
  selfUserId: string | null | undefined,
): boolean {
  // Without our own id we cannot tell own lines from others', so count none
  // rather than flash a wrong badge. A room cannot be joined without a user.
  if (!selfUserId || !msg.id) return false;
  return msg.type !== 'system' && msg.userId !== selfUserId;
}

/** How many of the log's lines are from other users and not in `seen`. */
export function countUnreadChat(
  log: readonly ChatLine[],
  seen: ReadonlySet<string>,
  selfUserId: string | null | undefined,
): number {
  // A Set so a line delivered twice (history replay plus a live event) is one.
  const unread = new Set<string>();
  for (const msg of log) {
    if (isOtherUsersMessage(msg, selfUserId) && !seen.has(msg.id)) unread.add(msg.id);
  }
  return unread.size;
}

/** How many seen ids that have already left the log are kept, so a rejoin replay stays seen. */
export const MAX_CARRIED_SEEN = 100;

/**
 * Returns `seen` plus every other-user line currently in the log. Returns the
 * same set instance when nothing is new, so store subscribers do not re-render.
 *
 * Everything still in the log is always kept. Ids that have left the log are
 * only worth keeping for a rejoin, where the server replays at most its last
 * 50 messages, so only the newest MAX_CARRIED_SEEN of those are carried.
 */
export function markChatSeen(
  seen: ReadonlySet<string>,
  log: readonly ChatLine[],
  selfUserId: string | null | undefined,
): ReadonlySet<string> {
  const inLog: string[] = [];
  let hasNew = false;
  for (const msg of log) {
    if (!isOtherUsersMessage(msg, selfUserId)) continue;
    inLog.push(msg.id);
    if (!seen.has(msg.id)) hasNew = true;
  }
  if (!hasNew) return seen;

  const inLogSet = new Set(inLog);
  const carried: string[] = [];
  for (const id of seen) {
    if (!inLogSet.has(id)) carried.push(id);
  }
  return new Set([...carried.slice(-MAX_CARRIED_SEEN), ...inLog]);
}

// ─── Seen store ─────────────────────────────────────────────
// Module-level on purpose: SessionRoomScreen remounts on navigation (the old
// component-state snapshot reset to 0 each time, re-counting everything) and
// a leave/rejoin of the same room clears the hook's log. Seen ids survive
// both. They do not survive an app restart.

/** Rooms remembered at once; the least recently updated is dropped first. */
export const MAX_TRACKED_ROOMS = 20;

const EMPTY_SEEN: ReadonlySet<string> = new Set();
const seenByRoom = new Map<string, ReadonlySet<string>>();
const listeners = new Set<() => void>();

/** Store key for one user in one room, or null when either id is missing. */
export function chatSeenKey(
  selfUserId: string | null | undefined,
  sessionId: string | null | undefined,
): string | null {
  return selfUserId && sessionId ? `${selfUserId}:${sessionId}` : null;
}

/** Current seen set. Stable between changes, as useSyncExternalStore requires. */
export function getChatSeen(key: string | null): ReadonlySet<string> {
  return (key && seenByRoom.get(key)) || EMPTY_SEEN;
}

/** Marks every other-user line in the log as seen for this key and notifies subscribers. */
export function recordChatSeen(
  key: string,
  log: readonly ChatLine[],
  selfUserId: string | null | undefined,
): void {
  const prev = getChatSeen(key);
  const next = markChatSeen(prev, log, selfUserId);
  if (next === prev) return;

  // Delete first so an updated room moves to the back of the eviction order.
  seenByRoom.delete(key);
  seenByRoom.set(key, next);
  while (seenByRoom.size > MAX_TRACKED_ROOMS) {
    let oldest: string | null = null;
    for (const k of seenByRoom.keys()) {
      oldest = k;
      break;
    }
    if (oldest === null) break;
    seenByRoom.delete(oldest);
  }
  listeners.forEach((fn) => fn());
}

/** Subscribe to seen-set changes. Returns the unsubscribe function. */
export function subscribeChatSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
