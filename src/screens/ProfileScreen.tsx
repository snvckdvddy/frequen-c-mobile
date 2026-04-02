import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeScreen, showToast } from '../components/ui';
import { VoidSurface } from '../design/components';
import { ServiceIcon } from '../components/icons/ServiceIcon';
import { SonicAuraCard } from '../components/profile/SonicAuraCard';
import { useAuth } from '../contexts/AuthContext';
import { useManualMode } from '../hooks/useManualMode';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { TacticalActionPrompt } from '../features/session-v2/components/TacticalActionPrompt';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { authApi, getStoredToken, type DisconnectableProvider, type ProviderStatusMap } from '../services/api';
import { formatAuthDiagnosticsText, getAuthDiagnostics } from '../services/authDiagnostics';
import { config } from '../config';
import type { User } from '../types';
import { notifyError, notifySuccess, tapHeavy, tapLight, tapMedium } from '../utils/haptics';
import { Input } from '../components/ui';

type PromptState =
  | null
  | { kind: 'logout' }
  | { kind: 'delete' }
  | { kind: 'deleteConfirm' }
  | { kind: 'disconnect'; provider: DisconnectableProvider; name: string };

type NoiseGate = 'off' | 'low' | 'medium' | 'high';
type SocialBattery = 'low' | 'unity' | 'hot';

const WALK_ON_OPTIONS = ['808 KICK', 'VINYL CRACKLE', 'SYNTH STAB', 'DOOR CHIME', 'NONE'] as const;

const PROVIDERS: Array<{ label: string; serviceKey: string; provider?: DisconnectableProvider; key: string }> = [
  { key: 'spotify', label: 'SPOTIFY', serviceKey: 'spotify', provider: 'spotify' },
  { key: 'apple', label: 'APPLE MUSIC', serviceKey: 'apple-music' },
  { key: 'tidal', label: 'TIDAL', serviceKey: 'tidal', provider: 'tidal' },
  { key: 'soundcloud', label: 'SOUNDCLOUD', serviceKey: 'soundcloud', provider: 'soundcloud' },
  { key: 'youtube', label: 'YOUTUBE MUSIC', serviceKey: 'youtube-music' },
  { key: 'lastfm', label: 'LAST.FM', serviceKey: 'lastfm', provider: 'lastfm' },
];

const mono = tacticalTokens.fonts.mono;
const monoBold = tacticalTokens.fonts.monoBold;
const display = tacticalTokens.fonts.display;

const textStyles = StyleSheet.create({
  mono: { fontFamily: mono },
  monoBold: { fontFamily: monoBold },
  display: { fontFamily: display },
});

function MonoText(props: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text {...props} />;
}

function getInitials(user: User | null) {
  const source = user?.username || user?.email || 'FC';
  return (
    source
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'FC'
  );
}

function formatListenTime(minutes?: number) {
  if (!minutes || minutes <= 0) return '00M';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}H ${String(mins).padStart(2, '0')}M` : `${String(mins).padStart(2, '0')}M`;
}

export function ProfileScreen() {
  const navigation = useNavigation<{ navigate: (screen: string) => void; goBack: () => void }>();
  const diagnostics = getAuthDiagnostics();
  const {
    user,
    logout,
    deleteAccount,
    setPassword,
    connectSpotify,
    connectSoundcloud,
    connectTidal,
    connectLastfm,
    disconnectService,
    biometric,
  } = useAuth();
  const { readManual, setReadManual } = useManualMode();

  const [profileUser, setProfileUser] = useState<User | null>(user);
  const [providerStatus, setProviderStatus] = useState<Partial<ProviderStatusMap>>({});
  const [loading, setLoading] = useState(!user);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [monitorOut, setMonitorOut] = useState(false);
  const [socialBattery, setSocialBattery] = useState<SocialBattery>('unity');
  const [noiseGate, setNoiseGate] = useState<NoiseGate>('medium');
  const [walkOnTransient, setWalkOnTransient] = useState<(typeof WALK_ON_OPTIONS)[number]>('808 KICK');

  // ── Security section state ───────────────────────────────
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Use context user as fallback in case local copy hasn't hydrated the field yet
  const resolvedProvider = profileUser?.authProvider ?? user?.authProvider;
  const isSocialOnly = resolvedProvider === 'apple' || resolvedProvider === 'google';

  const handleSetPassword = useCallback(async () => {
    setPasswordError(null);
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('AT LEAST 6 CHARACTERS');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('PASSWORDS DO NOT MATCH');
      return;
    }
    setPasswordLoading(true);
    try {
      await setPassword(newPassword);
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordSuccess(true);
      notifySuccess();
      showToast('Password set. You can now log in with email + password.', 'success', '!');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to set password.';
      setPasswordError(message.toUpperCase());
      notifyError();
    } finally {
      setPasswordLoading(false);
    }
  }, [newPassword, confirmNewPassword, setPassword]);

  const handleBiometricToggle = useCallback(async () => {
    tapLight();
    if (biometric.isEnabled) {
      await biometric.disableBiometric();
      notifySuccess();
      showToast('Biometric unlock disabled.', 'success', '!');
    } else {
      // Need the current token to store behind biometric gate
      const token = await getStoredToken();
      if (!token) return;
      const success = await biometric.enableBiometric(token);
      if (success) {
        notifySuccess();
        showToast('Biometric unlock enabled.', 'success', '!');
      }
    }
  }, [biometric.isEnabled, biometric.disableBiometric, biometric.enableBiometric]);

  const hydrate = useCallback((nextUser: User | null) => {
    setProfileUser(nextUser);
    const prefs = (nextUser as User & { preferences?: Record<string, unknown> })?.preferences;
    setMonitorOut(Boolean(prefs?.isIncognito));
    setSocialBattery((prefs?.socialBattery || 'unity') as SocialBattery);
    setNoiseGate((prefs?.noiseGate || nextUser?.noiseGate || 'medium') as NoiseGate);
    setWalkOnTransient(
      (prefs?.walkOnTransient ? (prefs.walkOnTransient === 'none' ? 'NONE' : String(prefs.walkOnTransient).toUpperCase()) : '808 KICK') as (typeof WALK_ON_OPTIONS)[number],
    );
  }, []);

  const refreshProfile = useCallback(async (toastOnFail = false) => {
    try {
      const [{ user: freshUser }, { providers }] = await Promise.all([authApi.me(), authApi.providerStatus()]);
      hydrate(freshUser);
      setProviderStatus(providers);
      setLoadError(null);
    } catch {
      setLoadError('PROFILE BUS OFFLINE');
      if (toastOnFail) {
        notifyError();
        showToast('Profile bus unavailable.', 'error', '!');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hydrate]);

  useEffect(() => {
    hydrate(user);
  }, [user, hydrate]);

  useEffect(() => {
    void refreshProfile(false);
  }, [refreshProfile]);

  const handleCopyDiagnostics = useCallback(async () => {
    try {
      const text = formatAuthDiagnosticsText();
      await Clipboard.setStringAsync(text);
      notifySuccess();
      showToast('Diagnostics copied.', 'success', '!');
    } catch {
      notifyError();
      showToast('Copy failed.', 'error', '!');
    }
  }, []);

  const mobileConfigMissing = useCallback((provider: DisconnectableProvider) => {
    switch (provider) {
      case 'spotify': return !config.SPOTIFY_CLIENT_ID;
      case 'soundcloud': return !config.SOUNDCLOUD_CLIENT_ID;
      case 'tidal': return !config.TIDAL_CLIENT_ID;
      case 'lastfm': return !config.LASTFM_API_KEY;
      default: return false;
    }
  }, []);

  const providerUnavailable = useCallback(
    (provider: DisconnectableProvider) => Boolean(providerStatus[provider] && !providerStatus[provider]?.backendConfigured),
    [providerStatus],
  );

  const persistPreference = useCallback(async (task: () => Promise<unknown>) => {
    try {
      await task();
    } catch {
      notifyError();
      showToast('Preference update failed.', 'error', '!');
      void refreshProfile(false);
    }
  }, [refreshProfile]);

  const handleConnect = useCallback(async (provider: DisconnectableProvider, label: string) => {
    if (mobileConfigMissing(provider)) {
      notifyError();
      showToast(`${label} mobile config is missing.`, 'warning', '!');
      return;
    }
    if (providerUnavailable(provider)) {
      notifyError();
      showToast(`${label} backend config is incomplete.`, 'warning', '!');
      return;
    }
    if ((provider === 'spotify' || provider === 'tidal') && diagnostics.isExpoGo) {
      showToast(`${label} may fail in Expo Go if the redirect is mismatched.`, 'warning', '!');
    }
    tapMedium();
    try {
      if (provider === 'spotify') await connectSpotify();
      if (provider === 'soundcloud') await connectSoundcloud();
      if (provider === 'tidal') await connectTidal();
      if (provider === 'lastfm') await connectLastfm();
    } catch {
      notifyError();
      showToast(`${label} patch failed.`, 'error', '!');
    }
  }, [
    connectLastfm,
    connectSoundcloud,
    connectSpotify,
    connectTidal,
    diagnostics.isExpoGo,
    mobileConfigMissing,
    providerUnavailable,
  ]);

  const confirmDisconnect = useCallback(async (provider: DisconnectableProvider, name: string) => {
    try {
      await disconnectService(provider);
      notifySuccess();
      showToast(`${name} unpatched.`, 'success', '!');
      setPrompt(null);
      void refreshProfile(false);
    } catch {
      notifyError();
      showToast(`Unable to disconnect ${name}.`, 'error', '!');
    }
  }, [disconnectService, refreshProfile]);

  const appVersion = Constants.expoConfig?.version || 'DEV';
  const initials = useMemo(() => getInitials(profileUser), [profileUser]);

  if (loading && !profileUser) {
    return (
      <SafeScreen>
        <VoidSurface style={styles.centerState}>
          <ActivityIndicator size="large" color={tacticalTokens.colors.ice} />
        </VoidSurface>
      </SafeScreen>
    );
  }

  if (!profileUser) {
    return (
      <SafeScreen>
        <VoidSurface style={styles.centerState}>
          <View style={styles.errorState}>
            <MonoText style={[textStyles.display, styles.errorTitle]}>NO PROFILE ROUTE</MonoText>
            <MonoText style={[textStyles.mono, styles.errorCopy]}>{loadError || 'PROFILE BUS UNAVAILABLE'}</MonoText>
            <Pressable onPress={() => { setLoading(true); void refreshProfile(true); }} accessibilityRole="button" accessibilityLabel="Retry loading profile" style={({ pressed }) => [styles.errorAction, pressed && styles.pressed]}>
              <MonoText style={[textStyles.monoBold, styles.errorActionText]}>RETRY</MonoText>
            </Pressable>
          </View>
        </VoidSurface>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.58} />
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void refreshProfile(true); }} tintColor={tacticalTokens.colors.ice} />}
          >
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <MonoText style={[textStyles.mono, styles.eyebrow]}>SYS.FREQ // PROFILE BUS</MonoText>
                <MonoText style={[textStyles.display, styles.title]}>SYSTEM PREFERENCES</MonoText>
                <MonoText style={[textStyles.mono, styles.subtitle]}>Personal routing, provider patch cables, and local room behavior.</MonoText>
              </View>
              <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close profile" style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <Ionicons name="close" size={18} color={tacticalTokens.colors.white} />
              </Pressable>
            </View>

            <View style={styles.panel}>
              <View style={styles.identityRow}>
                <View style={styles.avatar}><MonoText style={[textStyles.display, styles.avatarText]}>{initials}</MonoText></View>
                <View style={{ flex: 1 }}>
                  <MonoText style={[textStyles.display, styles.name]}>{(profileUser?.username || 'GUEST').toUpperCase()}</MonoText>
                  <MonoText style={[textStyles.mono, styles.email]}>{(profileUser?.email || 'NO EMAIL ROUTE').toUpperCase()}</MonoText>
                  <MonoText style={[textStyles.mono, styles.meta]}>PROFILE ACTIVE // {new Date(profileUser?.createdAt || Date.now()).toLocaleDateString()}</MonoText>
                </View>
              </View>
              <View style={styles.statRow}>
                {[
                  ['HOSTED', String(profileUser?.sessionsHosted ?? 0).padStart(2, '0'), tacticalTokens.colors.ice],
                  ['TRACKS', String(profileUser?.tracksAdded ?? 0).padStart(2, '0'), tacticalTokens.colors.acid],
                  ['LISTEN', formatListenTime(profileUser?.totalListeningTime), tacticalTokens.colors.white],
                  ['CV', `${String(profileUser?.voltageBalance ?? 0).padStart(3, '0')}V`, tacticalTokens.colors.orange],
                ].map(([label, value, color]) => (
                  <View key={label} style={styles.statChip}>
                    <MonoText style={[textStyles.display, styles.statValue, { color }]}>{value}</MonoText>
                    <MonoText style={[textStyles.mono, styles.statLabel]}>{label}</MonoText>
                  </View>
                ))}
              </View>
            </View>

            <SonicAuraCard roomsHosted={profileUser?.sessionsHosted ?? 0} duelWinRate={profileUser?.duelWinRate ?? 0} topArtists={profileUser?.topArtists ?? []} />

            <MonoText style={[textStyles.mono, styles.sectionLabel]}>LOCAL ROUTING</MonoText>
            <View style={styles.panel}>
              <View style={styles.row}>
                <View style={styles.rowCopy}>
                  <MonoText style={[textStyles.display, styles.rowTitle]}>READ THE MANUAL</MonoText>
                  <MonoText style={[textStyles.mono, styles.rowDescription]}>Keep guided onboarding rails active across auth, entry, join, and room-creation surfaces.</MonoText>
                  <View style={styles.rowMetaRow}>
                    <View style={[styles.manualStatusChip, readManual && styles.manualStatusChipActive]}>
                      <MonoText style={[textStyles.monoBold, styles.manualStatusText, readManual && styles.manualStatusTextActive]}>
                        {readManual ? 'ACTIVE' : 'OFF'}
                      </MonoText>
                    </View>
                    <Pressable
                      onPress={() => navigation.navigate('WelcomeBoot')}
                      accessibilityRole="button"
                      accessibilityLabel="Preview welcome screen"
                      style={({ pressed }) => [styles.manualPreviewChip, pressed && styles.pressed]}
                    >
                      <MonoText style={[textStyles.monoBold, styles.manualPreviewText]}>
                        PREVIEW WELCOME
                      </MonoText>
                    </Pressable>
                    <MonoText style={[textStyles.mono, styles.manualStatusCopy]}>
                      {readManual ? 'GUIDED HELPERS ARE LIVE' : 'ENTRY FLOW RUNS WITHOUT HINT RAILS'}
                    </MonoText>
                  </View>
                </View>
                <Pressable onPress={() => { tapLight(); setReadManual(!readManual); }} accessibilityRole="switch" accessibilityLabel="Read the manual" accessibilityState={{ checked: readManual }} style={({ pressed }) => [styles.toggle, readManual && styles.toggleActive, pressed && styles.pressed]}>
                  <View style={[styles.toggleKnob, readManual && styles.toggleKnobActive]} />
                </Pressable>
              </View>

              <View style={styles.row}>
                <View style={styles.rowCopy}>
                  <MonoText style={[textStyles.display, styles.rowTitle]}>MONITOR OUT</MonoText>
                  <MonoText style={[textStyles.mono, styles.rowDescription]}>Run incognito mode and mute public presence noise.</MonoText>
                </View>
                <Pressable
                  onPress={() => {
                    tapLight();
                    const next = !monitorOut;
                    setMonitorOut(next);
                    void persistPreference(() => authApi.setPreferences({ isIncognito: next }));
                  }}
                  accessibilityRole="switch"
                  accessibilityLabel="Monitor out incognito mode"
                  accessibilityState={{ checked: monitorOut }}
                  style={({ pressed }) => [styles.toggle, monitorOut && styles.toggleActive, pressed && styles.pressed]}
                >
                  <View style={[styles.toggleKnob, monitorOut && styles.toggleKnobActive]} />
                </Pressable>
              </View>

              {[
                {
                  title: 'SOCIAL BATTERY',
                  description: 'Set how aggressively the app nudges collaborative behavior.',
                  value: socialBattery,
                  set: (next: SocialBattery) => {
                    tapLight();
                    setSocialBattery(next);
                    void persistPreference(() => authApi.setPreferences({ socialBattery: next }));
                  },
                  options: [
                    ['LOW', 'low'],
                    ['UNITY', 'unity'],
                    ['HOT', 'hot'],
                  ] as const,
                },
                {
                  title: 'NOISE GATE',
                  description: 'Control how tightly ambient activity is filtered in your profile.',
                  value: noiseGate,
                  set: (next: NoiseGate) => {
                    tapLight();
                    setNoiseGate(next);
                    void persistPreference(() => authApi.setNoiseGate(next));
                  },
                  options: [
                    ['OFF', 'off'],
                    ['LOW', 'low'],
                    ['MED', 'medium'],
                    ['HIGH', 'high'],
                  ] as const,
                },
              ].map((group) => (
                <View key={group.title} style={styles.rowStack}>
                  <MonoText style={[textStyles.display, styles.rowTitle]}>{group.title}</MonoText>
                  <MonoText style={[textStyles.mono, styles.rowDescription]}>{group.description}</MonoText>
                  <View style={styles.segmentRow}>
                    {group.options.map(([label, value]) => {
                      const active = group.value === value;
                      return (
                        <Pressable key={label} onPress={() => group.set(value as never)} accessibilityRole="button" accessibilityLabel={`Set ${group.title.toLowerCase()} to ${label}`} accessibilityState={{ selected: active }} style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}>
                          <MonoText style={[textStyles.monoBold, styles.segmentText, active && styles.segmentTextActive]}>{label}</MonoText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}

              <View style={styles.rowLast}>
                <MonoText style={[textStyles.display, styles.rowTitle]}>WALK-ON TRANSIENT</MonoText>
                <MonoText style={[textStyles.mono, styles.rowDescription]}>Cycle the entrance sting armed for room joins.</MonoText>
                <Pressable
                  onPress={() => {
                    tapLight();
                    const next = WALK_ON_OPTIONS[(WALK_ON_OPTIONS.indexOf(walkOnTransient) + 1) % WALK_ON_OPTIONS.length];
                    setWalkOnTransient(next);
                    void persistPreference(() => authApi.setPreferences({ walkOnTransient: next === 'NONE' ? 'none' : next }));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Walk-on transient, current: ${walkOnTransient}`}
                  style={({ pressed }) => [styles.valueRail, pressed && styles.pressed]}
                >
                  <MonoText style={[textStyles.monoBold, styles.valueText]}>{walkOnTransient}</MonoText>
                  <Ionicons name="chevron-forward" size={14} color={tacticalTokens.colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {/* ── Security Section ─────────────────────────── */}
            {(biometric.isAvailable || isSocialOnly) && (
              <>
                <MonoText style={[textStyles.mono, styles.sectionLabel]}>SECURITY</MonoText>
                <View style={styles.panel}>
                  {biometric.isAvailable && (
                    <View style={styles.row}>
                      <View style={styles.rowCopy}>
                        <MonoText style={[textStyles.display, styles.rowTitle]}>BIOMETRIC UNLOCK</MonoText>
                        <MonoText style={[textStyles.mono, styles.rowDescription]}>
                          Use Face ID or fingerprint to unlock Frequen-C on launch.
                        </MonoText>
                      </View>
                      <Pressable
                        onPress={() => { void handleBiometricToggle(); }}
                        accessibilityRole="switch"
                        accessibilityLabel="Biometric unlock"
                        accessibilityState={{ checked: biometric.isEnabled }}
                        style={({ pressed }) => [
                          styles.toggle,
                          biometric.isEnabled && styles.toggleActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.toggleKnob, biometric.isEnabled && styles.toggleKnobActive]} />
                      </Pressable>
                    </View>
                  )}

                  {isSocialOnly && !passwordSuccess && (
                    <View style={styles.rowLast}>
                      <MonoText style={[textStyles.display, styles.rowTitle]}>SET PASSWORD</MonoText>
                      <MonoText style={[textStyles.mono, styles.rowDescription]}>
                        Add a password so you can also log in with email. Your {profileUser?.authProvider === 'apple' ? 'Apple' : 'Google'} sign-in stays connected.
                      </MonoText>
                      <View style={{ marginTop: 10, gap: 8 }}>
                        <Input
                          label="NEW PASSWORD"
                          placeholder="At least 6 characters"
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry
                          returnKeyType="next"
                          accessibilityLabel="New password"
                        />
                        <Input
                          label="CONFIRM PASSWORD"
                          placeholder="Re-enter password"
                          value={confirmNewPassword}
                          onChangeText={setConfirmNewPassword}
                          secureTextEntry
                          returnKeyType="done"
                          onSubmitEditing={() => { void handleSetPassword(); }}
                          accessibilityLabel="Confirm new password"
                        />
                        {passwordError && (
                          <View style={styles.passwordErrorRow}>
                            <Ionicons name="warning-outline" size={14} color={tacticalTokens.colors.orange} />
                            <MonoText style={[textStyles.mono, styles.passwordErrorText]}>{passwordError}</MonoText>
                          </View>
                        )}
                        <Pressable
                          onPress={() => { void handleSetPassword(); }}
                          disabled={passwordLoading}
                          accessibilityRole="button"
                          accessibilityLabel="Set password"
                          accessibilityState={{ disabled: passwordLoading }}
                          style={({ pressed }) => [
                            styles.setPasswordButton,
                            pressed && styles.pressed,
                            passwordLoading && { opacity: 0.35 },
                          ]}
                        >
                          {passwordLoading ? (
                            <ActivityIndicator size="small" color={tacticalTokens.colors.void} />
                          ) : (
                            <MonoText style={[textStyles.monoBold, styles.setPasswordButtonText]}>SET PASSWORD</MonoText>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {isSocialOnly && passwordSuccess && (
                    <View style={styles.rowLast}>
                      <MonoText style={[textStyles.display, styles.rowTitle]}>SET PASSWORD</MonoText>
                      <View style={styles.passwordSuccessRow}>
                        <Ionicons name="checkmark-circle" size={16} color={tacticalTokens.colors.acid} />
                        <MonoText style={[textStyles.mono, styles.passwordSuccessText]}>PASSWORD SET</MonoText>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}

            <MonoText style={[textStyles.mono, styles.sectionLabel]}>PATCH CABLES</MonoText>
            <View style={styles.panel}>
              {PROVIDERS.map((entry, index) => {
                const connected =
                  entry.provider === 'spotify' ? Boolean(profileUser?.connectedServices?.spotify?.connected)
                    : entry.provider === 'soundcloud' ? Boolean(profileUser?.connectedServices?.soundcloud?.connected)
                      : entry.provider === 'tidal' ? Boolean(profileUser?.connectedServices?.tidal?.connected)
                        : entry.provider === 'lastfm' ? Boolean(profileUser?.connectedServices?.lastfm?.connected)
                          : false;
                const username =
                  entry.provider === 'spotify' ? profileUser?.connectedServices?.spotify?.username
                    : entry.provider === 'soundcloud' ? profileUser?.connectedServices?.soundcloud?.username
                      : entry.provider === 'tidal' ? profileUser?.connectedServices?.tidal?.username
                        : entry.provider === 'lastfm' ? profileUser?.connectedServices?.lastfm?.username
                          : undefined;
                const comingSoon = !entry.provider;
                const blocked = entry.provider ? mobileConfigMissing(entry.provider) || providerUnavailable(entry.provider) : false;
                const status = comingSoon
                  ? 'SOON'
                  : connected
                    ? username ? `PATCHED // @${username.toUpperCase()}` : 'PATCHED'
                    : mobileConfigMissing(entry.provider!) ? 'MOBILE CONFIG MISSING'
                    : providerUnavailable(entry.provider!) ? 'BACKEND CONFIG MISSING'
                    : 'READY TO PATCH';

                return (
                  <View key={entry.key} style={index !== PROVIDERS.length - 1 ? styles.divider : undefined}>
                    <View style={styles.providerRow}>
                      <View style={styles.providerMeta}>
                        <View style={styles.providerIcon}><ServiceIcon service={entry.serviceKey} size={18} connected={connected} /></View>
                        <View style={{ flex: 1 }}>
                          <MonoText style={[textStyles.display, styles.providerTitle]}>{entry.label}</MonoText>
                          <MonoText style={[textStyles.mono, styles.providerStatus]}>{status}</MonoText>
                        </View>
                      </View>
                      <Pressable
                        onPress={() => {
                          if (comingSoon) {
                            showToast(`${entry.label} is not routed yet.`, 'info', '!');
                            return;
                          }
                          if (connected && entry.provider) {
                            tapMedium();
                            setPrompt({ kind: 'disconnect', provider: entry.provider, name: entry.label });
                            return;
                          }
                          if (entry.provider) void handleConnect(entry.provider, entry.label);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${comingSoon ? 'Coming soon' : connected ? 'Disconnect' : 'Connect'} ${entry.label}`}
                        style={({ pressed }) => [
                          styles.providerAction,
                          connected ? styles.providerActionDanger : blocked ? styles.providerActionMuted : styles.providerActionDefault,
                          pressed && styles.pressed,
                        ]}
                      >
                        <MonoText style={[textStyles.monoBold, styles.providerActionText]}>
                          {comingSoon ? 'SOON' : connected ? 'UNPATCH' : 'PATCH'}
                        </MonoText>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>

            <MonoText style={[textStyles.mono, styles.sectionLabel]}>CONFIG BUS</MonoText>
            <View style={styles.panel}>
              {([
                ['COPY AUTH DIAGNOSTICS', diagnostics.isExpoGo ? 'EXPO GO RUNTIME' : diagnostics.appOwnership.toUpperCase(), () => void handleCopyDiagnostics(), 'copy-outline'] as const,
                ['PRIVACY POLICY', 'OPEN EXTERNAL DOCUMENT', () => void Linking.openURL('https://snvckdvddy.github.io/frequen-c-landing/privacy.html').catch(() => { notifyError(); showToast('Unable to open external link.', 'error', '!'); }), 'open-outline'] as const,
                ['TERMS OF SERVICE', 'OPEN EXTERNAL DOCUMENT', () => void Linking.openURL('https://snvckdvddy.github.io/frequen-c-landing/terms.html').catch(() => { notifyError(); showToast('Unable to open external link.', 'error', '!'); }), 'open-outline'] as const,
              ]).map(([title, detail, onPress, icon], index) => (
                <Pressable key={title} onPress={onPress} accessibilityRole="button" accessibilityLabel={title as string} style={({ pressed }) => [styles.infoRow, index !== 2 && styles.divider, pressed && styles.pressed]}>
                  <View style={{ flex: 1 }}>
                    <MonoText style={[textStyles.display, styles.infoTitle]}>{title}</MonoText>
                    <MonoText style={[textStyles.mono, styles.infoDetail]}>{detail}</MonoText>
                  </View>
                  <Ionicons name={icon} size={16} color={tacticalTokens.colors.textMuted} />
                </Pressable>
              ))}
              <View style={styles.infoRow}>
                <View>
                  <MonoText style={[textStyles.display, styles.infoTitle]}>BUILD</MonoText>
                  <MonoText style={[textStyles.mono, styles.infoDetail]}>FREQUEN-C // {String(appVersion).toUpperCase()}</MonoText>
                </View>
              </View>
            </View>

            <View style={styles.actionStack}>
              <Pressable onPress={() => { tapMedium(); setPrompt({ kind: 'logout' }); }} accessibilityRole="button" accessibilityLabel="Log out" style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}>
                <MonoText style={[textStyles.monoBold, styles.primaryActionText]}>DISCONNECT</MonoText>
              </Pressable>
              <Pressable onPress={() => { tapHeavy(); setPrompt({ kind: 'delete' }); }} accessibilityRole="button" accessibilityLabel="Delete account" style={({ pressed }) => [styles.dangerAction, pressed && styles.pressed]}>
                <MonoText style={[textStyles.monoBold, styles.dangerActionText]}>DELETE ACCOUNT</MonoText>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </VoidSurface>

      <TacticalActionPrompt
        visible={Boolean(prompt)}
        eyebrow={prompt?.kind === 'disconnect' ? 'SYS.FREQ // PATCH BAY' : prompt?.kind?.startsWith('delete') ? 'SYS.FREQ // ACCOUNT CORE' : 'SYS.FREQ // SESSION CORE'}
        title={prompt?.kind === 'disconnect' ? `UNPATCH ${prompt.name}` : prompt?.kind === 'delete' ? 'DELETE ACCOUNT' : prompt?.kind === 'deleteConfirm' ? 'FINAL DELETE' : 'DISCONNECT CORE'}
        description={
          prompt?.kind === 'disconnect'
            ? `Remove the ${prompt.name} link from your provider bus.`
            : prompt?.kind === 'delete'
              ? 'This starts permanent account deletion and clears your profile routing.'
              : prompt?.kind === 'deleteConfirm'
                ? 'This cannot be undone. Sessions, favorites, and history will be erased.'
                : 'Log out of the current profile and return to the auth entry flow.'
        }
        onClose={() => setPrompt(null)}
        actions={
          prompt?.kind === 'disconnect'
            ? [
                { label: 'KEEP PATCHED', description: 'Leave this provider connected.', icon: 'return-up-back-outline', onPress: () => setPrompt(null) },
                { label: 'UNPATCH PROVIDER', description: 'Disconnect this service from your account.', icon: 'unlink-outline', tone: 'danger', onPress: () => { void confirmDisconnect(prompt.provider, prompt.name); } },
              ]
            : prompt?.kind === 'delete'
              ? [
                  { label: 'KEEP ACCOUNT', description: 'Abort deletion and leave the profile intact.', icon: 'return-up-back-outline', onPress: () => setPrompt(null) },
                  { label: 'CONTINUE', description: 'Move to the irreversible account deletion step.', icon: 'warning-outline', tone: 'danger', onPress: () => setPrompt({ kind: 'deleteConfirm' }) },
                ]
              : prompt?.kind === 'deleteConfirm'
                ? [
                    { label: 'ABORT DELETE', description: 'Cancel this destructive action.', icon: 'return-up-back-outline', onPress: () => setPrompt(null) },
                    { label: 'DELETE ACCOUNT', description: 'Permanently erase the current account.', icon: 'trash-outline', tone: 'danger', onPress: () => { void deleteAccount(); } },
                  ]
                : [
                    { label: 'STAY PATCHED', description: 'Keep the current user session active.', icon: 'return-up-back-outline', onPress: () => setPrompt(null) },
                    { label: 'LOG OUT', description: 'Disconnect this account from the current device.', icon: 'log-out-outline', tone: 'danger', onPress: () => { void logout(); } },
                  ]
        }
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  pressed: { opacity: 0.82 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  eyebrow: { fontSize: 10, color: tacticalTokens.colors.ice, letterSpacing: 2 },
  title: { marginTop: 2, fontSize: 32, color: tacticalTokens.colors.white },
  subtitle: { marginTop: 4, fontSize: 12, color: tacticalTokens.colors.textSoft, letterSpacing: 1, lineHeight: 20 },
  closeButton: { width: 44, height: 44, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { marginTop: 20, marginBottom: 8, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 2.2 },
  panel: { borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: 'rgba(8, 8, 8, 0.94)', paddingHorizontal: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: tacticalTokens.colors.borderSoft },
  identityRow: { flexDirection: 'row', gap: 12, paddingVertical: 16 },
  avatar: { width: 72, height: 72, borderWidth: 1, borderColor: tacticalTokens.colors.ice, backgroundColor: '#071116', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, color: tacticalTokens.colors.white },
  name: { fontSize: 28, color: tacticalTokens.colors.white },
  email: { marginTop: 2, fontSize: 12, color: tacticalTokens.colors.ice, letterSpacing: 1.2 },
  meta: { marginTop: 4, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.3 },
  statRow: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  statChip: { flex: 1, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, paddingHorizontal: 8, paddingVertical: 8 },
  statValue: { fontSize: 16 },
  statLabel: { marginTop: 2, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.2 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tacticalTokens.colors.borderSoft },
  rowLast: { paddingVertical: 12 },
  rowStack: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tacticalTokens.colors.borderSoft },
  rowCopy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, color: tacticalTokens.colors.white },
  rowDescription: { marginTop: 2, fontSize: 10, color: tacticalTokens.colors.textSoft, lineHeight: 18, letterSpacing: 1 },
  rowMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  manualStatusChip: { minHeight: 24, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tacticalTokens.colors.borderGhost, backgroundColor: tacticalTokens.colors.matte },
  manualStatusChipActive: { borderColor: tacticalTokens.colors.ice, backgroundColor: '#04161A' },
  manualStatusText: { fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.2 },
  manualStatusTextActive: { color: tacticalTokens.colors.ice },
  manualPreviewChip: {
    minHeight: 24,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.guide,
    backgroundColor: '#18120C',
  },
  manualPreviewText: {
    fontSize: 10,
    color: tacticalTokens.colors.guide,
    letterSpacing: 1.2,
  },
  manualStatusCopy: { fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.1 },
  toggle: { width: 48, height: 28, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive: { borderColor: tacticalTokens.colors.ice, backgroundColor: '#04161A' },
  toggleKnob: { width: 20, height: 20, backgroundColor: tacticalTokens.colors.textMuted },
  toggleKnobActive: { alignSelf: 'flex-end', backgroundColor: tacticalTokens.colors.ice },
  segmentRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  segment: { flex: 1, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  segmentActive: { borderColor: tacticalTokens.colors.white, backgroundColor: tacticalTokens.colors.white },
  segmentText: { fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.4 },
  segmentTextActive: { color: tacticalTokens.colors.void },
  valueRail: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, paddingHorizontal: 12, paddingVertical: 12 },
  valueText: { fontSize: 12, color: tacticalTokens.colors.ice, letterSpacing: 1.2 },
  providerRow: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  providerMeta: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  providerIcon: { width: 40, height: 40, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, alignItems: 'center', justifyContent: 'center' },
  providerTitle: { fontSize: 16, color: tacticalTokens.colors.white },
  providerStatus: { marginTop: 2, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.2 },
  providerAction: { minWidth: 92, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  providerActionDefault: { borderColor: tacticalTokens.colors.ice, backgroundColor: '#04161A' },
  providerActionDanger: { borderColor: tacticalTokens.colors.orange, backgroundColor: '#1A120D' },
  providerActionMuted: { borderColor: tacticalTokens.colors.borderGhost, backgroundColor: tacticalTokens.colors.matte },
  providerActionText: { fontSize: 10, color: tacticalTokens.colors.white, letterSpacing: 1.5 },
  infoRow: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  infoTitle: { fontSize: 16, color: tacticalTokens.colors.white },
  infoDetail: { marginTop: 2, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.2 },
  actionStack: { gap: 8, marginTop: 20 },
  primaryAction: { borderWidth: 1, borderColor: tacticalTokens.colors.white, backgroundColor: tacticalTokens.colors.white, alignItems: 'center', paddingVertical: 12 },
  primaryActionText: { fontSize: 12, color: tacticalTokens.colors.void, letterSpacing: 1.8 },
  dangerAction: { borderWidth: 1, borderColor: tacticalTokens.colors.orange, backgroundColor: '#1A120D', alignItems: 'center', paddingVertical: 12 },
  dangerActionText: { fontSize: 12, color: tacticalTokens.colors.orange, letterSpacing: 1.8 },
  errorState: { borderWidth: 1, borderColor: tacticalTokens.colors.borderGhost, borderStyle: 'dashed', paddingHorizontal: 24, paddingVertical: 28, alignItems: 'center', gap: 10 },
  errorTitle: { fontSize: 24, color: tacticalTokens.colors.white },
  errorCopy: { fontSize: 12, color: tacticalTokens.colors.textSoft, letterSpacing: 1, textAlign: 'center' },
  errorAction: { marginTop: 6, borderWidth: 1, borderColor: tacticalTokens.colors.ice, backgroundColor: '#04161A', paddingHorizontal: 16, paddingVertical: 10 },
  errorActionText: { fontSize: 10, color: tacticalTokens.colors.ice, letterSpacing: 1.5 },
  // ── Security section ─────────────────────────
  passwordErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  passwordErrorText: { fontSize: 10, color: tacticalTokens.colors.orange, letterSpacing: 1.2 },
  setPasswordButton: { height: 44, backgroundColor: tacticalTokens.colors.ice, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  setPasswordButtonText: { fontSize: 11, color: tacticalTokens.colors.void, letterSpacing: 1.8 },
  passwordSuccessRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  passwordSuccessText: { fontSize: 11, color: tacticalTokens.colors.acid, letterSpacing: 1.2 },
});

export default ProfileScreen;
