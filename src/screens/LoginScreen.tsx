import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, SafeScreen } from '../components/ui';
import { ManualPanel } from '../components/manual/ManualPanel';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import { useManualMode } from '../hooks/useManualMode';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

function MonoText(props: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  return <Text {...props} />;
}

export function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const { login } = useAuth();
  const { readManual } = useManualMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setSubmitError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error: any) {
      setSubmitError((error?.message || 'Check your credentials and try again.').toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.screen}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <TacticalGridBackground opacity={0.58} />
            </View>

            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.signalPlate}>
                <View style={styles.signalBar} />
                <View style={styles.signalBarShort} />
                <View style={styles.signalBar} />
              </View>

              <View style={styles.header}>
                <MonoText style={[styles.mono, styles.eyebrow]}>SYS.FREQ // AUTH BUS</MonoText>
                <MonoText style={[styles.display, styles.title]}>PATCH IN</MonoText>
                <MonoText style={[styles.mono, styles.subtitle]}>
                  Route back into your signal chain and return to the live room grid.
                </MonoText>
              </View>

              {readManual ? (
                <ManualPanel
                  contextLabel="AUTH BUS"
                  variant="compact"
                  style={styles.manualRailInline}
                  title="LOGIN FLOW"
                  subtitle="Use this when you already have an account and just need to reconnect to the app."
                  steps={[
                    { tag: 'EMAIL', text: 'Enter the email tied to your existing profile.' },
                    { tag: 'PASS', text: 'Use the same password you registered with.' },
                    { tag: 'DONE', text: 'PATCH IN returns you to the main app once the route is valid.' },
                  ]}
                  callouts={[
                    { label: 'RETURNING USER', value: 'Use Patch In if the account already exists.' },
                    { label: 'NEXT SCREEN', value: 'Successful login hands off to the entry grid.' },
                  ]}
                  footer="If you have never made an account on this device, switch to Generate Signal."
                />
              ) : null}

              <View style={styles.panel}>
                <Input
                  label="EMAIL"
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
                  label="PASSWORD"
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  error={errors.password}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password input"
                />

                {submitError ? (
                  <View style={styles.errorRail}>
                    <Ionicons name="warning-outline" size={16} color={tacticalTokens.colors.orange} />
                    <MonoText style={[styles.mono, styles.errorText]}>{submitError}</MonoText>
                  </View>
                ) : null}

                <Button
                  title="PATCH IN"
                  onPress={handleLogin}
                  loading={loading}
                  fullWidth
                  size="lg"
                  style={styles.submitButton}
                />
              </View>

              <View style={styles.switchRow}>
                <MonoText style={[styles.mono, styles.switchCopy]}>NO ACTIVE PROFILE?</MonoText>
                <Pressable onPress={onSwitchToRegister} style={({ pressed }) => [pressed && styles.pressed]}>
                  <MonoText style={[styles.monoBold, styles.switchAction]}>GENERATE SIGNAL</MonoText>
                </Pressable>
              </View>

              <MonoText style={[styles.mono, styles.buildTag]}>DESN 374-040</MonoText>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </VoidSurface>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  pressed: { opacity: 0.82 },
  mono: { fontFamily: tacticalTokens.fonts.mono },
  monoBold: { fontFamily: tacticalTokens.fonts.monoBold },
  display: { fontFamily: tacticalTokens.fonts.display },
  signalPlate: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    alignSelf: 'center',
    marginBottom: 24,
  },
  signalBar: {
    width: 22,
    height: 46,
    backgroundColor: tacticalTokens.colors.ice,
  },
  signalBarShort: {
    width: 22,
    height: 26,
    backgroundColor: tacticalTokens.colors.white,
  },
  header: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontSize: 32,
    color: tacticalTokens.colors.white,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
  },
  manualRailInline: {
    marginTop: -8,
    marginBottom: 12,
  },
  panel: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    padding: 16,
  },
  errorRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 10,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.2,
  },
  submitButton: {
    marginTop: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  switchCopy: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.4,
  },
  switchAction: {
    fontSize: 10,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.5,
  },
  buildTag: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 9,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 2,
    opacity: 0.5,
  },
});

export default LoginScreen;
