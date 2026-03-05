/**
 * Frequen-C Semantic Color Tokens
 * ─────────────────────────────────────────────────────────────
 * Intent-based color aliases that map to the palette.
 * Screens should NEVER import `palette` directly — use these
 * semantic tokens so theme changes propagate everywhere.
 *
 * Usage:
 *   import { colors } from '@/design/tokens';
 *   style={{ color: colors.textPrimary, backgroundColor: colors.surfaceCard }}
 */

import { palette, withAlpha } from './materials';

// ─── Semantic Color Map ─────────────────────────────────────

export const colors = {
  // ─── Text hierarchy ────────────────────────────────────
  textPrimary: palette.frost,        // Headings, primary labels
  textSecondary: palette.silver,     // Sub-labels, artist names
  textTertiary: palette.slate,       // Muted hints, timestamps
  textDisabled: palette.textDim,     // Disabled/inactive text
  textInverse: palette.void,         // Text on bright backgrounds

  // ─── Surfaces ──────────────────────────────────────────
  surfaceBase: palette.void,         // App background
  surfaceCard: palette.midnight,     // Card backgrounds
  surfaceRaised: palette.steel,      // Raised elements (chips, badges)
  surfaceInteractive: palette.gunmetal, // Pressable surface base
  surfaceOverlay: withAlpha(palette.void, 0.85), // Modal/sheet backdrop

  // ─── Accent: Primary (Orange) ──────────────────────────
  accentPrimary: palette.orange,     // CTAs, play buttons, active states
  accentPrimaryGlow: palette.orangeGlow,
  accentPrimaryDim: palette.orangeDim,
  accentPrimarySubtle: withAlpha(palette.orange, 0.10), // Tab active bg, hover hints

  // ─── Accent: Secondary (Ice Cyan) ─────────────────────
  accentSecondary: palette.ice,      // Status indicators, system highlights
  accentSecondaryGlow: palette.iceGlow,
  accentSecondarySubtle: withAlpha(palette.ice, 0.08),

  // ─── Status / Feedback ─────────────────────────────────
  statusSuccess: palette.green,      // CV earned, success toasts
  statusSuccessSubtle: withAlpha(palette.green, 0.08),
  statusSuccessBorder: withAlpha(palette.green, 0.20),

  statusWarning: palette.amber,      // Voltage sag, warnings
  statusWarningSubtle: withAlpha(palette.amber, 0.08),

  statusError: palette.red,          // Destructive, live badge
  statusErrorSubtle: withAlpha(palette.red, 0.08),

  statusLive: palette.red,           // ACTIVE PATCH badge specifically
  statusLiveGlow: withAlpha(palette.red, 0.30),

  // ─── Borders / Chrome ──────────────────────────────────
  border: palette.chromeBorder,       // Default card/chip border
  borderSubtle: 'rgba(148, 163, 184, 0.08)', // Very faint separators
  borderActive: palette.orange,       // Active/focused input border
  borderHighlight: palette.chromeHighlight,

  // ─── Room Mode Identity ────────────────────────────────
  modeCampfire: palette.signalSine,   // Orange — warm
  modeSpotlight: palette.signalSquare, // Pink — hot
  modeOpenFloor: palette.signalSaw,   // Chrome blue — cool

  // ─── CV Economy ────────────────────────────────────────
  cvPositive: palette.green,          // CV earned / balance
  cvSpend: palette.orange,            // CV spent on power moves
  cvInsufficient: palette.red,        // Not enough CV warning

  // ─── Miscellaneous ─────────────────────────────────────
  divider: 'rgba(148, 163, 184, 0.10)',
  skeleton: 'rgba(148, 163, 184, 0.06)', // Placeholder shimmer base
  skeletonHighlight: 'rgba(148, 163, 184, 0.12)',
} as const;

// Re-export palette for rare cases where raw values are needed
// (e.g., Skia shader gradients, SVG fills)
export { palette };
