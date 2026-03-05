/**
 * ChromeSurface → Elevated Surface
 * ─────────────────────────────────────────────────────────────
 * Clean flat surface for interactive/elevated elements.
 * Name kept for API compat. No metallic gradient.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { materials } from '../../tokens/materials';

interface ChromeSurfaceProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Kept for API compat — ignored. */
  specular?: boolean;
  /** Kept for API compat — ignored. */
  angle?: number;
}

export function ChromeSurface({
  children,
  style,
}: ChromeSurfaceProps) {
  return (
    <View style={[styles.container, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: materials.chrome.flat,
    overflow: 'hidden',
  },
});
