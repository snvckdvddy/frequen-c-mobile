import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TacticalReadoutValues } from '../types';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalLCDOverlayProps {
  values: TacticalReadoutValues;
  dimmed?: boolean;
}

export function TacticalLCDOverlay({ values, dimmed = false }: TacticalLCDOverlayProps) {
  const rows = [
    { label: 'BPM', value: values.bpmLabel },
    { label: 'KEY', value: values.keyLabel },
    { label: 'FMT', value: values.formatLabel },
  ];

  return (
    <View style={[styles.container, dimmed && styles.containerDimmed]}>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={[styles.label, dimmed && styles.labelDimmed]}>{row.label}</Text>
          <Text style={[styles.value, dimmed && styles.valueDimmed]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 96,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.xs + 2,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  containerDimmed: {
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    marginBottom: 4,
  },
  label: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1,
  },
  labelDimmed: {
    color: tacticalTokens.colors.textDim,
  },
  value: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys + 1,
    color: tacticalTokens.colors.acid,
  },
  valueDimmed: {
    color: tacticalTokens.colors.textSoft,
  },
});

export default TacticalLCDOverlay;
