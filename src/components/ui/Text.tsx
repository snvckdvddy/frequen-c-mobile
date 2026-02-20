/**
 * Themed Text component
 * Wraps React Native Text with our typography presets and color tokens.
 */

import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet, TextStyle } from 'react-native';
import { typography } from '../../theme/typography';
import { colors } from '../../theme/colors';

/** Only the keys that map to TextStyle presets (exclude utility exports) */
type Variant =
  | 'displayLarge' | 'displaySmall'
  | 'h1' | 'h2' | 'h3'
  | 'bodyLarge' | 'body' | 'bodySmall'
  | 'labelLarge' | 'label' | 'labelSmall'
  | 'mono';

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function Text({
  variant = 'body',
  color = colors.text.primary,
  align = 'left',
  style,
  children,
  ...props
}: TextProps) {
  const variantStyle = typography[variant] as TextStyle;

  return (
    <RNText
      style={[variantStyle, { color, textAlign: align }, style]}
      {...props}
    >
      {children}
    </RNText>
  );
}

export default Text;
