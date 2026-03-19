/**
 * ChromeButton → Tactical Brutalist Button
 * ─────────────────────────────────────────────────────────────
 * Flat background, thin glowing borders, and mono uppercase fonts.
 * Fits Tactical V2 aesthetics, replacing old pill buttons globally.
 *
 * Variants:
 *   'default': Flat #111 with #00E5FF neon border
 *   'glowing': Solid neon fill with #000 text
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
import { tapLight } from '../../../utils/haptics';
import { useTheme } from '../../../contexts/ThemeContext';
import { fontFamily } from '../../tokens/typography';

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
  sm: { paddingHorizontal: 16, paddingVertical: 10, minHeight: 36 },
  md: { paddingHorizontal: 20, paddingVertical: 14, minHeight: 44 },
  lg: { paddingHorizontal: 24, paddingVertical: 18, minHeight: 52 },
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
  const { isVoltageSag } = useTheme();
  const sizes = sizeMap[size];

  const isGlowing = variant === 'glowing';
  
  // Tactical colors
  const primaryAccent = isVoltageSag ? '#FF4500' : '#39FF14';
  const secondaryAccent = '#00E5FF';

  const bgColor = isGlowing ? primaryAccent : '#111111';
  const borderColor = isGlowing ? primaryAccent : secondaryAccent;
  const textColor = isGlowing ? '#000000' : secondaryAccent;

  const pressedBg = isGlowing ? '#0A0A0A' : '#1A1A1A';
  const pressedTextColor = isGlowing ? primaryAccent : '#FFFFFF';

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
          borderColor: isPressed ? pressedTextColor : borderColor,
          opacity: disabled ? 0.3 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          {
            color: isPressed ? pressedTextColor : textColor,
          },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
