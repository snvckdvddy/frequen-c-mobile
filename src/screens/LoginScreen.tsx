import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { Button, Input, SafeScreen } from '../components/ui';
import { ManualPanel } from '../components/manual/ManualPanel';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import { useManualMode } from '../hooks/useManualMode';
import { config } from '../config';
import { getAuthDiagnostics, setAppleWebAuthState } from '../services/authDiagnostics';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

function MonoText(props: { children: React.ReactNode; style?: TextStyle | TextStyle[]; numberOfLines?: number }) {
  return <Text {...props} />;
}

export function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const { login, loginWithApple, loginWithGoogle } = useAuth();
  const { readManual, manualReady } = useManualMode();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Check your credentials and try again.';
      setSubmitError(message.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  // ── Apple Sign In (iOS native / Android web) ───────────────
  const handleAppleSignIn = async () => {
    if (Platform.OS === 'ios') {
      await handleAppleSignInNative();
    } else {
      await handleAppleSignInWeb();
    }
  };

  const handleAppleSignInNative = async () => {
    setSubmitError(null);
    setSocialLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        setSubmitError('APPLE DID NOT RETURN AN IDENTITY TOKEN');
        return;
      }

      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ') || undefined;

      await loginWithApple(
        credential.identityToken,
        credential.user,
        fullName,
        credential.email ?? undefined,
      );
    } catch (error: unknown) {
      const code = error instanceof Error && 'code' in error ? (error as Error & { code: string }).code : '';
      if (code === 'ERR_REQUEST_CANCELED') return;
      const message = error instanceof Error ? error.message : 'Apple sign in failed.';
      setSubmitError(message.toUpperCase());
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignInWeb = async () => {
    const serviceId = config.APPLE_SERVICE_ID;
    if (!serviceId) {
      setSubmitError('APPLE SIGN IN IS NOT CONFIGURED FOR THIS PLATFORM');
      return;
    }
    setSubmitError(null);
    setSocialLoading('apple');
    try {
      const { appleWebCallbackUri } = getAuthDiagnostics();
      const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
      // Store state so AuthContext can verify it on callback (CSRF protection)
      setAppleWebAuthState(state);
      const authUrl =
        `https://appleid.apple.com/auth/authorize?` +
        `client_id=${encodeURIComponent(serviceId)}` +
        `&redirect_uri=${encodeURIComponent(appleWebCallbackUri)}` +
        `&response_type=code+id_token` +
        `&scope=name+email` +
        `&response_mode=form_post` +
        `&state=${state}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'frequenc://apple-auth');
      if (result.type === 'success' && result.url) {
        // The callback URL is frequenc://apple-auth?token=...
        // AuthContext's Linking listener handles the rest
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setAppleWebAuthState(null);
      }
    } catch (error: unknown) {
      setAppleWebAuthState(null);
      const message = error instanceof Error ? error.message : 'Apple sign in failed.';
      setSubmitError(message.toUpperCase());
    } finally {
      setSocialLoading(null);
    }
  };

  // ── Google Sign In ─────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (!config.GOOGLE_WEB_CLIENT_ID) {
      setSubmitError('GOOGLE SIGN IN IS NOT CONFIGURED');
      return;
    }
    setSubmitError(null);
    setSocialLoading('google');
    try {
      // Configure is idempotent — safe to call before each flow
      GoogleSignin.configure({
        webClientId: config.GOOGLE_WEB_CLIENT_ID,
        iosClientId: config.GOOGLE_IOS_CLIENT_ID || undefined,
        offlineAccess: false,
      });

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      if (response.type === 'cancelled') return;

      const idToken = response.data?.idToken;
      if (!idToken) {
        setSubmitError('GOOGLE DID NOT RETURN AN ID TOKEN');
        return;
      }

      await loginWithGoogle(idToken);
    } catch (error: unknown) {
      // Suppress user-initiated cancellations and in-progress errors
      const code = (error as { code?: string }).code;
      if (code === statusCodes.SIGN_IN_CANCELLED || code === statusCodes.IN_PROGRESS) return;
      const message = error instanceof Error ? error.message : 'Google sign in failed.';
      setSubmitError(message.toUpperCase());
    } finally {
      setSocialLoading(null);
    }
  };

  const isAnyLoading = loading || socialLoading !== null;

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
                  Route into your signal chain and join the live room grid.
                </MonoText>
              </View>

              {manualReady && readManual ? (
                <ManualPanel
                  contextLabel="AUTH BUS"
                  variant="compact"
                  style={styles.manualRailInline}
                  title="LOGIN FLOW"
                  subtitle="Use this when you already have an account and just need to reconnect to the app."
                  steps={[
                    { tag: 'FAST', text: 'Use Apple or Google for one-tap sign in.' },
                    { tag: 'EMAIL', text: 'Or enter the email tied to your existing profile.' },
                    { tag: 'DONE', text: 'PATCH IN returns you to the main app once the route is valid.' },
                  ]}
                  callouts={[
                    { label: 'RETURNING USER', value: 'Use Patch In if the account already exists.' },
                    { label: 'NEXT SCREEN', value: 'Successful login hands off to the entry grid.' },
                  ]}
                  footer="If you have never made an account on this device, switch to Generate Signal."
                />
              ) : null}

              {/* ── Social Auth Buttons ──────────────────────────── */}
              <View style={styles.socialSection}>
                <Pressable
                  onPress={handleAppleSignIn}
                  disabled={isAnyLoading}
                  style={({ pressed }) => [
                    styles.socialButton,
                    styles.appleButton,
                    pressed && styles.pressed,
                    isAnyLoading && styles.socialDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Apple"
                >
                  {socialLoading === 'apple' ? (
                    <ActivityIndicator color="#000000" size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={20} color="#000000" />
                      <MonoText style={[styles.monoBold, styles.appleButtonText]}>
                        SIGN IN WITH APPLE
                      </MonoText>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={handleGoogleSignIn}
                  disabled={isAnyLoading}
                  style={({ pressed }) => [
                    styles.socialButton,
                    styles.googleButton,
                    pressed && styles.pressed,
                    isAnyLoading && styles.socialDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Google"
                >
                  {socialLoading === 'google' ? (
                    <ActivityIndicator color={tacticalTokens.colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-google" size={18} color={tacticalTokens.colors.white} />
                      <MonoText style={[styles.monoBold, styles.googleButtonText]}>
                        SIGN IN WITH GOOGLE
                      </MonoText>
                    </>
                  )}
                </Pressable>
              </View>

              {/* ── Divider ─────────────────────────────────────── */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <MonoText style={[styles.mono, styles.dividerText]}>OR ROUTE MANUALLY</MonoText>
                <View style={styles.dividerLine} />
              </View>

              {/* ── Email / Password Form ───────────────────────── */}
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
                  // Pairs with the password field's `autoComplete` so iOS
                  // / Android recognise this as a username+password combo
                  // and offer to save credentials after a successful login.
                  autoComplete="email"
                  textContentType="emailAddress"
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
                  // Enables iOS Keychain / Android Autofill so the device
                  // remembers a successful credential after first use.
                  // For users with multiple test passwords, this is the
                  // pro-fix: log in once, autofill from then on.
                  autoComplete="current-password"
                  textContentType="password"
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
                  disabled={isAnyLoading}
                  fullWidth
                  size="lg"
                  style={styles.submitButton}
                />
              </View>

              <View style={styles.switchRow}>
                <MonoText style={[styles.mono, styles.switchCopy]}>NO ACTIVE PROFILE?</MonoText>
                <Pressable onPress={onSwitchToRegister} accessibilityRole="button" accessibilityLabel="Switch to register" style={({ pressed }) => [pressed && styles.pressed]}>
                  <MonoText style={[styles.monoBold, styles.switchAction]}>GENERATE SIGNAL</MonoText>
                </Pressable>
              </View>

              {/* Build/version tag — left blank intentionally. The previous
                  "DESN 374-040" course code signaled "this is a class
                  project" to users in production. Wire to a real version
                  string (expo-application, app.json) when ready. */}
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

  // ── Social Auth ───────────────────────────────────────────
  socialSection: {
    gap: 10,
    marginBottom: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    gap: 10,
  },
  socialDisabled: {
    opacity: 0.35,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
  },
  appleButtonText: {
    color: '#000000',
    fontSize: 12,
    letterSpacing: 1.8,
  },
  googleButton: {
    backgroundColor: tacticalTokens.colors.matte,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
  },
  googleButtonText: {
    color: tacticalTokens.colors.white,
    fontSize: 12,
    letterSpacing: 1.8,
  },

  // ── Divider ───────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: tacticalTokens.colors.border,
  },
  dividerText: {
    fontSize: 9,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 2,
  },

  // ── Email / Password Panel ────────────────────────────────
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
