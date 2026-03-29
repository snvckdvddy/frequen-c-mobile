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

/**
 * Get the brand color at reduced opacity (for backgrounds/tints).
 * Returns a hex + alpha string like '#1DB95420'.
 */
export function getSourceTint(source: TrackSource | undefined, alphaHex = '15'): string {
  const color = getSourceColor(source);
  // palette.slate and palette.ice already have full hex — safe to append
  return `${color}${alphaHex}`;
}
