/**
 * ID3v2 reader tests. Every tag here is built byte by byte, so the fixtures
 * state exactly what a tagger would have written (versions, encodings, sizes).
 */

import { decodeBase64, id3TagLength, parseId3v2 } from '../id3';

// ─── Fixture builders ────────────────────────────────────────

function ascii(text: string): number[] {
  return Array.from(text).map((ch) => ch.charCodeAt(0));
}

function latin1(text: string): number[] {
  return ascii(text);
}

function utf8(text: string): number[] {
  return Array.from(Buffer.from(text, 'utf8'));
}

function utf16(text: string, order: 'le' | 'be', bom: boolean): number[] {
  const out: number[] = [];
  if (bom) out.push(...(order === 'le' ? [0xff, 0xfe] : [0xfe, 0xff]));
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    out.push(...(order === 'le' ? [unit & 0xff, unit >> 8] : [unit >> 8, unit & 0xff]));
  }
  return out;
}

function syncsafe(value: number): number[] {
  return [(value >> 21) & 0x7f, (value >> 14) & 0x7f, (value >> 7) & 0x7f, value & 0x7f];
}

function be32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function be24(value: number): number[] {
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Text frame body: encoding byte then the already-encoded string. */
function text(encoding: number, payload: number[]): number[] {
  return [encoding, ...payload];
}

function frame23(id: string, body: number[], flags: [number, number] = [0, 0]): number[] {
  return [...ascii(id), ...be32(body.length), ...flags, ...body];
}

function frame24(id: string, body: number[], flags: [number, number] = [0, 0]): number[] {
  return [...ascii(id), ...syncsafe(body.length), ...flags, ...body];
}

function frame22(id: string, body: number[]): number[] {
  return [...ascii(id), ...be24(body.length), ...body];
}

/** Whole tag: header, optional extra bytes before the frames, frames, zero padding. */
function tag(version: 2 | 3 | 4, flags: number, frames: number[][], padding = 0, prefix: number[] = []): Uint8Array {
  const body = [...prefix, ...frames.flat(), ...new Array<number>(padding).fill(0)];
  return Uint8Array.from([0x49, 0x44, 0x33, version, 0, flags, ...syncsafe(body.length), ...body]);
}

/** What an encoder does under the unsynchronisation scheme. */
function unsynchronise(bytes: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i]);
    if (bytes[i] === 0xff && (i === bytes.length - 1 || bytes[i + 1] === 0x00 || bytes[i + 1] >= 0xe0)) {
      out.push(0x00);
    }
  }
  return out;
}

// ─── decodeBase64 ────────────────────────────────────────────

describe('decodeBase64', () => {
  it('matches Buffer for every length from 0 to 64', () => {
    for (let length = 0; length <= 64; length++) {
      const data = Uint8Array.from({ length }, (_, i) => (i * 37 + length * 11) & 0xff);
      const encoded = Buffer.from(data).toString('base64');
      expect(Array.from(decodeBase64(encoded))).toEqual(Array.from(data));
    }
  });

  it('ignores line breaks and decodes unpadded input', () => {
    expect(Array.from(decodeBase64('SUQz\nBAA'))).toEqual([0x49, 0x44, 0x33, 0x04, 0x00]);
  });

  it('returns an empty array for an empty string', () => {
    expect(decodeBase64('')).toHaveLength(0);
  });
});

// ─── id3TagLength ────────────────────────────────────────────

describe('id3TagLength', () => {
  it('is header plus body for a v2.3 tag', () => {
    const bytes = tag(3, 0, [frame23('TIT2', text(0, latin1('Hi')))]);
    expect(id3TagLength(bytes)).toBe(bytes.length);
  });

  it('adds the 10-byte footer when a v2.4 tag declares one', () => {
    const bytes = tag(4, 0x10, [frame24('TIT2', text(0, latin1('Hi')))]);
    expect(id3TagLength(bytes)).toBe(bytes.length + 10);
  });

  it('is 0 without an ID3 header, with a short buffer, or with a bad version or size', () => {
    expect(id3TagLength(Uint8Array.from(ascii('RIFF....WAVEfmt ')))).toBe(0);
    expect(id3TagLength(Uint8Array.from([0x49, 0x44, 0x33]))).toBe(0);
    expect(id3TagLength(Uint8Array.from([0x49, 0x44, 0x33, 5, 0, 0, 0, 0, 0, 1]))).toBe(0);
    expect(id3TagLength(Uint8Array.from([0x49, 0x44, 0x33, 3, 0, 0, 0x80, 0, 0, 1]))).toBe(0);
  });
});

// ─── v2.3 ────────────────────────────────────────────────────

describe('parseId3v2 v2.3', () => {
  it('reads ISO-8859-1 title, artist and album', () => {
    const bytes = tag(3, 0, [
      frame23('TIT2', text(0, latin1('Gate A Tone One'))),
      frame23('TPE1', text(0, latin1('Frequen-C Test'))),
      frame23('TALB', text(0, latin1('Gate A'))),
    ]);
    expect(parseId3v2(bytes)).toEqual({
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
    });
  });

  it('decodes Latin-1 accented characters', () => {
    const bytes = tag(3, 0, [frame23('TIT2', text(0, [0x43, 0x61, 0x66, 0xe9]))]);
    expect(parseId3v2(bytes).title).toBe('Café');
  });

  it('decodes UTF-16 with a little-endian BOM, including non-Latin text and surrogate pairs', () => {
    const title = 'Café – 音楽 🎵';
    const bytes = tag(3, 0, [frame23('TIT2', text(1, [...utf16(title, 'le', true), 0, 0]))]);
    expect(parseId3v2(bytes).title).toBe(title);
  });

  it('decodes UTF-16 with a big-endian BOM', () => {
    const bytes = tag(3, 0, [frame23('TPE1', text(1, [...utf16('Frequen-C Test', 'be', true), 0, 0]))]);
    expect(parseId3v2(bytes).artist).toBe('Frequen-C Test');
  });

  it('treats UTF-16 without a BOM as little-endian', () => {
    const bytes = tag(3, 0, [frame23('TALB', text(1, utf16('Plain', 'le', false)))]);
    expect(parseId3v2(bytes).album).toBe('Plain');
  });

  it('skips frames it does not read, including a large picture ahead of the text', () => {
    const picture = frame23('APIC', [0, ...latin1('image/jpeg'), 0, 3, 0, ...new Array<number>(5000).fill(0xab)]);
    const bytes = tag(3, 0, [
      frame23('TCON', text(0, latin1('Test'))),
      picture,
      frame23('TIT2', text(0, latin1('After the art'))),
    ]);
    expect(parseId3v2(bytes)).toEqual({ title: 'After the art' });
  });

  it('stops at the zero padding after the last frame', () => {
    const bytes = tag(3, 0, [frame23('TIT2', text(0, latin1('Padded')))], 64);
    expect(parseId3v2(bytes)).toEqual({ title: 'Padded' });
  });

  it('keeps the first frame when a field appears twice', () => {
    const bytes = tag(3, 0, [
      frame23('TIT2', text(0, latin1('First'))),
      frame23('TIT2', text(0, latin1('Second'))),
    ]);
    expect(parseId3v2(bytes).title).toBe('First');
  });

  it('skips the extended header', () => {
    // size 6 (excluding itself), 2 flag bytes, 4 padding-size bytes
    const extended = [...be32(6), 0, 0, 0, 0, 0, 0];
    const bytes = tag(3, 0x40, [frame23('TIT2', text(0, latin1('Extended')))], 0, extended);
    expect(parseId3v2(bytes).title).toBe('Extended');
  });

  it('removes whole-tag unsynchronisation before reading UTF-16 text', () => {
    const frames = frame23('TIT2', text(1, [...utf16('Sync me', 'le', true), 0, 0]));
    const raw = unsynchronise(frames);
    expect(raw.length).toBeGreaterThan(frames.length); // the BOM's 0xFF got a zero after it
    const bytes = Uint8Array.from([0x49, 0x44, 0x33, 3, 0, 0x80, ...syncsafe(raw.length), ...raw]);
    expect(parseId3v2(bytes).title).toBe('Sync me');
  });

  it('skips compressed and encrypted frames without failing the rest', () => {
    const bytes = tag(3, 0, [
      frame23('TIT2', text(0, latin1('Compressed')), [0, 0x80]),
      frame23('TPE1', text(0, latin1('Encrypted')), [0, 0x40]),
      frame23('TALB', text(0, latin1('Readable'))),
    ]);
    expect(parseId3v2(bytes)).toEqual({ album: 'Readable' });
  });

  it('drops the grouping identity byte that precedes the encoding byte', () => {
    const bytes = tag(3, 0, [frame23('TIT2', [0x07, ...text(0, latin1('Grouped'))], [0, 0x20])]);
    expect(parseId3v2(bytes).title).toBe('Grouped');
  });
});

// ─── v2.4 ────────────────────────────────────────────────────

describe('parseId3v2 v2.4', () => {
  it('decodes UTF-8 including 2, 3 and 4 byte sequences', () => {
    const title = 'Ünïcödé 音楽 🎵';
    const bytes = tag(4, 0, [frame24('TIT2', text(3, utf8(title)))]);
    expect(parseId3v2(bytes).title).toBe(title);
  });

  it('decodes UTF-16BE without a BOM', () => {
    const bytes = tag(4, 0, [frame24('TPE1', text(2, [...utf16('Frequen-C Test', 'be', false), 0, 0]))]);
    expect(parseId3v2(bytes).artist).toBe('Frequen-C Test');
  });

  it('reads syncsafe frame sizes that need more than one 7-bit group', () => {
    const longTitle = 'x'.repeat(300);
    const bytes = tag(4, 0, [
      frame24('TIT2', text(3, utf8(longTitle))),
      frame24('TPE1', text(3, utf8('Artist'))),
    ]);
    expect(parseId3v2(bytes)).toEqual({ title: longTitle, artist: 'Artist' });
  });

  it('falls back to a plain integer when a frame size has a high bit set', () => {
    // 130 bytes of body written as 0x00000082, which is not a valid syncsafe value
    const body = text(0, latin1('y'.repeat(129)));
    const odd = [...ascii('TIT2'), 0, 0, 0, 0x82, 0, 0, ...body];
    const bytes = tag(4, 0, [odd, frame24('TPE1', text(0, latin1('Next')))]);
    expect(parseId3v2(bytes)).toEqual({ title: 'y'.repeat(129), artist: 'Next' });
  });

  it('joins several NUL-separated values', () => {
    const bytes = tag(4, 0, [frame24('TPE1', text(3, [...utf8('Artist A'), 0, ...utf8('Artist B')]))]);
    expect(parseId3v2(bytes).artist).toBe('Artist A / Artist B');
  });

  it('skips the extended header (syncsafe size that includes itself)', () => {
    // 6 bytes total: size, 1 flag-byte-count, 1 flag byte
    const extended = [...syncsafe(6), 1, 0];
    const bytes = tag(4, 0x40, [frame24('TIT2', text(3, utf8('Extended 2.4')))], 0, extended);
    expect(parseId3v2(bytes).title).toBe('Extended 2.4');
  });

  it('decodes a frame flagged as unsynchronised', () => {
    const body = unsynchronise(text(1, [...utf16('Frame sync', 'le', true), 0, 0]));
    const bytes = tag(4, 0, [frame24('TIT2', body, [0, 0x02])]);
    expect(parseId3v2(bytes).title).toBe('Frame sync');
  });

  it('skips the data length indicator and grouping byte', () => {
    const payload = text(3, utf8('Indicated'));
    const body = [0x01, ...syncsafe(payload.length), ...payload]; // group byte, data length, data
    const bytes = tag(4, 0, [frame24('TIT2', body, [0, 0x41])]);
    expect(parseId3v2(bytes).title).toBe('Indicated');
  });

  it('ignores compressed and encrypted frames', () => {
    const bytes = tag(4, 0, [
      frame24('TIT2', text(3, utf8('Compressed')), [0, 0x08]),
      frame24('TPE1', text(3, utf8('Encrypted')), [0, 0x04]),
      frame24('TALB', text(3, utf8('Plain'))),
    ]);
    expect(parseId3v2(bytes)).toEqual({ album: 'Plain' });
  });

  it('replaces invalid UTF-8 instead of failing', () => {
    const bytes = tag(4, 0, [frame24('TIT2', text(3, [0x41, 0xff, 0xc3, 0x42, 0xe2, 0x82]))]);
    // 0xFF is never a lead byte, 0xC3 is followed by 'B', and E2 82 is cut short
    expect(parseId3v2(bytes).title).toBe('A\uFFFD\uFFFDB\uFFFD\uFFFD');
  });
});

// ─── v2.2 ────────────────────────────────────────────────────

describe('parseId3v2 v2.2', () => {
  it('reads TT2, TP1 and TAL', () => {
    const bytes = tag(2, 0, [
      frame22('TT2', text(0, latin1('Gate A Tone One'))),
      frame22('TP1', text(1, [...utf16('Frequen-C Test', 'le', true), 0, 0])),
      frame22('TAL', text(0, latin1('Gate A'))),
    ]);
    expect(parseId3v2(bytes)).toEqual({
      title: 'Gate A Tone One',
      artist: 'Frequen-C Test',
      album: 'Gate A',
    });
  });

  it('ignores a tag that sets the compression flag', () => {
    const bytes = tag(2, 0x40, [frame22('TT2', text(0, latin1('Nope')))]);
    expect(parseId3v2(bytes)).toEqual({});
  });
});

// ─── Bad input ───────────────────────────────────────────────

describe('parseId3v2 with unusable input', () => {
  it('returns no tags for audio without an ID3 header', () => {
    expect(parseId3v2(Uint8Array.from([0xff, 0xfb, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toEqual({});
  });

  it('returns no tags for empty input', () => {
    expect(parseId3v2(new Uint8Array(0))).toEqual({});
  });

  it('returns no tags for an unsupported version', () => {
    const bytes = tag(3, 0, [frame23('TIT2', text(0, latin1('Hi')))]);
    bytes[3] = 5;
    expect(parseId3v2(bytes)).toEqual({});
  });

  it('treats blank and NUL-only text as absent', () => {
    const bytes = tag(3, 0, [
      frame23('TIT2', text(0, [0x20, 0x20, 0x00])),
      frame23('TPE1', text(0, [0x00, 0x00])),
      frame23('TALB', text(1, [0xff, 0xfe, 0x00, 0x00])),
    ]);
    expect(parseId3v2(bytes)).toEqual({});
  });

  it('trims a trailing NUL that some taggers add to ISO-8859-1 text', () => {
    const bytes = tag(3, 0, [frame23('TIT2', text(0, [...latin1('Terminated'), 0x00]))]);
    expect(parseId3v2(bytes).title).toBe('Terminated');
  });

  it('keeps the frames before the cut when the read stops mid-tag', () => {
    const full = tag(3, 0, [
      frame23('TIT2', text(0, latin1('Whole'))),
      frame23('TPE1', text(0, latin1('Cut off here'))),
    ]);
    const firstFrameEnd = 10 + 10 + 6; // header + frame header + body (encoding + 5 chars)
    expect(parseId3v2(full.subarray(0, firstFrameEnd + 14))).toEqual({ title: 'Whole' });
  });

  it('does not run past a frame size that exceeds the tag', () => {
    const bytes = tag(3, 0, [
      frame23('TIT2', text(0, latin1('Fine'))),
      [...ascii('TPE1'), ...be32(0x7fffffff), 0, 0, 0x00, 0x41],
    ]);
    expect(parseId3v2(bytes)).toEqual({ title: 'Fine' });
  });

  it('stops at bytes that are not a frame id', () => {
    const bytes = tag(3, 0, [
      frame23('TIT2', text(0, latin1('Before junk'))),
      [0x01, 0x02, 0x03, 0x04, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x41, 0x42],
      frame23('TPE1', text(0, latin1('After junk'))),
    ]);
    expect(parseId3v2(bytes)).toEqual({ title: 'Before junk' });
  });

  it('survives arbitrary bytes behind a valid header', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const body = Array.from({ length: 200 }, (_, i) => (i * 131 + seed * 977) & 0xff);
      const version = (2 + (seed % 3)) as 2 | 3 | 4;
      const bytes = Uint8Array.from([0x49, 0x44, 0x33, version, 0, seed % 2 ? 0x40 : 0x80, ...syncsafe(body.length), ...body]);
      expect(() => parseId3v2(bytes)).not.toThrow();
    }
  });
});
