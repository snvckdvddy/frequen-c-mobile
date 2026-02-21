/**
 * QRScanner — Camera-based QR code scanner for joining rooms.
 *
 * Uses expo-camera's built-in barcode scanning.
 * Parses `frequenc://join/{code}` URIs and falls back to raw text as a join code.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text, Button } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface QRScannerProps {
  onCodeScanned: (joinCode: string) => void;
  onClose: () => void;
}

export function QRScanner({ onCodeScanned, onClose }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanned) return;
      setScanned(true);

      // Parse frequenc://join/{code} or raw code
      let joinCode = data;
      const deepLinkMatch = data.match(/frequenc:\/\/join\/(.+)/i);
      if (deepLinkMatch) {
        joinCode = deepLinkMatch[1];
      }

      // Clean up the code
      joinCode = joinCode.trim().toUpperCase();

      if (!joinCode) {
        Alert.alert('Invalid QR', 'This QR code doesn\'t contain a room code.');
        setScanned(false);
        return;
      }

      onCodeScanned(joinCode);
    },
    [scanned, onCodeScanned]
  );

  // Permission not yet resolved
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text variant="body" color={colors.text.muted} align="center">
          Requesting camera access...
        </Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text variant="body" color={colors.text.secondary} align="center" style={styles.msg}>
          Camera access is needed to scan QR codes.
        </Text>
        <Button title="Grant Permission" onPress={requestPermission} size="md" />
        <Button title="Cancel" onPress={onClose} variant="ghost" size="sm" style={styles.cancelBtn} />
      </View>
    );
  }

  return (
    <View style={styles.scannerContainer}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay with viewfinder cutout */}
      <View style={styles.overlay}>
        <View style={styles.viewfinder} />
        <Text variant="label" color={colors.text.primary} align="center" style={styles.hint}>
          Point at a Frequen-C QR code
        </Text>
      </View>

      <Button
        title="Cancel"
        onPress={onClose}
        variant="ghost"
        size="sm"
        style={styles.closeBtn}
      />
    </View>
  );
}

const VIEWFINDER_SIZE = 240;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg.primary,
  },
  msg: {
    marginBottom: spacing.lg,
  },
  cancelBtn: {
    marginTop: spacing.md,
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    borderWidth: 2,
    borderColor: colors.action.primary,
    borderRadius: spacing.radius.lg,
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: spacing.lg,
  },
  closeBtn: {
    position: 'absolute',
    bottom: spacing['2xl'],
    alignSelf: 'center',
  },
});

export default QRScanner;
