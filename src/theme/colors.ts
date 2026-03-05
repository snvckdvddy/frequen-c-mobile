/**
 * Frequen-C legacy theme colors.
 *
 * Kept for backward compatibility, but values are sourced from the
 * current design token palette so visuals stay aligned system-wide.
 */

import { palette } from '../design/tokens/materials';

const legacyPalette = {
  void: palette.void,
  midnight: palette.midnight,
  steel: palette.steel,
  gunmetal: palette.gunmetal,

  ice: palette.ice,
  hotPink: palette.magenta,
  warmOrange: palette.orange,
  chromeBlue: palette.signalSaw,
  neonGreen: palette.green,

  frost: palette.frost,
  silver: palette.silver,
  slate: palette.slate,
  darkSteel: palette.chromeBorder,

  iceGlow: 'rgba(90, 200, 200, 0.12)',
  iceSubtle: 'rgba(90, 200, 200, 0.08)',
  iceFaint: 'rgba(90, 200, 200, 0.04)',
  iceOverlay: 'rgba(90, 200, 200, 0.20)',
  pinkGlow: 'rgba(244, 114, 182, 0.10)',
  chromeGlow: 'rgba(147, 197, 253, 0.08)',
} as const;

export const colors = {
  bg: {
    primary: legacyPalette.void,
    surface: legacyPalette.midnight,
    elevated: legacyPalette.steel,
    input: legacyPalette.gunmetal,
    overlay: 'rgba(15, 16, 18, 0.88)',
  },

  text: {
    primary: legacyPalette.frost,
    secondary: legacyPalette.silver,
    muted: legacyPalette.slate,
    inverse: legacyPalette.void,
  },

  border: {
    default: legacyPalette.darkSteel,
    subtle: 'rgba(90, 200, 200, 0.06)',
    focus: legacyPalette.ice,
  },

  action: {
    primary: legacyPalette.ice,
    primaryText: legacyPalette.void,
    secondary: legacyPalette.chromeBlue,
    destructive: legacyPalette.hotPink,
  },

  session: {
    live: legacyPalette.neonGreen,
    liveGlow: 'rgba(52, 211, 153, 0.12)',
    campfire: legacyPalette.warmOrange,
    spotlight: legacyPalette.hotPink,
    openFloor: legacyPalette.chromeBlue,
  },

  voltage: {
    charge: legacyPalette.chromeBlue,
    chargeGlow: legacyPalette.chromeGlow,
    spent: legacyPalette.slate,
    boost: legacyPalette.hotPink,
  },

  queue: {
    myTrack: legacyPalette.ice,
    myTrackGlow: legacyPalette.iceGlow,
    otherTrack: legacyPalette.steel,
    nowPlaying: legacyPalette.ice,
    upNext: legacyPalette.chromeBlue,
  },

  contribution: {
    active: legacyPalette.ice,
    recent: legacyPalette.chromeBlue,
    idle: legacyPalette.slate,
    streak: legacyPalette.warmOrange,
  },

  reaction: {
    fire: legacyPalette.warmOrange,
    vibe: legacyPalette.hotPink,
    skip: legacyPalette.slate,
  },

  chrome: {
    border: legacyPalette.darkSteel,
    surface: 'rgba(255, 255, 255, 0.04)',
    highlight: 'rgba(255, 255, 255, 0.12)',
    text: legacyPalette.chromeBlue,
  },

  signal: {
    sine: legacyPalette.warmOrange,
    square: legacyPalette.hotPink,
    saw: legacyPalette.chromeBlue,
    noise: legacyPalette.slate,
  },

  cv: {
    positive: legacyPalette.neonGreen,
    negative: legacyPalette.hotPink,
    neutral: legacyPalette.silver,
  },

  highlight: {
    ice: legacyPalette.iceGlow,
    iceSubtle: legacyPalette.iceSubtle,
    iceFaint: legacyPalette.iceFaint,
    iceOverlay: legacyPalette.iceOverlay,
    pink: legacyPalette.pinkGlow,
    chrome: legacyPalette.chromeGlow,
  },

  raw: legacyPalette,
} as const;

export type ColorToken = typeof colors;
export default colors;
