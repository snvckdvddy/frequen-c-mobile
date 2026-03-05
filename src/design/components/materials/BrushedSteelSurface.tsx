/**
 * BrushedSteelSurface → Clean Card Surface
 * ─────────────────────────────────────────────────────────────
 * Flat warm card surface with no gradients or SVG grain.
 * Name kept for API compatibility across all screens.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { materials } from '../../tokens/materials';

interface BrushedSteelSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Kept for API compat — no longer renders grain. */
  grain?: boolean;
}

export function BrushedSteelSurface({
  children,
  style,
}: BrushedSteelSurfaceProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: materials.brushedSteel.flat,
    overflow: 'hidden',
  },
});
