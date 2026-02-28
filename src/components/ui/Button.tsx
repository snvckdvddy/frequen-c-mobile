/**
 * Themed Button component
 * Supports primary, secondary, ghost, and destructive variants.
 * Includes loading state and haptic feedback (when expo-haptics is installed).
 */

import React from 'react';
import {
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: {
    bg: palette.orange,        // Orange background
    text: palette.void,   // Dark text on orange — convergence strategy §4.3
    border: 'transparent',
  },
  secondary: {
    bg: 'transparent',
    text: palette.orange,
    border: palette.orange,
  },
  ghost: {
    bg: 'transparent',
    text: palette.frost,         // Frost white for ghost — more visible than silver
    border: 'transparent',
  },
  destructive: {
    bg: 'transparent',                 // Transparent bg, not filled — convergence strategy §4.3
    text: palette.red,   // Red text
    border: palette.red, // Red border
  },
};

const sizeStyles: Record<ButtonSize, { height: number; paddingH: number; fontSize: number }> = {
  sm: { height: 36, paddingH: 14, fontSize: 13 },
  md: { height: 48, paddingH: 20, fontSize: 15 },
  lg: { height: 56, paddingH: 28, fontSize: 17 },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
}: ButtonProps) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={loading ? `${title}, loading` : title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: (variant === 'secondary' || variant === 'destructive') ? 1 : 0,  // §4.3 — 1pt
          height: (variant === 'secondary' || variant === 'destructive') && size === 'md' ? 44 : s.height,  // §4.3 — secondary/destructive 44pt
          paddingHorizontal: s.paddingH,
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <>
          {icon}
          <Text
            variant="labelLarge"
            color={v.text}
            style={{ fontSize: s.fontSize, marginLeft: icon ? 8 : 0 }}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.radius.full,  // Full-round pill — convergence strategy §4.3
  },
  fullWidth: {
    width: '100%',
  },
});

export default Button;
