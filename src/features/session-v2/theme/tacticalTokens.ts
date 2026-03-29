/**
 * Tactical Design Tokens — Signal Chain Visualization
 * ─────────────────────────────────────────────────────────────
 * Re-export layer over the canonical palette (design/tokens/materials).
 *
 * This file preserves the `tacticalTokens.colors.xxx` access pattern
 * used by 40+ components while ensuring all color values flow from
 * the single source of truth in materials.ts.
 *
 * NEW CODE should import directly from `design/tokens/materials`
 * instead of using this file. This layer exists for backward compat.
 */

import { palette, withAlpha } from '../../../design/tokens/materials';
import { fontFamily } from '../../../design/tokens/typography';
import type { RoomMode } from '../../../types';
import type { SignalChainVisualMode } from '../types';

export const tacticalTokens = {
  colors: {
    // ─── Surfaces (canonical System C values) ──────────
    void: palette.pureBlack,
    matte: palette.matte,
    matteRaised: palette.steel,
    gridLine: palette.steel,
    matteGhost: palette.matteGhost,

    // ─── Borders ────────────────────────────────────────
    border: palette.borderHard,
    borderSoft: palette.borderSoft,
    borderGhost: palette.borderGhost,

    // ─── Accent colors (canonical palette values) ──────
    acid: palette.acid,
    orange: palette.orange,
    ice: palette.ice,
    hotPink: palette.hotPink,

    // ─── Text hierarchy ────────────────────────────────
    white: palette.pureWhite,
    textDim: palette.textDim,
    textMuted: palette.textSecondary,
    textSoft: palette.slate,

    // ─── Specialty ─────────────────────────────────────
    guide: palette.guide,
    guideSoft: palette.guideSoft,
    overlay: withAlpha(palette.pureBlack, 0.78),
  },
  radius: {
    none: 0,
    micro: 1,
    sharp: 2,
  },
  spacing: {
    unit: 4,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  grid: {
    cell: 20,
  },
  fonts: {
    display: fontFamily.displayBold,
    mono: fontFamily.mono,
    monoBold: fontFamily.monoBold,
  },
  fontSize: {
    sys: 10,
    micro: 11,
    small: 12,
    body: 14,
    label: 16,
    title: 24,
    display: 28,
    hero: 32,
  },
} as const;

export function getModeBlockColors(mode: SignalChainVisualMode | RoomMode) {
  switch (mode) {
    case 'campfire':
      return {
        backgroundColor: tacticalTokens.colors.orange,
        borderColor: tacticalTokens.colors.orange,
        color: tacticalTokens.colors.void,
      };
    case 'openFloor':
      return {
        backgroundColor: tacticalTokens.colors.acid,
        borderColor: tacticalTokens.colors.acid,
        color: tacticalTokens.colors.void,
      };
    default:
      return {
        backgroundColor: tacticalTokens.colors.white,
        borderColor: tacticalTokens.colors.white,
        color: tacticalTokens.colors.void,
      };
  }
}

export function formatModeLabel(mode: SignalChainVisualMode | RoomMode): string {
  switch (mode) {
    case 'campfire':
      return 'CAMPFIRE';
    case 'spotlight':
      return 'SPOTLIGHT';
    case 'openFloor':
      return 'OPEN FLR';
    default:
      return String(mode).toUpperCase();
  }
}
