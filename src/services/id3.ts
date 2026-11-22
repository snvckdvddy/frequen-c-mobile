/**
 * Minimal ID3v2 reader: title, artist, album from the tag at the start of an
 * audio file. Pure functions over bytes; the caller does the file I/O
 * (localLibrary.ts reads the header range through expo-file-system).
 *
 * Covers v2.2, v2.3 and v2.4: syncsafe sizes, the extended header, whole-tag
 * and per-frame unsynchronisation, and the four text encodings (ISO-8859-1,
 * UTF-16 with BOM, UTF-16BE, UTF-8). Anything unreadable yields no tags, never
 * an exception, so a bad tag can only cost the caller its filename fallback.
 *
 * Not covered: ID3v1 (end-of-file tag), compressed or encrypted frames, and
 * non-ID3 tag formats (MP4 atoms, Vorbis comments).
 */

export interface Id3Tags {
  title?: string;
  artist?: string;
  album?: string;
}

interface Id3Header {
  version: 2 | 3 | 4;
  flags: number;
  /** Bytes after the 10-byte header, not counting a v2.4 footer. */
  size: number;
}

const HEADER_BYTES = 10;

const FRAME_FIELDS_V22: Readonly<Record<string, keyof Id3Tags>> = {
  TT2: 'title',
  TP1: 'artist',
  TAL: 'album',
};

const FRAME_FIELDS_V23: Readonly<Record<string, keyof Id3Tags>> = {
  TIT2: 'title',
  TPE1: 'artist',
  TALB: 'album',
};

// ─── Base64 ──────────────────────────────────────────────────

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/**
 * Decode standard base64 (what expo-file-system returns). Padding ends the
 * input; characters outside the alphabet, such as line breaks, are ignored.
 */
export function decodeBase64(base64: string): Uint8Array {
  const out = new Uint8Array(Math.floor((base64.length * 3) / 4));
  let length = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < base64.length; i++) {
    const code = base64.charCodeAt(i);
    if (code === 0x3d) break; // '='
    const value = code < 128 ? BASE64_LOOKUP[code] : -1;
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[length++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }
  return out.subarray(0, length);
}

// ─── Header ──────────────────────────────────────────────────

/** Four bytes of 7 bits each (high bit always clear), or -1 when a high bit is set. */
function readSyncsafe(bytes: Uint8Array, offset: number): number {
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  const b3 = bytes[offset + 3];
  if ((b0 | b1 | b2 | b3) & 0x80) return -1;
  return (b0 << 21) | (b1 << 14) | (b2 << 7) | b3;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 0x1000000 + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readHeader(bytes: Uint8Array): Id3Header | null {
  if (bytes.length < HEADER_BYTES) return null;
  // 'I' 'D' '3'
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return null;
  const major = bytes[3];
  if (major !== 2 && major !== 3 && major !== 4) return null;
  const size = readSyncsafe(bytes, 6);
  if (size < 0) return null;
  return { version: major, flags: bytes[5], size };
}

/**
 * Bytes the tag occupies at the start of the file (header, body and footer),
 * or 0 when the bytes do not start with a readable ID3v2 header. Callers read
 * the first 10 bytes of a file, then this many bytes (capped) for the parse.
 */
export function id3TagLength(bytes: Uint8Array): number {
  const header = readHeader(bytes);
  if (!header) return 0;
  const footer = header.version === 4 && (header.flags & 0x10) !== 0 ? HEADER_BYTES : 0;
  return HEADER_BYTES + header.size + footer;
}

/** Drop the 0x00 that unsynchronisation inserts after every 0xFF. */
function removeUnsynchronisation(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  let length = 0;
  for (let i = 0; i < bytes.length; i++) {
    out[length++] = bytes[i];
    if (bytes[i] === 0xff && bytes[i + 1] === 0x00) i++;
  }
  return out.subarray(0, length);
}

// ─── Text decoding ───────────────────────────────────────────

function decodeLatin1(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

function decodeUtf8(bytes: Uint8Array): string {
  let text = '';
  let i = 0;
  while (i < bytes.length) {
    const lead = bytes[i++];
    if (lead < 0x80) {
      text += String.fromCharCode(lead);
      continue;
    }
    let extra: number;
    let codePoint: number;
    if (lead >= 0xc2 && lead <= 0xdf) {
      extra = 1;
      codePoint = lead & 0x1f;
    } else if (lead >= 0xe0 && lead <= 0xef) {
      extra = 2;
      codePoint = lead & 0x0f;
    } else if (lead >= 0xf0 && lead <= 0xf4) {
      extra = 3;
      codePoint = lead & 0x07;
    } else {
      text += '\uFFFD';
      continue;
    }
    let valid = i + extra <= bytes.length;
    for (let k = 0; valid && k < extra; k++) {
      const next = bytes[i + k];
      if ((next & 0xc0) !== 0x80) valid = false;
      else codePoint = (codePoint << 6) | (next & 0x3f);
    }
    const overlong = (extra === 2 && codePoint < 0x800) || (extra === 3 && codePoint < 0x10000);
    const outOfRange = codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff);
    if (!valid || overlong || outOfRange) {
      text += '\uFFFD';
      continue;
    }
    i += extra;
    text += String.fromCodePoint(codePoint);
  }
  return text;
}

/** One UTF-16 string. A BOM picks the byte order; without one `littleEndian` decides. */
function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  let start = 0;
  let le = littleEndian;
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      le = true;
      start = 2;
    } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      le = false;
      start = 2;
    }
  }
  let text = '';
  for (let i = start; i + 1 < bytes.length; i += 2) {
    text += String.fromCharCode(le ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  }
  return text;
}

/** Split on single 0x00 bytes (ISO-8859-1 and UTF-8 terminators). */
function splitOnNul(bytes: Uint8Array): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      parts.push(bytes.subarray(start, i));
      start = i + 1;
    }
  }
  if (start < bytes.length) parts.push(bytes.subarray(start));
  return parts;
}

/** Split on 0x0000 pairs aligned to two bytes (UTF-16 terminators). */
function splitOnNulPair(bytes: Uint8Array): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === 0 && bytes[i + 1] === 0) {
      parts.push(bytes.subarray(start, i));
      start = i + 2;
    }
  }
  if (start < bytes.length) parts.push(bytes.subarray(start));
  return parts;
}

function cleanText(text: string): string {
  return text.replace(/[\u0000\uFEFF]/g, '').trim();
}

/**
 * Text information frame body: an encoding byte, then one or more
 * terminated strings. Several values (v2.4 allows them) join with " / ".
 */
function decodeTextFrame(data: Uint8Array): string | undefined {
  if (data.length < 2) return undefined;
  const encoding = data[0];
  const body = data.subarray(1);

  let values: string[];
  if (encoding === 1 || encoding === 2) {
    // 1 = UTF-16 with BOM (little-endian when the BOM is missing), 2 = UTF-16BE.
    values = splitOnNulPair(body).map((part) => decodeUtf16(part, encoding === 1));
  } else {
    values = splitOnNul(body).map(encoding === 3 ? decodeUtf8 : decodeLatin1);
  }

  const cleaned = values.map(cleanText).filter((value) => value.length > 0);
  return cleaned.length > 0 ? cleaned.join(' / ') : undefined;
}

// ─── Frames ──────────────────────────────────────────────────

function readFrameId(bytes: Uint8Array, offset: number, length: number): string | null {
  let id = '';
  for (let i = 0; i < length; i++) {
    const code = bytes[offset + i];
    const valid = (code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5a);
    if (!valid) return null;
    id += String.fromCharCode(code);
  }
  return id;
}

/**
 * Frame body after the per-frame flags are applied, or null when the frame
 * cannot be read (compressed or encrypted).
 */
function unwrapFrameData(
  data: Uint8Array,
  version: 2 | 3 | 4,
  flags: number,
  tagUnsynchronised: boolean,
): Uint8Array | null {
  let body = data;
  let unsynchronised = false;
  if (version === 3) {
    if (flags & 0x00c0) return null; // compression (0x80) or encryption (0x40)
    if (flags & 0x0020) body = body.subarray(1); // grouping identity byte
  } else if (version === 4) {
    if (flags & 0x000c) return null; // compression (0x08) or encryption (0x04)
    if (flags & 0x0040) body = body.subarray(1); // grouping identity byte
    if (flags & 0x0001) body = body.subarray(4); // data length indicator
    unsynchronised = (flags & 0x0002) !== 0 || tagUnsynchronised;
  }
  return unsynchronised ? removeUnsynchronisation(body) : body;
}

/**
 * Read title, artist and album from the bytes at the start of a file. The
 * array may be cut short (only the first part of a large tag was read); frames
 * that run past its end are ignored.
 */
export function parseId3v2(bytes: Uint8Array): Id3Tags {
  const tags: Id3Tags = {};
  const header = readHeader(bytes);
  if (!header) return tags;
  // v2.2 flag bit 6 is "compression", a scheme the spec never defined.
  if (header.version === 2 && (header.flags & 0x40) !== 0) return tags;

  const tagUnsynchronised = (header.flags & 0x80) !== 0;
  let body = bytes.subarray(HEADER_BYTES, Math.min(HEADER_BYTES + header.size, bytes.length));
  // Before v2.4 the flag covers the whole tag, frame headers included, so the
  // zeros come out first. In v2.4 each frame is decoded on its own below.
  if (tagUnsynchronised && header.version < 4) body = removeUnsynchronisation(body);

  let pos = 0;
  if (header.version >= 3 && (header.flags & 0x40) !== 0) {
    if (body.length < 4) return tags;
    // v2.3 stores the size without its own 4 bytes; v2.4 stores it syncsafe and including them.
    const extendedLength = header.version === 3 ? readUint32(body, 0) + 4 : readSyncsafe(body, 0);
    if (extendedLength < 4 || extendedLength > body.length) return tags;
    pos = extendedLength;
  }

  const idLength = header.version === 2 ? 3 : 4;
  const frameHeaderLength = header.version === 2 ? 6 : 10;
  const fields = header.version === 2 ? FRAME_FIELDS_V22 : FRAME_FIELDS_V23;

  while (pos + frameHeaderLength <= body.length) {
    if (body[pos] === 0) break; // padding runs to the end of the tag
    const id = readFrameId(body, pos, idLength);
    if (!id) break; // not a frame header: corrupt tag, keep what was found

    let size: number;
    if (header.version === 2) {
      size = (body[pos + 3] << 16) | (body[pos + 4] << 8) | body[pos + 5];
    } else if (header.version === 3) {
      size = readUint32(body, pos + 4);
    } else {
      // Some taggers wrote plain integers in v2.4 frames; a set high bit gives them away.
      const syncsafe = readSyncsafe(body, pos + 4);
      size = syncsafe >= 0 ? syncsafe : readUint32(body, pos + 4);
    }
    const flags = header.version === 2 ? 0 : (body[pos + 8] << 8) | body[pos + 9];

    const start = pos + frameHeaderLength;
    const end = start + size;
    if (end > body.length) break; // cut off by the read limit, or corrupt
    pos = end;

    const field = fields[id];
    if (!field || tags[field] !== undefined || size === 0) continue;

    const data = unwrapFrameData(body.subarray(start, end), header.version, flags, tagUnsynchronised);
    const text = data ? decodeTextFrame(data) : undefined;
    if (text) tags[field] = text;

    if (tags.title !== undefined && tags.artist !== undefined && tags.album !== undefined) break;
  }

  return tags;
}
