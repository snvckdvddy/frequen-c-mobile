/**
 * Join Session Screen — Connect to Signal
 *
 * Enter a join code or scan a QR code to patch into an existing session.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, Button, Input, ADSRTransition } from '../components/ui';
import { QRScanner } from '../components/QRScanner';
import { sessionApi } from '../services/api';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';

export function JoinSessionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [code, setCode] = useState(route.params?.joinCode || '');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const handleJoin = useCallback(async (joinCode?: string) => {
    const finalCode = (joinCode || code).trim().toUpperCase();
    if (!finalCode) {
      Alert.alert('Enter a code', 'Ask the host for the join code.');
      return;
    }
    setLoading(true);
    try {
      const { session } = await sessionApi.join(finalCode);
      navigation.replace('SessionRoom', { sessionId: session.id });
    } catch (err: any) {
      Alert.alert('Signal not found', err.message || 'Check the code and try again.');
    } finally {
      setLoading(false);
    }
  }, [code, navigation]);

  const handleQRScanned = useCallback((scannedCode: string) => {
    setShowScanner(false);
    setCode(scannedCode);
    handleJoin(scannedCode);
  }, [handleJoin]);

  if (showScanner) {
    return <QRScanner onCodeScanned={handleQRScanned} onClose={() => setShowScanner(false)} />;
  }

  return (
    <ADSRTransition preset="modalReveal" slideFrom="bottom" slideDistance={30}>
    <SafeScreen style={styles.container}>
      <View style={styles.content}>
        {/* Close button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={22} color={palette.slate} />
        </TouchableOpacity>

        {/* Header */}
        <Text variant="h1" color={palette.frost}>
          Connect to Signal
        </Text>
        <Text variant="bodySmall" color={palette.silver} style={styles.subtitle}>
          Enter the join code or scan to patch in.
        </Text>

        {/* Code input */}
        <Input
          label="Join Code"
          placeholder="e.g. VIBE-2026"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="go"
          onSubmitEditing={() => handleJoin()}
          containerStyle={styles.input}
        />

        <Button
          title="Patch In"
          onPress={() => handleJoin()}
          loading={loading}
          fullWidth
          size="lg"
        />

        {/* QR Scanner */}
        <TouchableOpacity style={styles.qrButton} onPress={() => setShowScanner(true)} accessibilityRole="button" accessibilityLabel="Scan QR code to join a room">
          <Ionicons name="qr-code-outline" size={20} color={palette.orange} />
          <Text variant="label" color={palette.orange} style={{ fontSize: 12 }}>
            Scan QR Code
          </Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
    </ADSRTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.midnight,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['2xl'],
    justifyContent: 'flex-start',
  },
  closeBtn: {
    marginBottom: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  input: {
    marginBottom: spacing.lg,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    backgroundColor: palette.steel,
    gap: 8,
  },
});

export default JoinSessionScreen;
