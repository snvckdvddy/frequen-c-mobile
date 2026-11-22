/**
 * Archive Detail sheet content. Session fixtures follow what
 * GET /sessions/mine returns for an ended room: SQLite UTC timestamps, a
 * played-track count, every person who joined, and usually no track list.
 */

import type { Listener, Session, Track } from '../../types';
import { DEFAULT_BEHAVIORS } from '../../types';
import {
  buildArchiveSummary,
  formatSessionLength,
  formatStamp,
  getModeLabel,
} from '../archiveSummary';

function makeTrack(id: string, title: string): Track {
  return { id, title, artist: 'Frequen-C Test', duration: 187, source: 'soundcloud' };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'ses_abc123',
    name: 'TEST1',
    hostId: 'usr_host',
    hostUsername: 'CALEB_RUBLE_2555',
    description: '',
    genre: 'Mixed',
    roomMode: 'campfire',
    behaviors: DEFAULT_BEHAVIORS,
    isPublic: true,
    isLive: false,
    joinCode: '6z96p4',
    listeners: [],
    queue: [],
    createdAt: '2026-11-02 19:30:00',
    endedAt: '2026-11-02 19:34:07',
    tracksPlayedCount: 0,
    ...overrides,
  };
}

function listener(username: string): Listener {
  return { userId: `usr_${username}`, username };
}

describe('formatStamp', () => {
  it('prints local time as YYYY-MM-DD HH:mm with zero padding', () => {
    expect(formatStamp(new Date(2026, 10, 2, 9, 5))).toBe('2026-11-02 09:05');
    expect(formatStamp(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31 23:59');
  });

  it('says Unknown for a missing date', () => {
    expect(formatStamp(null)).toBe('Unknown');
  });
});

describe('formatSessionLength', () => {
  const base = { isLive: false, createdAt: '2026-11-02 19:00:00' };

  it('formats minutes, whole hours, and hours with minutes', () => {
    expect(formatSessionLength({ ...base, endedAt: '2026-11-02 19:45:00' })).toBe('45m');
    expect(formatSessionLength({ ...base, endedAt: '2026-11-02 21:00:00' })).toBe('2h');
    expect(formatSessionLength({ ...base, endedAt: '2026-11-02 20:07:00' })).toBe('1h 7m');
  });

  it('rounds to the nearest minute and never shows less than 1m', () => {
    expect(formatSessionLength({ ...base, endedAt: '2026-11-02 19:04:07' })).toBe('4m');
    expect(formatSessionLength({ ...base, endedAt: '2026-11-02 19:00:20' })).toBe('1m');
  });

  it('is exact across a date change', () => {
    expect(formatSessionLength({ ...base, createdAt: '2026-11-02 23:50:00', endedAt: '2026-11-03 00:20:00' })).toBe('30m');
  });

  it('says LIVE for a room still open', () => {
    expect(formatSessionLength({ ...base, isLive: true, endedAt: undefined })).toBe('LIVE');
  });

  it('says Unknown when the end is missing, unreadable, or before the start', () => {
    expect(formatSessionLength({ ...base, endedAt: undefined })).toBe('Unknown');
    expect(formatSessionLength({ ...base, endedAt: 'garbage' })).toBe('Unknown');
    expect(formatSessionLength({ ...base, endedAt: '2026-11-02 18:00:00' })).toBe('Unknown');
  });
});

describe('getModeLabel', () => {
  it('names each room mode', () => {
    expect(getModeLabel('campfire')).toBe('CAMPFIRE');
    expect(getModeLabel('spotlight')).toBe('SPOTLIGHT');
    expect(getModeLabel('openFloor')).toBe('OPEN FLOOR');
  });

  it('falls back to OPEN FLOOR for anything else', () => {
    expect(getModeLabel(undefined)).toBe('OPEN FLOOR');
    expect(getModeLabel('mystery')).toBe('OPEN FLOOR');
  });
});

describe('buildArchiveSummary', () => {
  it('carries the room identity: name, upper-case code, mode, host, genre', () => {
    const summary = buildArchiveSummary(makeSession({ genre: 'Lo-fi' }));
    expect(summary).toMatchObject({
      name: 'TEST1',
      code: '6Z96P4',
      modeLabel: 'CAMPFIRE',
      host: 'CALEB_RUBLE_2555',
      genre: 'Lo-fi',
      lengthLabel: '4m',
    });
  });

  it('reads the SQLite timestamps as UTC when it prints start and end', () => {
    const summary = buildArchiveSummary(makeSession());
    expect(summary.startedLabel).toBe(formatStamp(new Date(Date.UTC(2026, 10, 2, 19, 30, 0))));
    expect(summary.endedLabel).toBe(formatStamp(new Date(Date.UTC(2026, 10, 2, 19, 34, 7))));
  });

  it('counts everyone who joined and lists their names without repeats', () => {
    const summary = buildArchiveSummary(makeSession({
      listeners: [listener('caleb'), listener('guest'), listener('caleb')],
    }));
    expect(summary.crewCount).toBe(3);
    expect(summary.crewLine).toBe('caleb, guest');
  });

  it('collapses a long crew into the first six names and a count', () => {
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const summary = buildArchiveSummary(makeSession({ listeners: names.map(listener) }));
    expect(summary.crewLine).toBe('a, b, c, d, e, f +2');
    expect(summary.crewCount).toBe(8);
  });

  it('has no crew line when nobody is recorded', () => {
    const summary = buildArchiveSummary(makeSession({ listeners: [] }));
    expect(summary.crewCount).toBe(0);
    expect(summary.crewLine).toBeNull();
  });

  it('keeps the played count and explains the missing tracklist', () => {
    const summary = buildArchiveSummary(makeSession({ tracksPlayedCount: 3 }));
    expect(summary.tracksPlayed).toBe(3);
    expect(summary.hasTrackDetail).toBe(false);
    expect(summary.trackNote).toBe('3 tracks were played. Track titles are not saved after a room ends.');
  });

  it('uses the singular for one track', () => {
    const summary = buildArchiveSummary(makeSession({ tracksPlayedCount: 1 }));
    expect(summary.trackNote).toBe('1 track was played. Track titles are not saved after a room ends.');
  });

  it('says so plainly when nothing was played', () => {
    const summary = buildArchiveSummary(makeSession({ tracksPlayedCount: 0 }));
    expect(summary.trackNote).toBe('No tracks were played in this room.');
  });

  it('lists the track on air and the unplayed queue when the room has them', () => {
    const onAir = makeTrack('t1', 'Gate A Tone One');
    const waiting = [makeTrack('t2', 'Tone Two'), makeTrack('t3', 'Tone Three')];
    const summary = buildArchiveSummary(makeSession({
      currentTrack: onAir,
      queue: waiting,
      tracksPlayedCount: 2,
    }));
    expect(summary.hasTrackDetail).toBe(true);
    expect(summary.trackNote).toBeNull();
    expect(summary.lastOnAir).toBe(onAir);
    expect(summary.leftInQueue).toEqual(waiting);
    expect(summary.tracksPlayed).toBe(2);
  });

  it('counts a queue with no current track as track detail', () => {
    const summary = buildArchiveSummary(makeSession({ queue: [makeTrack('t2', 'Tone Two')] }));
    expect(summary.hasTrackDetail).toBe(true);
    expect(summary.lastOnAir).toBeNull();
  });

  it('drops blank genre and description', () => {
    const summary = buildArchiveSummary(makeSession({ genre: '  ', description: '' }));
    expect(summary.genre).toBeNull();
    expect(summary.description).toBeNull();
  });

  it('trims a description it keeps', () => {
    expect(buildArchiveSummary(makeSession({ description: ' Friday set ' })).description).toBe('Friday set');
  });

  it('does not throw when the API leaves arrays or fields out', () => {
    const partial = makeSession();
    const sparse = {
      ...partial,
      name: '',
      joinCode: '',
      hostUsername: '',
      listeners: undefined,
      queue: undefined,
      endedAt: undefined,
      tracksPlayedCount: undefined,
    } as unknown as Session;

    const summary = buildArchiveSummary(sparse);

    expect(summary).toMatchObject({
      name: 'Untitled room',
      code: '------',
      host: 'Unknown',
      endedLabel: 'Unknown',
      lengthLabel: 'Unknown',
      tracksPlayed: 0,
      crewCount: 0,
      hasTrackDetail: false,
      trackNote: 'No tracks were played in this room.',
    });
  });

  it('never reports a negative played count', () => {
    expect(buildArchiveSummary(makeSession({ tracksPlayedCount: -4 })).tracksPlayed).toBe(0);
  });
});
