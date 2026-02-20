/**
 * Join Session Screen
 *
 * Enter a room code or scan a QR code to join an existing session.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input } from '../components/ui';
import { QRScanner } from '../components/QRScanner';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
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
      Alert.alert('Enter a code', 'Ask the host for the room code.');
      return;
    }
    setLoading(true);
    try {
      const { session } = await sessionApi.join(finalCode);
      navigation.replace('SessionRoom', { sessionId: session.id });
    } catch (err: any) {
      Alert.alert('Couldn\'t join', err.message || 'Check the code and try again.');
    } finally {
      setLoading(false);
    }
  }, [code, navigation]);

  const handleQRScanned = useCallback((scannedCode: string) => {
    setShowScanner(false);
    setCode(scannedCode);
    // Auto-join after scan
    handleJoin(scannedCode);
  }, [handleJoin]);

  // Show scanner fullscreen
  if (showScanner) {
    return <QRScanner onCodeScanned={handleQRScanned} onClose={() => setShowScanner(false)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text variant="h2" color={colors.text.muted}>\u2715</Text>
        </TouchableOpacity>

        <Text variant="h1" color={colors.text.primary}>Join a Room</Text>
        <Text variant="body" color={colors.text.secondary} style={styles.subtitle}>
          Enter the room code or scan a QR code.
        </Text>

        <Input
          label="Room Code"
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
          title="Join Room"
          onPress={() => handleJoin()}
          loading={loading}
          fullWidth
          size="lg"
        />

        {/* QR Scanner trigger */}
        <TouchableOpacity style={styles.qrButton} onPress={() => setShowScanner(true)}>
          <Ionicons name="qr-code-outline" size={24} color={colors.action.primary} />
          <Text variant="label" color={colors.action.primary} style={styles.qrLabel}>
            Scan QR Code
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['2xl'],
    justifyContent: 'flex-start',
  },
  closeBtn: { marginBottom: spacing.md },
  subtitle: { marginTop: spacing.xs, marginBottom: spacing.xl },
  input: { marginBottom: spacing.lg },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: spacing.radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing.sm,
  },
  qrLabel: {
    marginLeft: spacing.xs,
  },
});

export default JoinSessionScreen;
