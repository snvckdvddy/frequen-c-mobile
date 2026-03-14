import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TacticalReadoutValues } from '../types';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalLCDOverlayProps {
  values: TacticalReadoutValues;
}

export function TacticalLCDOverlay({ values }: TacticalLCDOverlayProps) {
  const rows = [
    { label: 'BPM', value: values.bpmLabel },
    { label: 'KEY', value: values.keyLabel },
    { label: 'FMT', value: values.formatLabel },
  ];

  return (
    <View style={styles.container}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 104,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.acid,
    borderRadius: tacticalTokens.radius.sharp,
    backgroundColor: 'rgba(0, 0, 0, 0.84)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.md,
    marginBottom: tacticalTokens.spacing.xs,
  },
  label: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1,
  },
  value: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.acid,
  },
});

export default TacticalLCDOverlay;
