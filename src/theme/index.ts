/**
 * Frequen-C Theme — unified export
 *
 * Usage:
 *   import { theme } from '@/theme';
 *   import { palette } from '@/design/tokens/materials';
 *   <View style={{ backgroundColor: palette.midnight }} />
 */

export { typography, default as typographyDefault } from './typography';
export { spacing, default as spacingDefault } from './spacing';

import typography from './typography';
import spacing from './spacing';

export const theme = {
  typography,
  spacing,
} as const;

export type Theme = typeof theme;
export default theme;
