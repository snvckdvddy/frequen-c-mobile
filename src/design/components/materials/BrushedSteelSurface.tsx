/**
 * BrushedSteelSurface — Anodized aluminum with directional grain.
 * ─────────────────────────────────────────────────────────────
 * The workhorse surface for cards and modules at rest.
 * Has subtle horizontal brush lines over a base gradient.
 *
 * Rendering stack:
 *   Skia (future): Directional noise shader
 *   Fallback (current): expo-linear-gradient + SVG line pattern
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Pattern, Line, Rect } from 'react-native-svg';
import { materials } from '../../tokens/materials';

interface BrushedSteelSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Show brush grain lines. Default: true */
  grain?: boolean;
}

// Cast to tuple types for expo-linear-gradient
const steelColors = materials.brushedSteel.baseGradient.map((s) => s.color) as unknown as [string, string, ...string[]];
const steelLocations = materials.brushedSteel.baseGradient.map((s) => s.offset) as unknown as [number, number, ...number[]];

export function BrushedSteelSurface({
  children,
  style,
  grain = true,
}: BrushedSteelSurfaceProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Base gradient */}
      <LinearGradient
        colors={steelColors}
        locations={steelLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Directional grain overlay */}
      {grain && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <Pattern
                id="brushGrain"
                patternUnits="userSpaceOnUse"
                width="100%"
                height={materials.brushedSteel.brushLines.spacing}
              >
                <Line
                  x1="0"
                  y1="0"
                  x2="100%"
                  y2="0"
                  stroke={materials.brushedSteel.brushLines.color}
                  strokeWidth="0.5"
                />
              </Pattern>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#brushGrain)" />
          </Svg>
        </View>
      )}

      {/* Top edge highlight — simulates light catching anodized edge */}
      <View style={styles.topEdge} />

      {/* Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});
