/**
 * Frequen-C Typography System
 *
 * Using system fonts for now (SF Pro on iOS, Roboto on Android).
 * Custom fonts (if desired) can be loaded via expo-font later.
 *
 * Scale follows a musical interval ratio — minor third (1.2)
 * because of course it does.
 */

import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

const fontFamilyMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

// ─── Size Scale (Minor Third — 1.2 ratio) ──────────────────
const size = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 18,
  lg: 22,
  xl: 26,
  '2xl': 31,
  '3xl': 37,
  '4xl': 45,
} as const;

// ─── Weight Map ─────────────────────────────────────────────
const weight = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semibold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  heavy: '800' as TextStyle['fontWeight'],
};

// ─── Line Height Multipliers ────────────────────────────────
const lineHeightMultiplier = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
};

// ─── Preset Styles ──────────────────────────────────────────
// Use these directly in components. Each preset is a complete TextStyle.

export const typography = {
  // Display — big moments (session titles, onboarding)
  displayLarge: {
    fontFamily,
    fontSize: size['4xl'],
    fontWeight: weight.heavy,
    lineHeight: size['4xl'] * lineHeightMultiplier.tight,
    letterSpacing: -1.5,
  } as TextStyle,

  displaySmall: {
    fontFamily,
    fontSize: size['3xl'],
    fontWeight: weight.bold,
    lineHeight: size['3xl'] * lineHeightMultiplier.tight,
    letterSpacing: -1,
  } as TextStyle,

  // Headlines — section headers, card titles
  h1: {
    fontFamily,
    fontSize: size['2xl'],
    fontWeight: weight.bold,
    lineHeight: size['2xl'] * lineHeightMultiplier.tight,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontFamily,
    fontSize: size.xl,
    fontWeight: weight.semibold,
    lineHeight: size.xl * lineHeightMultiplier.tight,
    letterSpacing: -0.3,
  } as TextStyle,

  h3: {
    fontFamily,
    fontSize: size.lg,
    fontWeight: weight.semibold,
    lineHeight: size.lg * lineHeightMultiplier.normal,
    letterSpacing: 0,
  } as TextStyle,

  // Body — primary reading text
  bodyLarge: {
    fontFamily,
    fontSize: size.md,
    fontWeight: weight.regular,
    lineHeight: size.md * lineHeightMultiplier.relaxed,
  } as TextStyle,

  body: {
    fontFamily,
    fontSize: size.base,
    fontWeight: weight.regular,
    lineHeight: size.base * lineHeightMultiplier.relaxed,
  } as TextStyle,

  bodySmall: {
    fontFamily,
    fontSize: size.sm,
    fontWeight: weight.regular,
    lineHeight: size.sm * lineHeightMultiplier.relaxed,
  } as TextStyle,

  // Labels — buttons, tabs, metadata
  labelLarge: {
    fontFamily,
    fontSize: size.base,
    fontWeight: weight.semibold,
    lineHeight: size.base * lineHeightMultiplier.normal,
    letterSpacing: 0.3,
  } as TextStyle,

  label: {
    fontFamily,
    fontSize: size.sm,
    fontWeight: weight.medium,
    lineHeight: size.sm * lineHeightMultiplier.normal,
    letterSpacing: 0.2,
  } as TextStyle,

  labelSmall: {
    fontFamily,
    fontSize: size.xs,
    fontWeight: weight.medium,
    lineHeight: size.xs * lineHeightMultiplier.normal,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  } as TextStyle,

  // Mono — codes, timestamps, technical info
  mono: {
    fontFamily: fontFamilyMono,
    fontSize: size.sm,
    fontWeight: weight.regular,
    lineHeight: size.sm * lineHeightMultiplier.normal,
  } as TextStyle,

  // Utility exports
  size,
  weight,
  fontFamily,
  fontFamilyMono,
} as const;

export default typography;
