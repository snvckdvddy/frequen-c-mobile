/**
 * Room Mode Badge — Signal-type indicator for session room presets.
 *
 * Now behavior-aware: still shows the preset name (campfire/spotlight/openFloor)
 * but can also display behavior indicator icons when customized toggles
 * deviate from the preset defaults.
 *
 * Modular Synthesis UI:
 *   ∿ Campfire  → Sine wave    — warmOrange (#FF6B35)
 *   ⊓ Spotlight → Square wave  — hotPink (#FF2D55)
 *   ⧸ Open Floor → Sawtooth wave — chromeBlue (#C0DFFF)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { WaveformIcon } from './WaveformIcon';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';
import type { RoomMode, RoomBehaviors } from '../../types';

interface RoomModeBadgeProps {
  mode: RoomMode;
  /** Optional: show behavior deviation indicators */
  behaviors?: RoomBehaviors;
  /** Compact shows icon only, full shows icon + label */
  variant?: 'compact' | 'full';
}

const modeConfig: Record<RoomMode, { label: string; color: string; bgColor: string }> = {
  campfire: {
    label: 'Campfire',
    color: palette.signalSine,
    bgColor: 'rgba(255, 107, 53, 0.12)',
  },
  spotlight: {
    label: 'Spotlight',
    color: palette.signalSquare,
    bgColor: 'rgba(255, 45, 85, 0.12)',
  },
  openFloor: {
    label: 'Open Floor',
    color: palette.signalSaw,
    bgColor: 'rgba(192, 223, 255, 0.12)',
  },
};

/** Small icons indicating active behavioral toggles. */
function BehaviorIndicators({ behaviors, color }: { behaviors: RoomBehaviors; color: string }) {
  const icons: Array<{ name: string; key: string }> = [];

  if (behaviors.requiresApproval) icons.push({ name: 'shield-checkmark-outline', key: 'approval' });
  if (behaviors.voteReordersQueue) icons.push({ name: 'swap-vertical-outline', key: 'voteReorder' });
  if (behaviors.skipAccess === 'hostOnly') icons.push({ name: 'lock-closed-outline', key: 'hostSkip' });
  if (!behaviors.allowOverdrive) icons.push({ name: 'flash-off-outline', key: 'noOverdrive' });
  if (!behaviors.duelEnabled) icons.push({ name: 'close-circle-outline', key: 'noDuel' });

  if (icons.length === 0) return null;

  return (
    <View style={styles.indicators}>
      {icons.slice(0, 3).map((icon) => (
        <Ionicons key={icon.key} name={icon.name as any} size={10} color={color} />
      ))}
      {icons.length > 3 && (
        <Text variant="label" color={color} style={{ fontSize: 8 }}>+{icons.length - 3}</Text>
      )}
    </View>
  );
}

export function RoomModeBadge({ mode, behaviors, variant = 'full' }: RoomModeBadgeProps) {
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
      {behaviors && variant === 'full' && (
        <BehaviorIndicators behaviors={behaviors} color={config.color} />
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
  indicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 2,
  },
});

export default RoomModeBadge;
