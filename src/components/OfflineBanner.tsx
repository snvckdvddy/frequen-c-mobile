/**
 * OfflineBanner — Slim bar shown when device loses connectivity.
 *
 * Animates in from top. Shows "No connection" with a subtle offline icon.
 * Auto-hides when connectivity returns.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from './ui';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';

export interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text variant="labelSmall" color={palette.frost}>
        No connection — some features may not work
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: palette.red + '30',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.screenPadding,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: palette.red + '40',
  },
});

export default OfflineBanner;
