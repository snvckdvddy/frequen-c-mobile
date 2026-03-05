/**
 * VoidSurface — Clean warm dark background.
 * ─────────────────────────────────────────────────────────────
 * Simple dark fill. Grain and vignette are available but off by
 * default for a cleaner, more modern look.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, Filter, FeTurbulence, FeColorMatrix, Rect, RadialGradient, Stop } from 'react-native-svg';
import { materials } from '../../tokens/materials';

interface VoidSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Show vignette darkening at edges. Default: false */
  vignette?: boolean;
  /** Show noise grain texture. Default: false */
  grain?: boolean;
}

export function VoidSurface({
  children,
  style,
  vignette = false,
  grain = false,
}: VoidSurfaceProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Noise grain overlay (opt-in) */}
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

      {/* Soft vignette (opt-in) */}
      {vignette && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="vignette" cx="50%" cy="50%" r="85%">
                <Stop offset="0.6" stopColor="transparent" stopOpacity={0} />
                <Stop offset="1" stopColor="black" stopOpacity={0.25} />
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
