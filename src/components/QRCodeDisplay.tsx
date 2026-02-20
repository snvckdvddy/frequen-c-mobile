/**
 * QRCodeDisplay — Renders a QR code for the current room's join code.
 *
 * Used in the share sheet or inline on SessionRoomScreen.
 * Encodes a deep-link-style value: `frequenc://join/{joinCode}`
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface QRCodeDisplayProps {
  joinCode: string;
  size?: number;
}

export function QRCodeDisplay({ joinCode, size = 180 }: QRCodeDisplayProps) {
  const value = `frequenc://join/${joinCode}`;

  return (
    <View style={styles.container}>
      <View style={styles.qrWrapper}>
        <QRCode
          value={value}
          size={size}
          color={colors.text.primary}
          backgroundColor={colors.bg.elevated}
        />
      </View>
      <Text variant="label" color={colors.text.secondary} align="center" style={styles.code}>
        {joinCode}
      </Text>
      <Text variant="labelSmall" color={colors.text.muted} align="center">
        Scan to join this room
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  qrWrapper: {
    padding: spacing.md,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  code: {
    marginTop: spacing.md,
    letterSpacing: 3,
    fontSize: 18,
  },
});

export default QRCodeDisplay;
