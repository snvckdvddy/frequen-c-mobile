/**
 * Streaming Service Color Tokens
 * ─────────────────────────────────────────────────────────────
 * Maps each TrackSource to its brand color for use in provider
 * indicators (queue card left borders, progress bars, etc.).
 *
 * Colors are official brand colors at reduced intensity to avoid
 * clashing with the app's own accent palette.
 */

import type { TrackSource } from '../../types';
import { palette } from './materials';

// ─── Brand Colors (official, slightly muted for dark UI) ────

export const sourceColors: Record<TrackSource, string> = {
  spotify:    '#1DB954',   // Spotify Green
  soundcloud: '#FF5500',   // SoundCloud Orange
  appleMusic: '#FA586A',   // Apple Music Pink-Red
  tidal:      '#00FFFF',   // Tidal Cyan
  youtube:    '#FF0000',   // YouTube Red
  itunes:     palette.slate, // iTunes fallback — muted, no brand identity
  local:      palette.green, // Local files — CV green, no brand to defer to
};

// ─── Short Labels (for tight UI, e.g. queue track badges) ───

export const sourceLabels: Record<TrackSource, string> = {
  spotify:    'SPT',
  soundcloud: 'SC',
  appleMusic: 'AM',
  tidal:      'TIDAL',
  youtube:    'YT',
  itunes:     'ITUNES',
  local:      'LOCAL',
};

// ─── ServiceIcon key mapping ────────────────────────────────
// ServiceIcon expects hyphenated keys; TrackSource uses camelCase.

export const sourceIconKey: Record<TrackSource, string> = {
  spotify:    'spotify',
  soundcloud: 'soundcloud',
  appleMusic: 'apple-music',
  tidal:      'tidal',
  youtube:    'youtube-music',
  itunes:     'itunes',
  local:      'local',
};

// ─── Helpers ────────────────────────────────────────────────

/**
 * Get the brand color for a track source, with fallback.
 * Safe to call with undefined — returns the app's secondary accent.
 */
export function getSourceColor(source: TrackSource | undefined): string {
  if (!source) return palette.ice;
  return sourceColors[source] ?? palette.ice;
}

/** Get the short label for a track source (e.g. 'SPT', 'SC'). */
export function getSourceLabel(source: TrackSource | undefined): string {
  if (!source) return '---';
  return sourceLabels[source] ?? '---';
}

