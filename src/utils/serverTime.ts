/**
 * Backend timestamps.
 *
 * SQLite's datetime('now') (sessions.created_at, ended_at and friends) yields
 * "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker. JS engines disagree on a
 * string like that: one reads it as local time, another rejects it. Reading it
 * as UTC here puts every device on the real instant, so "ended 3 hours ago"
 * and the clock time shown are right in any timezone. Strings that already
 * carry a zone (ISO 8601 from toISOString) keep it.
 *
 * Anything that looks like a date is rebuilt as strict ISO 8601 before it is
 * parsed (three fractional digits, a "T", an explicit zone), because the
 * strict form is the only one the language spec requires every engine to
 * accept.
 *
 * Pure TypeScript with no React Native imports, so it runs under Jest.
 */

// Date, then optionally a time ("HH:MM" or "HH:MM:SS", with any number of
// fractional digits) and, after a time, an optional zone: Z, +HH:MM, +HHMM or
// +HH. A space or a T may separate the date from the time.
const SERVER_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;

/** "Z" stays, "+HHMM" and "+HH" gain their colon, a missing zone means UTC. */
function normalizeZone(zone: string | undefined): string {
  if (!zone || zone.toUpperCase() === 'Z') return 'Z';
  const sign = zone[0];
  const digits = zone.slice(1).replace(':', '');
  return `${sign}${digits.slice(0, 2)}:${digits.slice(2) || '00'}`;
}

/** The instant a backend timestamp names, or null when it is missing or not a date. */
export function parseServerTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const match = SERVER_TIMESTAMP.exec(text);
  let date: Date;
  if (match) {
    const [, day, time = '00:00', seconds = '00', fraction = '', zone] = match;
    const millis = fraction.slice(0, 3).padEnd(3, '0');
    date = new Date(`${day}T${time}:${seconds}.${millis}${normalizeZone(zone)}`);
  } else {
    date = new Date(text);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}
