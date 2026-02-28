/**
 * StatusLight — Indicator dot with emission variants.
 * ─────────────────────────────────────────────────────────────
 * Small status indicator with optional glow/pulse effects.
 * Used for signal presence, mode indicators, warnings.
 *
 * Variants:
 *   'off': Dim, inactive
 *   'on': Bright, solid glow
 *   'pulse': Animated breathing pulse
 *
 * Colors:
 *   'ice' (default): Cyan (signal present)
 *   'amber': Orange (warning/voltage sag)
 *   'green': Green (success/enabled)
 *   'red': Red (error/clipping)
 *
 * Usage:
 *   <StatusLight variant="on" />
 *   <StatusLight variant="pulse" color="amber" size="lg" />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { palette, glow } from '../../tokens/materials';
import { emissionPulse } from '../../tokens/animation';

type LightVariant = 'off' | 'on' | 'pulse';
type LightColor = 'ice' | 'amber' | 'green' | 'red';
type LightSize = 'sm' | 'md' | 'lg';

interface StatusLightProps {
  /** Variant. Default: 'on' */
  variant?: LightVariant;
  /** Color. Default: 'ice' */
  color?: LightColor;
  /** Size preset. Default: 'md' */
  size?: LightSize;
  /** Override container style */
  style?: StyleProp<ViewStyle>;
}

const sizeMap = {
  sm: 6,
  md: 8,
  lg: 12,
};

const colorMap: Record<LightColor, { core: string; glow: string }> = {
  ice: { core: palette.ice, glow: glow.ice.core },
  amber: { core: palette.amber, glow: glow.amber.core },
  green: { core: '#10B981', glow: 'rgba(16, 185, 129, 0.6)' },
  red: { core: '#EF4444', glow: 'rgba(239, 68, 68, 0.6)' },
};

export function StatusLight({
  variant = 'on',
  color = 'ice',
  size = 'md',
  style,
}: StatusLightProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const sizeValue = sizeMap[size];
  const colorConfig = colorMap[color];

  // Setup pulse animation
  useEffect(() => {
    if (variant === 'pulse') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: emissionPulse.idle.durationMs / 2,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: emissionPulse.idle.durationMs / 2,
            useNativeDriver: false,
          }),
        ]),
      ).start();
    }
  }, [variant, pulseAnim]);

  const opacity =
    variant === 'off'
      ? 0.4
      : variant === 'pulse'
        ? pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [
              emissionPulse.idle.minOpacity,
              emissionPulse.idle.maxOpacity,
            ],
          })
        : 1;

  const glowOpacity =
    variant === 'off'
      ? 0
      : variant === 'pulse'
        ? pulseAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.1, 0.4],
          })
        : 0.3;

  return (
    <View style={[styles.container, style]}>
      {/* Glow halo (behind core) */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: sizeValue * 2.5,
            height: sizeValue * 2.5,
            borderRadius: (sizeValue * 2.5) / 2,
            backgroundColor: colorConfig.glow,
            opacity: glowOpacity,
          },
        ]}
      />

      {/* Core light */}
      <Animated.View
        style={[
          styles.core,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
            backgroundColor: colorConfig.core,
            opacity,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
  },
  core: {
    zIndex: 1,
  },
});
