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
import { palette } from '../design/tokens/materials';
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
          color={palette.frost}
          backgroundColor={palette.midnight}
        />
      </View>
      <Text variant="label" color={palette.silver} align="center" style={styles.code}>
        {joinCode}
      </Text>
      <Text variant="labelSmall" color={palette.slate} align="center">
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
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  code: {
    marginTop: spacing.md,
    letterSpacing: 3,
    fontSize: 18,
  },
});

export default QRCodeDisplay;
