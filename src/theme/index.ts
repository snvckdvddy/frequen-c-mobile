/**
 * Frequen-C Theme — unified export
 *
 * Usage:
 *   import { theme } from '@/theme';
 *   <View style={{ backgroundColor: theme.colors.bg.primary }} />
 */

export { colors, default as colorsDefault } from './colors';
export { typography, default as typographyDefault } from './typography';
export { spacing, default as spacingDefault } from './spacing';

import colors from './colors';
import typography from './typography';
import spacing from './spacing';

export const theme = {
  colors,
  typography,
  spacing,
} as const;

export type Theme = typeof theme;
export default theme;
