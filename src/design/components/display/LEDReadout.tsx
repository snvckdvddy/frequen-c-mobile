/**
 * LEDReadout — Monospaced data display with glow backdrop.
 * ─────────────────────────────────────────────────────────────
 * Renders technical data (time, BPM, dB, etc.) in Space Mono
 * with a subtle backlit glow, simulating an LED/VFD hardware display.
 *
 * Usage:
 *   <LEDReadout value="03:42" label="ELAPSED" />
 *   <LEDReadout value="128" label="BPM" variant="amber" size="lg" />
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { fontFamily, fontSize, letterSpacing } from '../../tokens/typography';
import { palette, glow } from '../../tokens/materials';

type LEDVariant = 'ice' | 'amber';
type LEDSize = 'sm' | 'md' | 'lg';

interface LEDReadoutProps {
  /** The data value to display */
  value: string;
  /** Small label above/below the value */
  label?: string;
  /** Color variant. Default: 'ice' */
  variant?: LEDVariant;
  /** Size preset. Default: 'md' */
  size?: LEDSize;
  /** Label position. Default: 'above' */
  labelPosition?: 'above' | 'below';
  style?: StyleProp<ViewStyle>;
}

const sizeMap = {
  sm: { value: fontSize.base, label: fontSize.xs },
  md: { value: fontSize.xl, label: fontSize.xs },
  lg: { value: fontSize['3xl'], label: fontSize.sm },
};

export function LEDReadout({
  value,
  label,
  variant = 'ice',
  size = 'md',
  labelPosition = 'above',
  style,
}: LEDReadoutProps) {
  const glowConfig = glow[variant];
  const sizes = sizeMap[size];
  const color = variant === 'ice' ? palette.ice : palette.amber;

  return (
    <View style={[styles.container, style]}>
      {/* Label (above) */}
      {label && labelPosition === 'above' && (
        <Text style={[styles.label, { fontSize: sizes.label }]}>{label}</Text>
      )}

      {/* Value with glow backdrop */}
      <View style={styles.valueContainer}>
        {/* Glow backdrop — semi-transparent colored rectangle behind text */}
        <View
          style={[
            styles.glowBackdrop,
            {
              backgroundColor: glowConfig.ambient,
              shadowColor: glowConfig.core,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            },
          ]}
        />
        <Text
          style={[
            styles.value,
            {
              fontSize: sizes.value,
              color,
              textShadowColor: glowConfig.inner,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 6,
            },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>

      {/* Label (below) */}
      {label && labelPosition === 'below' && (
        <Text style={[styles.label, { fontSize: sizes.label }]}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.label,
    fontWeight: '700',
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
    color: palette.textDim,
    marginBottom: 2,
  },
  valueContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  glowBackdrop: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 2,
    opacity: 0.6,
  },
  value: {
    fontFamily: fontFamily.mono,
    letterSpacing: letterSpacing.normal,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
});
