/**
 * Frequen-C Typography Tokens
 * ─────────────────────────────────────────────────────────────
 * 4-tier type system: Display, Mono, Label, Body
 *
 * Display (Chakra Petch) — futuristic, personality. Room names, track titles.
 * Mono (Space Mono) — technical, precise. Timestamps, BPM, CV, dB values.
 * Label (Outfit Bold, caps, wide tracking) — engraved hardware labels.
 * Body (Outfit Regular/Medium) — descriptions, chat, secondary info.
 *
 * Font files must be loaded via expo-font before use.
 * See: src/design/fonts/ for .ttf files.
 *
 * NOTE: RN doesn't support fontWeight on custom fonts — each weight
 * needs its own .ttf file and fontFamily name. Outfit was originally
 * a variable font but caused SIGBUS crashes on iOS; now uses static
 * instances (Outfit-Regular, Outfit-Medium, Outfit-Bold).
 */

// ─── Font Families ──────────────────────────────────────────

export const fontFamily = {
  display: 'ChakraPetch-SemiBold',
  displayMedium: 'ChakraPetch-Medium',
  displayRegular: 'ChakraPetch-Regular',
  displayBold: 'ChakraPetch-Bold',
  mono: 'SpaceMono-Regular',
  monoBold: 'SpaceMono-Bold',
  label: 'Outfit-Bold',      // Label text: uppercase, wide tracking
  body: 'Outfit-Regular',    // Body text: descriptions, chat
  bodyMedium: 'Outfit-Medium', // Emphasized body text
} as const;

// Map for expo-font require() calls
export const fontAssets = {
  'ChakraPetch-Regular': require('../fonts/ChakraPetch-Regular.ttf'),
  'ChakraPetch-Medium': require('../fonts/ChakraPetch-Medium.ttf'),
  'ChakraPetch-SemiBold': require('../fonts/ChakraPetch-SemiBold.ttf'),
  'ChakraPetch-Bold': require('../fonts/ChakraPetch-Bold.ttf'),
  'SpaceMono-Regular': require('../fonts/SpaceMono-Regular.ttf'),
  'SpaceMono-Bold': require('../fonts/SpaceMono-Bold.ttf'),
  // Static instances replace the variable font that caused SIGBUS crashes on iOS
  'Outfit': require('../fonts/Outfit-Regular.ttf'),
  'Outfit-Regular': require('../fonts/Outfit-Regular.ttf'),
  'Outfit-Medium': require('../fonts/Outfit-Medium.ttf'),
  'Outfit-Bold': require('../fonts/Outfit-Bold.ttf'),
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
  thin: '200' as const,       // Brand hero letters only (LoginScreen)
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ─── Letter Spacing ─────────────────────────────────────────

export const letterSpacing = {
  tighter: -2.0,    // Brand hero letters only (LoginScreen)
  tight: -0.5,      // Display headings, compact
  normal: 0,        // Body text
  wide: 1.5,        // Label text (0.15em at ~10px)
  wider: 2.0,       // Emphasized labels
  widest: 3.0,      // Hero labels, section titles
  ultraWide: 4.0,   // Brand tagline (RegisterScreen)
  heroWide: 6.0,    // Brand tag hero (LoginScreen)
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

  // Label tier — Outfit Bold, uppercase, wide tracking
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

  // Body tier — Outfit Regular
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

  // Brand tier — Login/Register hero typography
  brandHeroLetter: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['5xl'],
    lineHeight: 72,
    fontWeight: fontWeight.thin,
    letterSpacing: letterSpacing.tighter,
  },
  brandTag: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
    letterSpacing: letterSpacing.heroWide,
    textTransform: 'uppercase' as const,
  },
} as const;
