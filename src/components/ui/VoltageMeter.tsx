/**
 * VoltageMeter — Control Voltage balance display.
 *
 * Horizontal bar showing CV balance as a glowing fill.
 * Used in Profile header and Session Room header.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';

interface VoltageMeterProps {
  balance: number;
  max?: number;
  /** compact = no label, just the bar */
  variant?: 'compact' | 'full';
}

export function VoltageMeter({ balance, max = 500, variant = 'full' }: VoltageMeterProps) {
  const fillPercent = Math.min(Math.max(balance / max, 0), 1) * 100;

  return (
    <View style={styles.container}>
      {variant === 'full' && (
        <View style={styles.header}>
          <Text variant="labelSmall" color={colors.cv.neutral}>CV</Text>
          <Text variant="labelSmall" color={colors.cv.positive}>
            {balance}
          </Text>
        </View>
      )}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            {
              width: `${fillPercent}%`,
              backgroundColor: colors.cv.positive,
              shadowColor: colors.cv.positive,
            },
          ]}
        />
        {/* Tick marks at 25% intervals */}
        {[25, 50, 75].map((tick) => (
          <View
            key={tick}
            style={[styles.tick, { left: `${tick}%` }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  track: {
    height: 4,
    backgroundColor: colors.bg.input,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  tick: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(192, 223, 255, 0.15)',
  },
});

export default VoltageMeter;
