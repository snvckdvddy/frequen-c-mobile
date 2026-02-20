/**
 * Login Screen
 *
 * Clean, dark, room-like entry point.
 * "Enter the room" — not "sign in to an app."
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
import { Text, Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
}

export function LoginScreen({ onSwitchToRegister }: LoginScreenProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // ─── Ambient glow pulse animation ──────────────────────
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.7,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glowAnim]);

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
      Alert.alert('Login failed', error.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ambient glow behind the brand mark */}
        <View style={styles.glowContainer}>
          <Animated.View
            style={[
              styles.glowOrb,
              {
                opacity: glowAnim,
                transform: [{ scale: glowAnim.interpolate({
                  inputRange: [0.4, 0.7],
                  outputRange: [0.9, 1.1],
                })}],
              },
            ]}
          />
        </View>

        {/* Brand mark area */}
        <View style={styles.brandArea}>
          <Text
            variant="displaySmall"
            color={colors.text.primary}
            style={styles.brandLetter}
          >
            C
          </Text>
          <Text variant="labelSmall" color={colors.raw.ice} style={styles.brandTag}>
            FREQUEN-C
          </Text>
        </View>

        {/* Headline */}
        <View style={styles.header}>
          <Text variant="h1" color={colors.text.primary}>
            Enter the room.
          </Text>
          <Text variant="body" color={colors.text.secondary} style={styles.subtitle}>
            Your collaborative listening session awaits.
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
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.submitButton}
          />
        </View>

        {/* Switch to register */}
        <View style={styles.footer}>
          <Text variant="body" color={colors.text.muted}>
            First time here?{' '}
          </Text>
          <TouchableOpacity onPress={onSwitchToRegister}>
            <Text variant="body" color={colors.action.primary}>
              Create an account
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing['3xl'],
  },
  glowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
    marginBottom: -40,
  },
  glowOrb: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.raw.ice,
    // Simulated radial glow via shadow
    shadowColor: colors.raw.ice,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 60,
    elevation: 20,
    opacity: 0.15,
  },
  brandArea: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  brandLetter: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '200',
    letterSpacing: -2,
  },
  brandTag: {
    marginTop: spacing.xs,
    letterSpacing: 6,
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
});

export default LoginScreen;
