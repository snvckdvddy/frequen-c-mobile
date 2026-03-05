/**
 * Register Screen — New Signal Creation
 *
 * "Claim your frequency" — matches LoginScreen's
 * Modular Synthesis visual language.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text, Button, Input } from '../components/ui';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import { palette } from '../design/tokens/materials';
import { fontFamily, fontSize, fontWeight, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

/** Rising sawtooth waveform — "building your signal" */
function SignalBuild() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.75,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={signalStyles.container}>
      <Animated.View
        style={[
          signalStyles.glow,
          {
            opacity: pulseAnim,
            transform: [{
              scale: pulseAnim.interpolate({
                inputRange: [0.4, 0.75],
                outputRange: [0.9, 1.08],
              }),
            }],
          },
        ]}
      />
      {/* Sawtooth wave — ascending signal */}
      <Svg width={160} height={40} viewBox="0 0 160 40" style={signalStyles.wave}>
        <Path
          d="M 0 36 L 20 4 L 20 36 L 40 4 L 40 36 L 60 4 L 60 36 L 80 4 L 80 36 L 100 4 L 100 36 L 120 4 L 120 36 L 140 4 L 140 36 L 160 4"
          stroke={palette.orange}
          strokeWidth={1.5}
          fill="none"
          opacity={0.7}
        />
      </Svg>
    </View>
  );
}

const signalStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    marginBottom: spacing.sm,
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.orange,
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 12,
    opacity: 0.06,
  },
  wave: {
    zIndex: 1,
  },
});

export function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!username.trim()) newErrors.username = 'Pick a handle';
    if (username.length < 3) newErrors.username = 'At least 3 characters';
    if (!email.trim()) newErrors.email = 'Email required';
    if (!email.includes('@')) newErrors.email = 'Invalid email';
    if (!password) newErrors.password = 'Password required';
    if (password.length < 6) newErrors.password = 'At least 6 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Signals don\'t match';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
    } catch (error: any) {
      Alert.alert('Signal lost', error.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <VoidSurface style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sawtooth brand mark */}
          <SignalBuild />

        {/* Header */}
        <View style={styles.header}>
          <Text variant="labelSmall" color={palette.slate} style={styles.brandTag}>
            FREQUEN-C
          </Text>
          <Text variant="h1" color={palette.frost}>
            Claim your frequency.
          </Text>
          <Text variant="body" color={palette.silver} style={styles.subtitle}>
            Build your signal chain from scratch.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Handle"
            placeholder="What should people call you?"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel="Username or handle input"
          />
          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            accessibilityLabel="Email address input"
          />
          <Input
            label="Password"
            placeholder="At least 6 characters"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="next"
            accessibilityLabel="Password input"
          />
          <Input
            label="Confirm"
            placeholder="Match your signal"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={errors.confirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            accessibilityLabel="Confirm password input"
          />

          <Button
            title="Generate Signal"
            onPress={handleRegister}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.submitButton}
          />
        </View>

        {/* Switch to login */}
        <View style={styles.footer}>
          <Text variant="body" color={palette.slate}>
            Already patched in?{' '}
          </Text>
          <TouchableOpacity onPress={onSwitchToLogin} accessibilityRole="button" accessibilityLabel="Reconnect, switch to login">
            <Text variant="body" color={palette.orange}>
              Reconnect
            </Text>
          </TouchableOpacity>
        </View>

        {/* Build tag */}
        <Text variant="labelSmall" color={palette.slate} style={styles.buildTag}>
          DESN 374-040
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </VoidSurface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing['2xl'],
  },
  header: {
    marginBottom: spacing.xl,
  },
  brandTag: {
    marginBottom: spacing.sm,
    letterSpacing: ls.ultraWide,
  },
  subtitle: {
    marginTop: spacing.sm,
  },
  form: {
    marginBottom: spacing.xl,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buildTag: {
    textAlign: 'center',
    marginTop: spacing['2xl'],
    opacity: 0.3,
    letterSpacing: ls.wider,
    fontSize: 9,
  },
});

export default RegisterScreen;
