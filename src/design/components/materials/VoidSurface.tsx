/**
 * VoidSurface — The deepest background material.
 * ─────────────────────────────────────────────────────────────
 * Not flat black. Has subtle noise grain and optional vignette.
 *
 * Rendering stack:
 *   Skia (future): Perlin noise shader at 3% opacity over base
 *   Fallback (current): Base color + SVG noise overlay + radial vignette
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, Filter, FeTurbulence, FeColorMatrix, Rect, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { materials } from '../../tokens/materials';

interface VoidSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Show vignette darkening at edges. Default: true */
  vignette?: boolean;
  /** Show noise grain texture. Default: true */
  grain?: boolean;
}

export function VoidSurface({
  children,
  style,
  vignette = true,
  grain = true,
}: VoidSurfaceProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Noise grain overlay */}
      {grain && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <Filter id="noise">
                <FeTurbulence
                  type="fractalNoise"
                  baseFrequency={materials.void.noiseFrequency}
                  numOctaves={materials.void.noiseOctaves}
                  result="noise"
                />
                <FeColorMatrix
                  type="saturate"
                  values="0"
                  in="noise"
                />
              </Filter>
            </Defs>
            <Rect
              width="100%"
              height="100%"
              filter="url(#noise)"
              opacity={materials.void.noiseOpacity}
            />
          </Svg>
        </View>
      )}

      {/* Vignette overlay */}
      {vignette && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="vignette" cx="50%" cy="50%" r="80%">
                <Stop offset="0.5" stopColor="transparent" stopOpacity={0} />
                <Stop offset="1" stopColor="black" stopOpacity={0.4} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#vignette)" />
          </Svg>
        </View>
      )}

      {/* Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: materials.void.flat,
    overflow: 'hidden',
  },
});
