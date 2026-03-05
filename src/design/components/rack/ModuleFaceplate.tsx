/**
 * ModuleFaceplate → Card
 * ─────────────────────────────────────────────────────────────
 * Clean card container with uniform border radius and a subtle
 * warm border. No screws, no brushed steel, no flat-top radius.
 *
 * Usage:
 *   <ModuleFaceplate label="NOW PLAYING">
 *     <TrackInfo />
 *   </ModuleFaceplate>
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { primaryShadow } from '../../tokens/elevation';
import { fontFamily, fontSize, letterSpacing } from '../../tokens/typography';
import { palette } from '../../tokens/materials';
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
    <View style={[styles.card, primaryShadow('flush'), style]}>
      {/* Section label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, isVoltageSag && { color: 'rgba(255, 184, 96, 0.55)' }]}>
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
    backgroundColor: palette.midnight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    overflow: 'hidden',
  },
  labelContainer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  label: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
    color: palette.textDim,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
});
