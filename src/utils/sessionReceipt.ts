/**
 * Session receipt bookkeeping (Master Bounce).
 *
 * The receipt used to be assembled at render time from whatever the room
 * screen held when the end arrived: the live roster (the host has already
 * left it by then, so the host showed as "Host" and the head count shrank),
 * a played-history list that only the host's engine ever filled, the
 * screen's mount time as the session start, and the user's lifetime CV
 * balance as "earned". Worse, the in-memory "show the receipt" flag was not
 * tied to any session, so it survived into the next room.
 *
 * This module keeps a per-session ledger instead. The room hook feeds it as
 * events arrive and freezes it into a snapshot, stamped with the id of the
 * session it belongs to, the moment the room ends.
 *
 * Pure TypeScript with no React Native imports, so it runs under Jest.
 */

import type { QueueTrack, RoomBehaviors, RoomMode, Session } from '../types';
import { DEFAULT_BEHAVIORS } from '../types';
import { parseServerTimestamp } from './serverTime';

/**
 * A track counts as played once playback has reached this many seconds.
 * Keeps a track that was current for a moment (just queued, or skipped
 * before the host's engine got it going) off the receipt.
 */
export const MIN_PLAYED_SECONDS = 3;

/**
 * Whether the track at the head of the queue has played long enough to go on
 * the receipt. On the host's device the clock is the engine's and belongs to
 * the track it last loaded, which trails the queue for a moment after an
 * advance; it only counts once its track id matches the head of the queue,
 * so the old song's elapsed time cannot credit the next one. A guest has no
 * engine and no clock track id: its clock restarts on every track change
 * instead (see shouldResetGuestClock).
 */
export function hasPlayedLongEnough(input: {
  isHostDevice: boolean;
  /** Id of the track at the head of the queue. */
  nowPlayingId: string;
  /** Id of the track the playback clock belongs to; null when nothing has loaded. */
  clockTrackId: string | null;
  elapsedSeconds: number;
}): boolean {
  if (input.isHostDevice && input.clockTrackId !== input.nowPlayingId) return false;
  return input.elapsedSeconds >= MIN_PLAYED_SECONDS;
}

/** Frozen end-of-session snapshot. Everything the Master Bounce shows. */
export interface SessionReceipt {
  /** The session this receipt belongs to. A receipt is only ever shown for this id. */
  sessionId: string;
  sessionName: string;
  roomMode: RoomMode;
  behaviors: RoomBehaviors;
  hostUsername: string;
  durationSeconds: number;
  /** Tracks that actually played, in play order. */
  tracksPlayed: QueueTrack[];
  /** Distinct people seen in the room, including the host. */
  participantCount: number;
  /** CV this user earned during the session (not their balance). */
  cvEarned: number;
  /** ISO time the end event reached this device. */
  endedAt: string;
}

/** The slice of the session the receipt reads. All optional: a receipt can still be built without it. */
export type ReceiptSessionInfo = Partial<
  Pick<Session, 'name' | 'roomMode' | 'behaviors' | 'hostId' | 'hostUsername' | 'createdAt'>
>;

// ─── Duration ───────────────────────────────────────────────

/**
 * Whole seconds the session ran. Starts at the room's creation time when the
 * server gave one that makes sense, otherwise at the moment this device
 * connected. Never negative.
 *
 * The creation time arrives as SQLite's zone-less UTC "YYYY-MM-DD HH:MM:SS";
 * serverTime.ts reads it as UTC, so the result does not shift with the
 * device's timezone.
 */
export function sessionDurationSeconds(input: {
  createdAtMs: number | null;
  connectedAtMs: number;
  endedAtMs: number;
}): number {
  const { createdAtMs, connectedAtMs, endedAtMs } = input;
  // A creation time after the end means the two clocks disagree; trust the
  // device's own connect time over a negative duration.
  const startMs =
    createdAtMs !== null && Number.isFinite(createdAtMs) && createdAtMs <= endedAtMs
      ? createdAtMs
      : connectedAtMs;
  return Math.max(0, Math.round((endedAtMs - startMs) / 1000));
}

// ─── Votes ──────────────────────────────────────────────────

/**
 * Net votes a track collected. `votedBy` is a userId -> 1 | -1 map, not an
 * array, so counting `.length` on it (as the receipt once did) is always
 * undefined and every track read "0 votes". `votes` is the server's running
 * total; the map is the fallback.
 */
export function trackVoteCount(track: Pick<QueueTrack, 'votes' | 'votedBy'>): number {
  if (typeof track.votes === 'number' && Number.isFinite(track.votes)) {
    return Math.max(0, track.votes);
  }
  const ballots = track.votedBy ? Object.values(track.votedBy) : [];
  return Math.max(0, ballots.reduce<number>((sum, ballot) => sum + ballot, 0));
}

// ─── Session binding ────────────────────────────────────────

/**
 * True only when the receipt was frozen for exactly this session. This is
 * what keeps one room's receipt from surfacing in the next room the user
 * joins.
 */
export function receiptBelongsTo(
  receipt: SessionReceipt | null | undefined,
  sessionId: string,
): boolean {
  return !!receipt && !!sessionId && receipt.sessionId === sessionId;
}

// ─── Ledger ─────────────────────────────────────────────────

/**
 * Running record of one session as this device saw it. Create a fresh one
 * per session; call {@link close} when the room ends. After close it ignores
 * further notes, so late events (the host's departure, the next room's
 * traffic) cannot change a receipt already on screen.
 */
export class SessionReceiptLedger {
  readonly sessionId: string;
  private readonly connectedAtMs: number;
  private readonly participants = new Map<string, string>();
  private readonly played: QueueTrack[] = [];
  private cvEarned = 0;
  private receipt: SessionReceipt | null = null;

  constructor(sessionId: string, connectedAtMs: number = Date.now()) {
    this.sessionId = sessionId;
    this.connectedAtMs = connectedAtMs;
  }

  get isClosed(): boolean {
    return this.receipt !== null;
  }

  /** Record someone as present. Never removed: leaving does not un-attend. */
  noteParticipant(userId: string, username: string): void {
    if (this.isClosed || !userId) return;
    const known = this.participants.get(userId);
    // Keep the best name seen: a later empty name never erases a real one.
    this.participants.set(userId, username || known || '');
  }

  noteParticipants(listeners: ReadonlyArray<{ userId: string; username: string }>): void {
    for (const listener of listeners) {
      this.noteParticipant(listener.userId, listener.username);
    }
  }

  /** Display name for anyone the room has shown us, or undefined. */
  usernameFor(userId: string): string | undefined {
    const name = this.participants.get(userId);
    return name ? name : undefined;
  }

  /** Record a track as played. Repeat calls refresh its snapshot but keep its place in the order. */
  noteTrackPlayed(track: QueueTrack): void {
    if (this.isClosed || !track?.id) return;
    const index = this.played.findIndex((t) => t.id === track.id);
    if (index === -1) {
      this.played.push(track);
    } else {
      this.played[index] = track;
    }
  }

  /** Add CV this user earned during the session. Ignores non-positive and non-finite amounts. */
  noteCvEarned(amount: number): void {
    if (this.isClosed || !Number.isFinite(amount) || amount <= 0) return;
    this.cvEarned += amount;
  }

  /**
   * Freeze the ledger into a receipt. Idempotent: a second call (a repeated
   * end event) returns the first receipt untouched.
   */
  close(session: ReceiptSessionInfo | null | undefined, endedAtMs: number): SessionReceipt {
    if (this.receipt) return this.receipt;

    const hostId = session?.hostId ?? '';
    const named = session?.hostUsername?.trim();
    const hostUsername = named || (hostId ? this.usernameFor(hostId) : undefined) || 'Host';
    // The host is always part of their own room, even when the roster no
    // longer lists them.
    if (hostId) this.noteParticipant(hostId, named || '');

    this.receipt = {
      sessionId: this.sessionId,
      sessionName: session?.name || 'Session',
      roomMode: session?.roomMode ?? 'campfire',
      behaviors: session?.behaviors ?? DEFAULT_BEHAVIORS,
      hostUsername,
      durationSeconds: sessionDurationSeconds({
        createdAtMs: parseServerTimestamp(session?.createdAt)?.getTime() ?? null,
        connectedAtMs: this.connectedAtMs,
        endedAtMs,
      }),
      tracksPlayed: [...this.played],
      participantCount: this.participants.size,
      cvEarned: this.cvEarned,
      endedAt: new Date(endedAtMs).toISOString(),
    };
    return this.receipt;
  }
}
