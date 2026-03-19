/**
 * ModuleFaceplate → Tactical Brutalist Card
 * ─────────────────────────────────────────────────────────────
 * Square, mono-styled container for settings and profile modules.
 * Fits Tactical V2 aesthetic globally.
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { fontFamily, fontSize, letterSpacing } from '../../tokens/typography';
import { useTheme } from '../../../contexts/ThemeContext';

type FaceplateMaterial = 'steel' | 'chrome';

interface ModuleFaceplateProps {
  children: React.ReactNode;
  /** Section label text (uppercase). */
  label?: string;
  /** Kept for API compat. Ignored — always clean surface. */
  material?: FaceplateMaterial;
  /** Kept for API compat. Ignored — no longer renders screws. */
  screws?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ModuleFaceplate({
  children,
  label,
  style,
}: ModuleFaceplateProps) {
  const { isVoltageSag } = useTheme();

  return (
    <View style={[styles.card, style]}>
      {/* Section label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, isVoltageSag && { color: '#FF4500' }]}>
            {label}
          </Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 16,
    overflow: 'hidden',
  },
  labelContainer: {
    padding: 12,
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  label: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    letterSpacing: letterSpacing.wide,
    textTransform: 'uppercase',
    color: '#39FF14',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
