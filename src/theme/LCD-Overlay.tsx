// src/components/LCDOverlay.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';

export const LCDOverlay = ({ bpm, keyNote, format }: { bpm: string, keyNote: string, format: string }) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>BPM</Text>
        <Text style={styles.value}>{bpm}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>KEY</Text>
        <Text style={styles.value}>{keyNote}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>FMT</Text>
        <Text style={styles.value}>{format}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: theme.colors.acidGreen,
    padding: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  label: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
  },
  value: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.acidGreen,
  }
});