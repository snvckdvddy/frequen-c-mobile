/**
 * EmissionGlow — Light-emitting accent effect.
 * ─────────────────────────────────────────────────────────────
 * Wraps content with layered shadow bloom to simulate light emission.
 * Used for active indicators, accent elements, patch points.
 *
 * Variants: 'ice' (cyan) | 'amber' (warm/voltage-sag)
 *
 * Rendering stack:
 *   Skia (future): Gaussian blur layers with additive blending
 *   Fallback (current): Nested Views with increasing shadowRadius
 *
 * NOTE: Android doesn't render multiple box-shadows natively.
 * We use nested wrapper Views, each contributing one shadow layer.
 * This is intentional — shadow stacking is the only cross-platform
 * way to simulate bloom without Skia.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp, Platform } from 'react-native';
import { glow } from '../../tokens/materials';

type GlowVariant = 'ice' | 'amber' | 'subtle';

interface EmissionGlowProps {
  children: React.ReactNode;
  variant?: GlowVariant;
  style?: StyleProp<ViewStyle>;
  /** Enable all bloom layers. Set false for just the inner glow. */
  bloom?: boolean;
  /** Size of the emitting element (for proper shadow sizing). */
  size?: number;
}

const SHADOW_LAYERS: { key: keyof typeof glow.ice; elevation: number }[] = [
  { key: 'inner', elevation: 4 },
  { key: 'outer', elevation: 8 },
  { key: 'ambient', elevation: 12 },
];

export function EmissionGlow({
  children,
  variant = 'ice',
  style,
  bloom = true,
  size,
}: EmissionGlowProps) {
  const config = glow[variant];
  const layers = bloom ? SHADOW_LAYERS : [SHADOW_LAYERS[0]];

  // Build nested shadow views from outermost to innermost
  let content = <>{children}</>;

  // On Android, use elevation + backgroundColor for shadow tinting
  // On iOS, use shadowColor/shadowRadius
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    const radiusKey = `${layer.key}Radius` as keyof typeof config;
    const radius = (config as any)[radiusKey] as number;

    content = (
      <View
        style={[
          styles.layer,
          Platform.select({
            ios: {
              shadowColor: config.core,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: radius,
            },
            android: {
              // Android doesn't support colored shadows well.
              // We use a semi-transparent background to fake the glow.
              // This is the known limitation that Skia will fix.
              elevation: layer.elevation,
              shadowColor: config.core,
            },
          }),
        ]}
      >
        {content}
      </View>
    );
  }

  return <View style={style}>{content}</View>;
}

const styles = StyleSheet.create({
  layer: {
    // Each layer is a transparent wrapper contributing one shadow
  },
});
