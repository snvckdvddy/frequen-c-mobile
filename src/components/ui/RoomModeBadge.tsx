/**
 * Room Mode Badge — Signal-type indicator for session room modes.
 *
 * Modular Synthesis UI:
 *   ∿ Campfire  → Sine wave    — warmOrange (#FF6B35)
 *   ⊓ Spotlight → Square wave  — hotPink (#FF2D55)
 *   ⧸ Open Floor → Sawtooth wave — chromeBlue (#C0DFFF)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { WaveformIcon } from './WaveformIcon';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { RoomMode } from '../../types';

interface RoomModeBadgeProps {
  mode: RoomMode;
  /** Compact shows icon only, full shows icon + label */
  variant?: 'compact' | 'full';
}

const modeConfig: Record<RoomMode, { label: string; color: string; bgColor: string }> = {
  campfire: {
    label: 'Campfire',
    color: colors.signal.sine,
    bgColor: 'rgba(255, 107, 53, 0.12)',
  },
  spotlight: {
    label: 'Spotlight',
    color: colors.signal.square,
    bgColor: 'rgba(255, 45, 85, 0.12)',
  },
  openFloor: {
    label: 'Open Floor',
    color: colors.signal.saw,
    bgColor: 'rgba(192, 223, 255, 0.12)',
  },
};

export function RoomModeBadge({ mode, variant = 'full' }: RoomModeBadgeProps) {
  const config = modeConfig[mode];

  return (
    <View style={[
      styles.badge,
      { backgroundColor: config.bgColor, borderColor: config.color },
    ]}>
      <WaveformIcon mode={mode} size={14} />
      {variant === 'full' && (
        <Text
          variant="label"
          color={config.color}
          style={styles.label}
        >
          {config.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingHorizontal: 8,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    gap: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default RoomModeBadge;
