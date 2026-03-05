/**
 * LEDReadout — Clean monospaced data display.
 * ─────────────────────────────────────────────────────────────
 * Renders data in Space Mono with a subtle colored tint.
 * No longer simulates a glowing LED/VFD — just clean text
 * with a soft color accent.
 *
 * Usage:
 *   <LEDReadout value="03:42" label="ELAPSED" />
 *   <LEDReadout value="128" label="BPM" variant="amber" size="lg" />
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { fontFamily, fontSize, letterSpacing } from '../../tokens/typography';
import { palette } from '../../tokens/materials';
import { useTheme } from '../../../contexts/ThemeContext';

type LEDVariant = 'ice' | 'amber';
type LEDSize = 'sm' | 'md' | 'lg';

interface LEDReadoutProps {
  value: string;
  label?: string;
  variant?: LEDVariant;
  size?: LEDSize;
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
  variant: variantProp = 'ice',
  size = 'md',
  labelPosition = 'above',
  style,
}: LEDReadoutProps) {
  const { isVoltageSag } = useTheme();
  const variant = isVoltageSag ? 'amber' : variantProp;
  const sizes = sizeMap[size];
  const color = variant === 'ice' ? palette.ice : palette.amber;

  return (
    <View style={[styles.container, style]}>
      {label && labelPosition === 'above' && (
        <Text style={[styles.label, { fontSize: sizes.label }]}>{label}</Text>
      )}

      <Text
        style={[
          styles.value,
          {
            fontSize: sizes.value,
            color,
          },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>

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
  value: {
    fontFamily: fontFamily.mono,
    letterSpacing: letterSpacing.normal,
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
});
