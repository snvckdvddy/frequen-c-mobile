/**
 * Card — Reusable surface component
 *
 * Convergence Strategy §4:
 * - Background: midnight (#0E1219) default
 * - Border: 1pt dark steel (#2D3548)
 * - Radius: 12pt
 * - Padding: 12pt (cardPadding)
 *
 * Variants:
 *   surface  — default card (midnight bg)
 *   elevated — raised card (steel bg) for modal/overlay context
 *   glass    — chrome translucent (glass morphism)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

type CardVariant = 'surface' | 'elevated' | 'glass';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  noPadding?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

const variantMap: Record<CardVariant, { bg: string; border: string }> = {
  surface: {
    bg: colors.bg.surface,       // Midnight #0E1219
    border: colors.border.default, // Dark steel #2D3548
  },
  elevated: {
    bg: colors.bg.elevated,      // Steel #161B28
    border: colors.border.default,
  },
  glass: {
    bg: colors.chrome.surface,   // Chrome translucent
    border: colors.chrome.border, // Chrome border
  },
};

export function Card({
  variant = 'surface',
  noPadding = false,
  style,
  children,
  ...viewProps
}: CardProps) {
  const v = variantMap[variant];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
        },
        !noPadding && styles.padded,
        style,
      ]}
      {...viewProps}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: spacing.radius.md,    // 12pt
    borderWidth: 1,
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.cardPadding,       // 20pt
  },
});

export default Card;
