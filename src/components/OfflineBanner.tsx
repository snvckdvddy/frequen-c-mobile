/**
 * OfflineBanner — Slim bar shown when device loses connectivity.
 *
 * Animates in from top. Shows "No connection" with a subtle offline icon.
 * Auto-hides when connectivity returns.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

export interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text variant="labelSmall" color={colors.text.primary}>
        No connection \u2014 some features may not work
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.action.destructive + '30',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.screenPadding,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.action.destructive + '40',
  },
});

export default OfflineBanner;
