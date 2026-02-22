/**
 * ChromeSurface — Polished metallic gradient material.
 * ─────────────────────────────────────────────────────────────
 * Multi-stop gradient simulating metal reflection bands.
 * Optional specular highlight along top edge.
 *
 * Rendering stack:
 *   Skia (future): Animated gradient with scroll-linked angle
 *   Fallback (current): expo-linear-gradient with static angle
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { materials } from '../../tokens/materials';

interface ChromeSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Show thin specular highlight on top edge. Default: true */
  specular?: boolean;
  /** Gradient angle override (degrees). Default: 135 */
  angle?: number;
}

// Convert angle in degrees to LinearGradient start/end points
function angleToPoints(degrees: number) {
  const rad = ((degrees - 90) * Math.PI) / 180;
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  return {
    start: { x: 0.5 - x / 2, y: 0.5 - y / 2 },
    end: { x: 0.5 + x / 2, y: 0.5 + y / 2 },
  };
}

// Cast to tuple types for expo-linear-gradient
const chromeColors = materials.chrome.gradientStops.map((s) => s.color) as unknown as [string, string, ...string[]];
const chromeLocations = materials.chrome.gradientStops.map((s) => s.offset) as unknown as [number, number, ...number[]];

export function ChromeSurface({
  children,
  style,
  specular = true,
  angle = materials.chrome.gradientAngle,
}: ChromeSurfaceProps) {
  const { start, end } = angleToPoints(angle);

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={chromeColors}
        locations={chromeLocations}
        start={start}
        end={end}
        style={StyleSheet.absoluteFill}
      />

      {/* Top-edge specular highlight */}
      {specular && <View style={styles.specular} />}

      {/* Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: materials.chrome.specularHighlight.height,
    backgroundColor: materials.chrome.specularHighlight.color,
  },
});
