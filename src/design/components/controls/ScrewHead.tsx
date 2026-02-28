/**
 * ScrewHead — Decorative rack mounting screw.
 * ─────────────────────────────────────────────────────────────
 * Radial gradient circle simulating a beveled screw head.
 * Used at corners of modules or along rails.
 *
 * Position variants:
 *   'tl' (top-left), 'tr' (top-right),
 *   'bl' (bottom-left), 'br' (bottom-right)
 *
 * Usage:
 *   <ScrewHead position="tl" />
 *   <ScrewHead position="br" size="lg" />
 */

import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { rackHardware } from '../../tokens/elevation';

type ScrewPosition = 'tl' | 'tr' | 'bl' | 'br';
type ScrewSize = 'sm' | 'md' | 'lg';

interface ScrewHeadProps {
  /** Position variant. Default: 'tl' */
  position?: ScrewPosition;
  /** Size preset. Default: 'md' */
  size?: ScrewSize;
  /** Override container style */
  style?: StyleProp<ViewStyle>;
}

const sizeMap = {
  sm: 6,
  md: 8,
  lg: 10,
};

const positionMap: Record<ScrewPosition, ViewStyle> = {
  tl: { top: 6, left: 6 },
  tr: { top: 6, right: 6 },
  bl: { bottom: 6, left: 6 },
  br: { bottom: 6, right: 6 },
};

export function ScrewHead({
  position = 'tl',
  size = 'md',
  style,
}: ScrewHeadProps) {
  const sizeValue = sizeMap[size];
  const positionStyle = positionMap[position];

  // Radial gradient: center lighter, edges darker
  const gradientColors = [
    'rgba(255, 255, 255, 0.15)',
    'rgba(100, 110, 130, 0.4)',
  ] as unknown as [string, string, ...string[]];

  return (
    <View
      style={[
        styles.container,
        positionStyle,
        {
          width: sizeValue,
          height: sizeValue,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={[
          styles.screw,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
          },
        ]}
      />

      {/* Top-left highlight shadow */}
      <View
        style={[
          styles.highlight,
          {
            borderRadius: sizeValue / 2,
            width: sizeValue * 0.4,
            height: sizeValue * 0.4,
          },
        ]}
      />

      {/* Subtle border */}
      <View
        style={[
          styles.border,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  screw: {
    position: 'absolute',
  },
  highlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
    borderRadius: 2,
  },
  border: {
    position: 'absolute',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
});
