/**
 * ChromeButton — Hardware-style interactive button.
 * ─────────────────────────────────────────────────────────────
 * Multi-stop chrome gradient with specular highlights and press feedback.
 * Matches Gemini V7 prototype `.chrome-btn` class.
 *
 * Variants:
 *   'default': Neutral chrome finish
 *   'glowing': Chrome with primary color glow halo
 *
 * Press behavior: Gradient inverts, slight inset shadow, slight translateY(2px)
 *
 * Usage:
 *   <ChromeButton onPress={() => play()}>PLAY</ChromeButton>
 *   <ChromeButton variant="glowing" size="lg">REC</ChromeButton>
 */

import React, { useState } from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, materials, glow } from '../../tokens/materials';
import { elevation } from '../../tokens/elevation';
import { tapLight } from '../../../utils/haptics';

type ButtonVariant = 'default' | 'glowing';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ChromeButtonProps extends Omit<PressableProps, 'style'> {
  /** Button label or content */
  children: React.ReactNode;
  /** Variant style. Default: 'default' */
  variant?: ButtonVariant;
  /** Size preset. Default: 'md' */
  size?: ButtonSize;
  /** Disable button state */
  disabled?: boolean;
  /** Override container style */
  style?: StyleProp<ViewStyle>;
}

const sizeMap = {
  sm: { paddingHorizontal: 8, paddingVertical: 6, minHeight: 28 },
  md: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 36 },
  lg: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
};

// Chrome gradient stops from materials
const chromeColors = materials.chrome.gradientStops.map((s) => s.color) as unknown as [
  string,
  string,
  ...string[],
];
const chromeLocations = materials.chrome.gradientStops.map((s) => s.offset) as unknown as [
  number,
  number,
  ...number[],
];

function angleToPoints(degrees: number) {
  const rad = ((degrees - 90) * Math.PI) / 180;
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  return {
    start: { x: 0.5 - x / 2, y: 0.5 - y / 2 },
    end: { x: 0.5 + x / 2, y: 0.5 + y / 2 },
  };
}

const chromeGradientPoints = angleToPoints(materials.chrome.gradientAngle);

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
  const sizes = sizeMap[size];

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
      style={[styles.container, style]}
      {...rest}
    >
      {/* Chrome gradient background */}
      <LinearGradient
        colors={chromeColors}
        locations={chromeLocations}
        start={chromeGradientPoints.start}
        end={chromeGradientPoints.end}
        style={[
          styles.gradientBase,
          sizes,
          disabled && styles.disabledGradient,
        ]}
      />

      {/* Top specular highlight (normal state only) */}
      {!isPressed && <View style={styles.specularHighlight} />}

      {/* Inset shadow on press */}
      {isPressed && <View style={styles.insetShadow} />}

      {/* Glow halo for 'glowing' variant */}
      {variant === 'glowing' && !disabled && (
        <View style={styles.glowHalo} />
      )}

      {/* Content */}
      <Text
        style={[
          styles.label,
          {
            opacity: disabled ? 0.5 : 1,
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
    borderRadius: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientBase: {
    ...StyleSheet.absoluteFillObject,
  },
  disabledGradient: {
    opacity: 0.5,
  },
  specularHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  insetShadow: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  glowHalo: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 4,
    backgroundColor: palette.ice,
    opacity: 0.08,
    zIndex: -1,
  },
  label: {
    fontWeight: '700',
    fontSize: 13,
    color: palette.white,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    zIndex: 2,
  },
});
