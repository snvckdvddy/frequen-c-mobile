import { parseServerTimestamp } from '../serverTime';

describe('parseServerTimestamp', () => {
  it('reads a SQLite datetime as UTC', () => {
    expect(parseServerTimestamp('2026-11-10 03:15:22')?.toISOString()).toBe('2026-11-10T03:15:22.000Z');
  });

  it('reads a SQLite datetime without seconds as UTC', () => {
    expect(parseServerTimestamp('2026-11-10 03:15')?.toISOString()).toBe('2026-11-10T03:15:00.000Z');
  });

  it('reads fractional seconds', () => {
    expect(parseServerTimestamp('2026-11-10 03:15:22.250')?.toISOString()).toBe('2026-11-10T03:15:22.250Z');
  });

  it('reads an ISO string with no zone as UTC too', () => {
    expect(parseServerTimestamp('2026-11-10T03:15:22')?.toISOString()).toBe('2026-11-10T03:15:22.000Z');
  });

  it('leaves strings that carry a zone alone', () => {
    expect(parseServerTimestamp('2026-11-10T03:15:22.000Z')?.toISOString()).toBe('2026-11-10T03:15:22.000Z');
    expect(parseServerTimestamp('2026-11-10T03:15:22+02:00')?.toISOString()).toBe('2026-11-10T01:15:22.000Z');
  });

  it('reads a bare date as UTC midnight', () => {
    expect(parseServerTimestamp('2026-11-10')?.toISOString()).toBe('2026-11-10T00:00:00.000Z');
  });

  it('ignores surrounding whitespace', () => {
    expect(parseServerTimestamp('  2026-11-10 03:15:22 ')?.toISOString()).toBe('2026-11-10T03:15:22.000Z');
  });

  it('honors a zone written with a space separator, with or without the colon', () => {
    const instant = '2026-11-11T18:30:05.000Z';
    expect(parseServerTimestamp('2026-11-11 18:30:05+0000')?.toISOString()).toBe(instant);
    expect(parseServerTimestamp('2026-11-11 10:30:05-08:00')?.toISOString()).toBe(instant);
    expect(parseServerTimestamp('2026-11-11 10:30:05-0800')?.toISOString()).toBe(instant);
  });

  it('honors an hour-only offset and a lowercase z', () => {
    expect(parseServerTimestamp('2026-11-11T20:30:05+02')?.toISOString()).toBe('2026-11-11T18:30:05.000Z');
    expect(parseServerTimestamp('2026-11-11T18:30:05z')?.toISOString()).toBe('2026-11-11T18:30:05.000Z');
  });

  it('cuts long fractional seconds down to milliseconds and pads short ones', () => {
    expect(parseServerTimestamp('2026-11-11T18:30:05.123456Z')?.toISOString()).toBe('2026-11-11T18:30:05.123Z');
    expect(parseServerTimestamp('2026-11-11 18:30:05.5')?.toISOString()).toBe('2026-11-11T18:30:05.500Z');
  });

  it('returns the same instant whatever zone the process runs in', () => {
    // The point of reading a zone-less value as UTC: SQLite's string must
    // not move with the device. Epoch milliseconds are zone-free.
    expect(parseServerTimestamp('2026-11-11 18:30:05')?.getTime()).toBe(Date.UTC(2026, 10, 11, 18, 30, 5));
  });

  it('returns null for missing or unparseable values', () => {
    expect(parseServerTimestamp(undefined)).toBeNull();
    expect(parseServerTimestamp(null)).toBeNull();
    expect(parseServerTimestamp('')).toBeNull();
    expect(parseServerTimestamp('   ')).toBeNull();
    expect(parseServerTimestamp('not a date')).toBeNull();
    expect(parseServerTimestamp('2026-13-45 99:99:99')).toBeNull();
  });
});
