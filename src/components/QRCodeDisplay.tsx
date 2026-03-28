/**
 * QRCodeDisplay — Renders a QR code for the current room's join code.
 *
 * Used in the share sheet or inline on SessionRoomScreen.
 * Encodes a deep-link-style value: `frequenc://join/{joinCode}`
 */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

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
          color={tacticalTokens.colors.white}
          backgroundColor={tacticalTokens.colors.void}
        />
      </View>
      <Text style={styles.code}>
        {joinCode}
      </Text>
      <Text style={styles.caption}>
        SCAN TO JOIN THIS ROOM
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: tacticalTokens.spacing.lg,
  },
  qrWrapper: {
    padding: tacticalTokens.spacing.md,
    backgroundColor: tacticalTokens.colors.void,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
  },
  code: {
    marginTop: tacticalTokens.spacing.md,
    fontFamily: tacticalTokens.fonts.display,
    color: tacticalTokens.colors.white,
    letterSpacing: 2.2,
    fontSize: tacticalTokens.fontSize.label,
    textTransform: 'uppercase',
  },
  caption: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.3,
  },
});

export default QRCodeDisplay;
