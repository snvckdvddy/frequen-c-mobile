/**
 * ChromeButton → Modern Button
 * ─────────────────────────────────────────────────────────────
 * Clean solid-fill button with rounded corners and subtle press
 * feedback. No chrome gradients, no specular highlights.
 *
 * Variants:
 *   'default': Subtle warm surface fill
 *   'glowing': Primary accent-colored fill
 *
 * Usage:
 *   <ChromeButton onPress={() => play()}>PLAY</ChromeButton>
 *   <ChromeButton variant="glowing" size="lg">REC</ChromeButton>
 */

import React, { useState } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PressableProps,
} from 'react-native';
import { palette } from '../../tokens/materials';
import { tapLight } from '../../../utils/haptics';
import { useTheme } from '../../../contexts/ThemeContext';

type ButtonVariant = 'default' | 'glowing';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ChromeButtonProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const sizeMap = {
  sm: { paddingHorizontal: 12, paddingVertical: 7, minHeight: 30 },
  md: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 38 },
  lg: { paddingHorizontal: 20, paddingVertical: 13, minHeight: 46 },
};

export function ChromeButton({
  children,
  variant = 'default',
  size = 'md',
  disabled = false,
  style,
  onPress,
  ...rest
}: ChromeButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const { isVoltageSag, accent } = useTheme();
  const sizes = sizeMap[size];

  const isGlowing = variant === 'glowing';
  const bgColor = isGlowing
    ? (isVoltageSag ? accent : palette.orange)
    : palette.gunmetal;
  const pressedBg = isGlowing
    ? palette.orangeDim
    : palette.steel;

  const handlePress = (e: any) => {
    if (!disabled) {
      tapLight();
      onPress?.(e);
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={disabled}
      style={[
        styles.container,
        sizes,
        {
          backgroundColor: isPressed ? pressedBg : bgColor,
          opacity: disabled ? 0.5 : 1,
          borderColor: isGlowing ? 'transparent' : palette.chromeBorder,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          isGlowing && { color: palette.frost },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontWeight: '600',
    fontSize: 13,
    color: palette.frost,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
