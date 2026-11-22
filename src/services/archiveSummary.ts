/**
 * What the Archive Detail sheet shows for an ended room.
 *
 * Built from the Session that GET /sessions/mine already returns, so opening
 * the sheet costs no request. For a room that has ended the backend keeps the
 * name, code, mode, host, genre, start and end time, a count of tracks that
 * finished (tracksPlayedCount), every person who joined, and whatever was
 * still on air or waiting in the queue. It does not keep the titles of tracks
 * that already played, so for most rooms the honest tracklist is the count
 * plus a note saying so, not an empty list.
 */

import type { Session, Track } from '../types';
import { parseServerTimestamp } from '../utils/serverTime';

/** Names listed on the sheet before the rest collapse into "+N". */
const MAX_CREW_NAMES = 6;

export interface ArchiveSummary {
  name: string;
  code: string;
  modeLabel: string;
  host: string;
  genre: string | null;
  description: string | null;
  startedLabel: string;
  endedLabel: string;
  lengthLabel: string;
  tracksPlayed: number;
  crewCount: number;
  /** Comma-separated usernames, capped, or null when nobody is recorded. */
  crewLine: string | null;
  /** The track that was on air when the room ended. */
  lastOnAir: Track | null;
  /** Tracks that were queued but never played. */
  leftInQueue: Track[];
  /** True when there is any per-track detail to list. */
  hasTrackDetail: boolean;
  /** Explains the empty tracklist; null when tracks are listed. */
  trackNote: string | null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Local date and time as "YYYY-MM-DD HH:mm", or "Unknown" for a missing value. */
export function formatStamp(date: Date | null): string {
  if (!date) return 'Unknown';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** "45m", "2h", "1h 7m"; "LIVE" while the room is open; "Unknown" when the times are unusable. */
export function formatSessionLength(session: Pick<Session, 'isLive' | 'createdAt' | 'endedAt'>): string {
  if (session.isLive) return 'LIVE';
  const start = parseServerTimestamp(session.createdAt);
  const end = parseServerTimestamp(session.endedAt);
  if (!start || !end || end.getTime() <= start.getTime()) return 'Unknown';

  const totalMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function getModeLabel(mode: Session['roomMode'] | string | undefined): string {
  if (mode === 'campfire') return 'CAMPFIRE';
  if (mode === 'spotlight') return 'SPOTLIGHT';
  return 'OPEN FLOOR';
}

function describeMissingTracks(tracksPlayed: number): string {
  if (tracksPlayed <= 0) return 'No tracks were played in this room.';
  const count = tracksPlayed === 1 ? '1 track was' : `${tracksPlayed} tracks were`;
  return `${count} played. Track titles are not saved after a room ends.`;
}

function buildCrewLine(session: Session): string | null {
  const names: string[] = [];
  for (const listener of session.listeners ?? []) {
    const name = listener.username?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  if (names.length === 0) return null;
  const shown = names.slice(0, MAX_CREW_NAMES).join(', ');
  return names.length > MAX_CREW_NAMES ? `${shown} +${names.length - MAX_CREW_NAMES}` : shown;
}

export function buildArchiveSummary(session: Session): ArchiveSummary {
  const lastOnAir = session.currentTrack ?? null;
  const leftInQueue = session.queue ?? [];
  const hasTrackDetail = lastOnAir !== null || leftInQueue.length > 0;
  const tracksPlayed = Math.max(0, session.tracksPlayedCount ?? 0);

  return {
    name: session.name || 'Untitled room',
    code: session.joinCode ? session.joinCode.toUpperCase() : '------',
    modeLabel: getModeLabel(session.roomMode),
    host: session.hostUsername || 'Unknown',
    genre: session.genre?.trim() || null,
    description: session.description?.trim() || null,
    startedLabel: formatStamp(parseServerTimestamp(session.createdAt)),
    endedLabel: formatStamp(parseServerTimestamp(session.endedAt)),
    lengthLabel: formatSessionLength(session),
    tracksPlayed,
    crewCount: (session.listeners ?? []).length,
    crewLine: buildCrewLine(session),
    lastOnAir,
    leftInQueue,
    hasTrackDetail,
    trackNote: hasTrackDetail ? null : describeMissingTracks(tracksPlayed),
  };
}
