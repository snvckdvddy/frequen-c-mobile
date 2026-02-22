/**
 * Frequen-C Typography Tokens
 * ─────────────────────────────────────────────────────────────
 * 4-tier type system: Display, Mono, Label, Body
 *
 * Display (Chakra Petch) — futuristic, personality. Room names, track titles.
 * Mono (Space Mono) — technical, precise. Timestamps, BPM, CV, dB values.
 * Label (Inter Bold, caps, wide tracking) — engraved hardware labels.
 * Body (Inter Regular) — descriptions, chat, secondary info.
 *
 * Font files must be loaded via expo-font before use.
 * See: src/design/fonts/ for .ttf files.
 */

// ─── Font Families ──────────────────────────────────────────

export const fontFamily = {
  display: 'ChakraPetch-SemiBold',
  displayBold: 'ChakraPetch-Bold',
  displayRegular: 'ChakraPetch-Regular',
  mono: 'SpaceMono-Regular',
  monoBold: 'SpaceMono-Bold',
  label: 'Inter-Bold',
  body: 'Inter-Regular',
} as const;

// Map for expo-font require() calls
export const fontAssets = {
  'ChakraPetch-Regular': require('../fonts/ChakraPetch-Regular.ttf'),
  'ChakraPetch-SemiBold': require('../fonts/ChakraPetch-SemiBold.ttf'),
  'ChakraPetch-Bold': require('../fonts/ChakraPetch-Bold.ttf'),
  'SpaceMono-Regular': require('../fonts/SpaceMono-Regular.ttf'),
  'SpaceMono-Bold': require('../fonts/SpaceMono-Bold.ttf'),
  'Inter-Regular': require('../fonts/Inter-Regular.ttf'),
  'Inter-Bold': require('../fonts/Inter-Bold.ttf'),
} as const;

// ─── Type Scale (px) ────────────────────────────────────────
// Based on a 1.25 modular scale from 14px base

export const fontSize = {
  xs: 10,
  sm: 11,
  base: 13,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 36,
} as const;

// ─── Font Weights ───────────────────────────────────────────

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ─── Letter Spacing ─────────────────────────────────────────

export const letterSpacing = {
  tight: -0.5,      // Display headings, compact
  normal: 0,        // Body text
  wide: 1.5,        // Label text (0.15em at ~10px)
  wider: 2.0,       // Emphasized labels
  widest: 3.0,      // Hero labels, section titles
} as const;

// ─── Line Heights ───────────────────────────────────────────

export const lineHeight = {
  tight: 1.1,       // Display headings — minimal leading
  snug: 1.25,       // Compact text blocks
  normal: 1.5,      // Body text
  relaxed: 1.65,    // Readable paragraphs
} as const;

// ─── Preset Text Styles ─────────────────────────────────────
// Use these directly: <Text style={textStyle.trackTitle}>

export const textStyle = {
  // Display tier — Chakra Petch
  roomName: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  trackTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  sectionHeading: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },

  // Mono tier — Space Mono
  timestamp: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  dataLarge: {
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.tight,
    letterSpacing: letterSpacing.normal,
  },
  dataSmall: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  cvValue: {
    fontFamily: fontFamily.monoBold,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.tight,
    letterSpacing: letterSpacing.wide,
  },

  // Label tier — Inter Bold, uppercase, wide tracking
  moduleLabel: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase' as const,
  },
  sectionLabel: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase' as const,
  },

  // Body tier — Inter Regular
  bodyPrimary: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.md,
    lineHeight: fontSize.md * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodySecondary: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
  caption: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    letterSpacing: letterSpacing.normal,
  },
} as const;
