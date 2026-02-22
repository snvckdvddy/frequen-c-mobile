/**
 * GlassPanel — Frosted translucent surface.
 * ─────────────────────────────────────────────────────────────
 * Used for modals, bottom sheets, and overlay surfaces.
 * Semi-transparent fill with gradient border (bright top-left → dim bottom-right).
 *
 * Rendering stack:
 *   Skia (future): Blur shader + chromatic aberration
 *   Fallback (current): expo-blur BlurView + border gradient via SVG
 *   Minimum: Semi-transparent View with border
 *
 * NOTE: expo-blur must be installed for full effect.
 * Without it, falls back to semi-transparent fill only.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { materials } from '../../tokens/materials';

// Conditionally import expo-blur (may not be installed yet)
let BlurView: any = null;
try {
  BlurView = require('expo-blur').BlurView;
} catch {
  // expo-blur not installed — will use opaque fallback
}

interface GlassPanelProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Blur intensity 1-100. Default: 20 */
  intensity?: number;
  /** Border radius. Default: 2 (hardware-tight) */
  borderRadius?: number;
}

export function GlassPanel({
  children,
  style,
  intensity = materials.glass.blurRadius,
  borderRadius = 2,
}: GlassPanelProps) {
  const borderWidth = materials.glass.border.width;

  return (
    <View style={[styles.outer, { borderRadius }, style]}>
      {/* Gradient border — rendered as a slightly larger background */}
      <LinearGradient
        colors={[
          materials.glass.border.colorStart,
          materials.glass.border.colorEnd,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />

      {/* Inner content area (inset by border width) */}
      <View
        style={[
          styles.inner,
          {
            borderRadius: Math.max(0, borderRadius - borderWidth),
            margin: borderWidth,
          },
        ]}
      >
        {/* Blur layer */}
        {BlurView ? (
          <BlurView
            intensity={intensity}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Tinted overlay (works with or without blur) */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: materials.glass.flat,
            },
          ]}
        />

        {/* Inner light sweep — top-left highlight */}
        <LinearGradient
          colors={[
            'rgba(255, 255, 255, 0.04)',
            'rgba(255, 255, 255, 0.01)',
            'transparent',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Content */}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
  },
  inner: {
    flex: 1,
    overflow: 'hidden',
  },
});
