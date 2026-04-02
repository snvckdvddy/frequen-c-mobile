import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, SafeScreen } from '../components/ui';
import { ManualPanel } from '../components/manual/ManualPanel';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import { useManualMode } from '../hooks/useManualMode';
import { armWelcomeBoot, clearWelcomeBoot } from '../features/onboarding/welcomeBootState';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

function MonoText(props: { children: React.ReactNode; style?: TextStyle | TextStyle[]; numberOfLines?: number }) {
  return <Text {...props} />;
}

export function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const { register } = useAuth();
  const { readManual } = useManualMode();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!username.trim()) next.username = 'Pick a handle';
    if (username.trim().length < 3) next.username = 'At least 3 characters';
    if (!email.trim()) next.email = 'Email required';
    if (!email.includes('@')) next.email = 'Invalid email';
    if (!password) next.password = 'Password required';
    if (password.length < 6) next.password = 'At least 6 characters';
    if (password !== confirmPassword) next.confirmPassword = "Signals don't match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setSubmitError(null);
    setLoading(true);
    try {
      armWelcomeBoot();
      await register(username.trim(), email.trim(), password);
    } catch (error: unknown) {
      clearWelcomeBoot();
      const message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
      setSubmitError(message.toUpperCase());
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
                <View style={styles.signalRise} />
                <View style={styles.signalRiseTall} />
                <View style={styles.signalRiseMax} />
              </View>

              <View style={styles.header}>
                <MonoText style={[styles.mono, styles.eyebrow]}>SYS.FREQ // AUTH BUS</MonoText>
                <MonoText style={[styles.display, styles.title]}>GENERATE SIGNAL</MonoText>
                <MonoText style={[styles.mono, styles.subtitle]}>
                  Claim your frequency, cut a clean profile, and arm the room flow.
                </MonoText>
              </View>

              {readManual ? (
                <ManualPanel
                  contextLabel="AUTH BUS"
                  variant="compact"
                  style={styles.manualRailInline}
                  title="ACCOUNT SETUP"
                  subtitle="Use this once to create a profile, then the app will route you into the main entry flow."
                  steps={[
                    { tag: 'HANDLE', text: 'Your handle is the public identity other users will see in rooms.' },
                    { tag: 'EMAIL', text: 'Email becomes the recovery and login route for the profile.' },
                    { tag: 'CLAIM', text: 'Claim Frequency creates the account and moves you into the app.' },
                  ]}
                  callouts={[
                    { label: 'HANDLE', value: 'Shown publicly in rooms, queue badges, and profile surfaces.' },
                    { label: 'EMAIL', value: 'Used for future login and recovery.' },
                  ]}
                  footer="If you already have an account, switch to Patch In instead of creating a new one."
                />
              ) : null}

              <View style={styles.panel}>
                <Input
                  label="HANDLE"
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
                  placeholder="At least 6 characters"
                  value={password}
                  onChangeText={setPassword}
                  error={errors.password}
                  secureTextEntry
                  returnKeyType="next"
                  accessibilityLabel="Password input"
                />
                <Input
                  label="CONFIRM"
                  placeholder="Match your signal"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  error={errors.confirmPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  accessibilityLabel="Confirm password input"
                />

                {submitError ? (
                  <View style={styles.errorRail}>
                    <Ionicons name="warning-outline" size={16} color={tacticalTokens.colors.orange} />
                    <MonoText style={[styles.mono, styles.errorText]}>{submitError}</MonoText>
                  </View>
                ) : null}

                <Button
                  title="CLAIM FREQUENCY"
                  onPress={handleRegister}
                  loading={loading}
                  fullWidth
                  size="lg"
                  style={styles.submitButton}
                />
              </View>

              <View style={styles.switchRow}>
                <MonoText style={[styles.mono, styles.switchCopy]}>ALREADY PATCHED IN?</MonoText>
                <Pressable onPress={onSwitchToLogin} accessibilityRole="button" accessibilityLabel="Switch to login" style={({ pressed }) => [pressed && styles.pressed]}>
                  <MonoText style={[styles.monoBold, styles.switchAction]}>RECONNECT</MonoText>
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
    paddingVertical: 28,
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
    marginBottom: 20,
  },
  signalRise: {
    width: 22,
    height: 24,
    backgroundColor: tacticalTokens.colors.white,
  },
  signalRiseTall: {
    width: 22,
    height: 42,
    backgroundColor: tacticalTokens.colors.ice,
  },
  signalRiseMax: {
    width: 22,
    height: 58,
    backgroundColor: tacticalTokens.colors.orange,
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

export default RegisterScreen;
