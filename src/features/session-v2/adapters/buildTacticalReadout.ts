import type { QueueTrack, Track } from '../../../types';
import type { TacticalReadoutValues } from '../types';

type MaybeTrack = Partial<Track & QueueTrack> | null | undefined;

function asDisplayString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(1);
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

function inferFormat(track: MaybeTrack): string {
  const direct =
    asDisplayString((track as any)?.format) ||
    asDisplayString((track as any)?.fileFormat) ||
    asDisplayString((track as any)?.codec);

  if (direct) return direct.toUpperCase();

  const previewUrl = asDisplayString(track?.previewUrl);
  if (previewUrl) {
    const ext = previewUrl.match(/\.([a-z0-9]{3,4})(?:\?|$)/i)?.[1];
    if (ext) return ext.toUpperCase();
  }

  return 'STRM';
}

export function buildTacticalReadout(track: MaybeTrack): TacticalReadoutValues {
  const bpmValue =
    asDisplayString((track as any)?.bpm) ||
    asDisplayString((track as any)?.tempo) ||
    asDisplayString((track as any)?.beatsPerMinute) ||
    '---.-';

  const keyValue =
    asDisplayString((track as any)?.key) ||
    asDisplayString((track as any)?.musicalKey) ||
    asDisplayString((track as any)?.camelot) ||
    'N/A';

  return {
    bpmLabel: bpmValue,
    keyLabel: keyValue,
    formatLabel: inferFormat(track),
  };
}
