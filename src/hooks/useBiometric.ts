/**
 * useBiometric — Biometric authentication hook.
 *
 * Wraps expo-local-authentication (hardware detection, prompts) and
 * expo-secure-store (biometric-gated token storage) into a single
 * hook that AuthContext can consume.
 *
 * Design decisions (from approved design doc):
 * - Opt-in only: user is offered biometric once after first login.
 *   If declined, the preference is persisted and they're never asked again.
 * - Token is stored with `requireAuthentication: true`, so the OS
 *   prompts Face ID / fingerprint / PIN before the token can be read.
 * - The hook never touches raw biometric data — the OS handles everything.
 */

import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

// ─── Storage Keys ────────────────────────────────────────────
const BIOMETRIC_TOKEN_KEY = 'frequenc_bio_token';
const BIOMETRIC_ENABLED_KEY = 'frequenc_bio_enabled';
const BIOMETRIC_OFFERED_KEY = 'frequenc_bio_offered';

// ─── Types ───────────────────────────────────────────────────

export interface BiometricState {
  /** Device has Face ID, Touch ID, fingerprint, or equivalent. */
  isAvailable: boolean;
  /** User has opted into biometric unlock for this app. */
  isEnabled: boolean;
  /** User has already been offered biometric (don't ask again). */
  hasBeenOffered: boolean;
  /** Still loading hardware check / stored prefs. */
  isLoading: boolean;
}

export interface UseBiometricReturn extends BiometricState {
  /** Enable biometric and store the current JWT behind OS auth. */
  enableBiometric: (token: string) => Promise<boolean>;
  /** Disable biometric and wipe the stored token. */
  disableBiometric: () => Promise<void>;
  /** Mark that the user was offered biometric (persist so we don't re-ask). */
  markOffered: () => Promise<void>;
  /** Attempt biometric unlock — returns the stored JWT or null. */
  tryBiometricUnlock: () => Promise<string | null>;
  /** Update the biometric-stored token (e.g., after JWT refresh). */
  updateStoredToken: (token: string) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────

export function useBiometric(): UseBiometricReturn {
  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    isEnabled: false,
    hasBeenOffered: false,
    isLoading: true,
  });

  // ── Bootstrap: check hardware + stored prefs ──────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const isAvailable = hasHardware && isEnrolled;

        const [enabledRaw, offeredRaw] = await Promise.all([
          SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY),
          SecureStore.getItemAsync(BIOMETRIC_OFFERED_KEY),
        ]);

        if (!cancelled) {
          setState({
            isAvailable,
            isEnabled: enabledRaw === 'true',
            hasBeenOffered: offeredRaw === 'true',
            isLoading: false,
          });
        }
      } catch (err) {
        console.warn('[useBiometric] Init error:', err);
        if (!cancelled) {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Enable biometric ─────────────────────────────────────
  const enableBiometric = useCallback(async (token: string): Promise<boolean> => {
    try {
      // Explicit "confirm intent" prompt before storing the token.
      // On iOS this is the only biometric gate (keychain write doesn't re-prompt).
      // On Android SecureStore.setItemAsync also prompts, so the user authenticates
      // twice — acceptable as a deliberate confirmation step for a security action.
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric unlock for Frequen-C',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (!result.success) return false;

      // Store token behind biometric gate
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token, {
        requireAuthentication: true,
        authenticationPrompt: 'Authenticate to access Frequen-C',
      });

      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      await SecureStore.setItemAsync(BIOMETRIC_OFFERED_KEY, 'true');

      setState((prev) => ({
        ...prev,
        isEnabled: true,
        hasBeenOffered: true,
      }));

      return true;
    } catch (err) {
      console.warn('[useBiometric] enableBiometric error:', err);
      return false;
    }
  }, []);

  // ── Disable biometric ────────────────────────────────────
  const disableBiometric = useCallback(async (): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
      await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'false');

      setState((prev) => ({ ...prev, isEnabled: false }));
    } catch (err) {
      console.warn('[useBiometric] disableBiometric error:', err);
    }
  }, []);

  // ── Mark offered (persist so we don't re-ask) ────────────
  const markOffered = useCallback(async (): Promise<void> => {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_OFFERED_KEY, 'true');
      setState((prev) => ({ ...prev, hasBeenOffered: true }));
    } catch (err) {
      console.warn('[useBiometric] markOffered error:', err);
    }
  }, []);

  // ── Try biometric unlock (returns JWT or null) ───────────
  const tryBiometricUnlock = useCallback(async (): Promise<string | null> => {
    try {
      // On Android: requireAuthentication on getItemAsync triggers the OS biometric prompt.
      // On iOS: the biometric gate is enforced by the keychain access control set at write
      // time; this read option is a no-op but harmless to include for Android parity.
      const token = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY, {
        requireAuthentication: true,
        authenticationPrompt: 'Unlock Frequen-C',
      });

      return token || null;
    } catch (err) {
      // User cancelled or biometric failed
      console.log('[useBiometric] Biometric unlock failed or cancelled:', err);
      return null;
    }
  }, []);

  // ── Update stored token (e.g., after JWT refresh) ────────
  const updateStoredToken = useCallback(async (token: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token, {
        requireAuthentication: true,
        authenticationPrompt: 'Authenticate to update Frequen-C credentials',
      });
    } catch (err) {
      console.warn('[useBiometric] updateStoredToken error:', err);
    }
  }, []);

  return {
    ...state,
    enableBiometric,
    disableBiometric,
    markOffered,
    tryBiometricUnlock,
    updateStoredToken,
  };
}

export default useBiometric;
