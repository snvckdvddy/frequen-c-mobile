/**
 * Login Screen — Modular Synthesis Entry Point
 *
 * The first thing you see. Sets the tone:
 * dark, chrome, signal-driven. "Patch in" not "sign in."
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
import { SafeScreen, Text, Button, Input } from '../components/ui';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import { palette } from '../design/tokens/materials';
import { fontFamily, fontSize, fontWeight, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

/** Animated sine wave brand mark — replaces static glow orb */
function SignalMark() {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 2500,
          useNativeDriver: false,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 2500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={signalStyles.container}>
      {/* Glow behind waveform */}
      <Animated.View
        style={[
          signalStyles.glow,
          {
            opacity: pulseAnim,
            transform: [{
              scale: pulseAnim.interpolate({
                inputRange: [0.5, 0.85],
                outputRange: [0.95, 1.05],
              }),
            }],
          },
        ]}
      />
      {/* Waveform SVG */}
      <Svg width={200} height={48} viewBox="0 0 200 48" style={signalStyles.wave}>
        <Path
          d="M 0 24 Q 12.5 0, 25 24 Q 37.5 48, 50 24 Q 62.5 0, 75 24 Q 87.5 48, 100 24 Q 112.5 0, 125 24 Q 137.5 48, 150 24 Q 162.5 0, 175 24 Q 187.5 48, 200 24"
          stroke={palette.orange}
          strokeWidth={2}
          fill="none"
          opacity={0.8}
        />
      </Svg>
    </View>
  );
}

const signalStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    marginBottom: spacing.md,
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 80,
    borderRadius: 0,
    backgroundColor: palette.orange,
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 50,
    elevation: 15,
    opacity: 0.08,
  },
  wave: {
    zIndex: 1,
  },
});

export function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Connection failed', error.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeScreen>
      <VoidSurface style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Signal waveform brand mark */}
          <SignalMark />

        {/* Brand */}
        <View style={styles.brandArea}>
          <Text
            variant="displaySmall"
            color={palette.frost}
            style={styles.brandLetter}
          >
            C
          </Text>
          <Text variant="labelSmall" color={palette.slate} style={styles.brandTag}>
            FREQUEN-C
          </Text>
        </View>

        {/* Headline */}
        <View style={styles.header}>
          <Text variant="h1" color={palette.frost}>
            Patch in.
          </Text>
          <Text variant="body" color={palette.silver} style={styles.subtitle}>
            Your signal chain is waiting.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
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
            placeholder="Your password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            accessibilityLabel="Password input"
          />

          <Button
            title="Patch In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.submitButton}
          />
        </View>

        {/* Switch to register */}
        <View style={styles.footer}>
          <Text variant="body" color={palette.slate}>
            New signal?{' '}
          </Text>
          <TouchableOpacity onPress={onSwitchToRegister} accessibilityRole="button" accessibilityLabel="Create your frequency, switch to registration">
            <Text variant="body" color={palette.orange}>
              Create your frequency
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
    </SafeScreen>
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
    paddingVertical: spacing['3xl'],
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandLetter: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: fontWeight.thin,
    letterSpacing: ls.tighter,
  },
  brandTag: {
    marginTop: spacing.xs,
    letterSpacing: ls.heroWide,
  },
  header: {
    marginBottom: spacing['2xl'],
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

export default LoginScreen;
