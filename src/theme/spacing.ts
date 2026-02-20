/**
 * Frequen-C Spacing System — Y2K Edition
 *
 * 4px base grid. Generous breathing room.
 * Y2K = clean, modular, well-spaced. Let elements float.
 */

export const spacing = {
  // Base grid increments
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,

  // Semantic aliases — bumped up for breathing room
  xs: 4,
  sm: 10,
  md: 18,
  lg: 28,
  xl: 40,
  '2xl': 56,
  '3xl': 72,

  // Component-specific
  screenPadding: 24,       // was 20 → more side margin
  cardPadding: 20,         // was 16 → cards feel less cramped
  sectionGap: 36,          // NEW: gap between major sections
  inputPadding: 16,        // was 14 → roomier inputs
  iconSize: {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  },

  // Border radius — slightly larger for Y2K softness
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
} as const;

export default spacing;
