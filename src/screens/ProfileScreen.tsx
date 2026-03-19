/**
 * Profile Screen — Hardware Settings Panel (Gemini V7)
 *
 * Structure (slide-over modal):
 *   [person icon]                    [×]  ← Avatar + close button
 *   Caleb R.                              ← Username
 *   ─────────────────────────────────────
 *   ⓘ READ THE MANUAL          [toggle]  ← Tooltips toggle
 *     Toggle tooltips to understand...
 *   ─────────────────────────────────────
 *   🔊 MONITOR OUT              (jack)   ← Anonymous lurk mode
 *     Patch in Dummy Cable to lurk...
 *   ─────────────────────────────────────
 *   ⚡ SOCIAL BATTERY                     ← Slider: LOW → UNITY → HOT
 *   ─────────────────────────────────────
 *   🔇 NOISE GATE                        ← Slider: OPEN → GATE → PANIC
 *   ─────────────────────────────────────
 *   ▶ WALK-ON TRANSIENT                   ← Dropdown: sound selection
 *   ─────────────────────────────────────
 *   PATCH CABLES (service connections)
 *   DISCONNECT / DELETE ACCOUNT
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Text, Button, SafeScreen } from '../components/ui';
import { ServiceIcon } from '../components/icons/ServiceIcon';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  authApi,
  type DisconnectableProvider,
  type ProviderStatusMap,
} from '../services/api';
import { formatAuthDiagnosticsText, getAuthDiagnostics } from '../services/authDiagnostics';
import { config } from '../config';
import { spacing } from '../theme/spacing';
import { VoidSurface, ModuleFaceplate, ChromeButton } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, fontWeight, letterSpacing as ls } from '../design/tokens/typography';
import { SonicAuraCard } from '../components/profile/SonicAuraCard';

// ─── Helpers ──────────────────────────────────────────────────

function formatListenTime(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ─── Hardware Setting Card ──────────────────────────────────

function HardwareCard({ children, label }: { children: React.ReactNode; label?: string }) {
  return <ModuleFaceplate label={label} style={{ marginBottom: 12 }}>{children}</ModuleFaceplate>;
}

// ─── Service Jack Row ────────────────────────────────────────

function ServiceJack({
  name,
  connected,
  username,
  serviceKey,
  onConnect,
  onDisconnect,
  comingSoon = false,
  actionDisabled = false,
  statusText,
}: {
  name: string; connected: boolean; username?: string;
  serviceKey: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  comingSoon?: boolean;
  actionDisabled?: boolean;
  statusText?: string;
}) {
  const actionLabel = comingSoon ? 'COMING SOON' : (connected ? 'UNPATCH' : 'PATCH');
  const disabled = comingSoon || actionDisabled;
  const actionPress = disabled ? undefined : (connected ? onDisconnect : onConnect);
  const resolvedStatus = statusText || (comingSoon ? 'Not implemented' : connected ? (username ? `@${username}` : 'Patched') : 'Unpatched');

  return (
    <View style={sjStyles.row}>
      <View style={sjStyles.left}>
        <View style={[sjStyles.jack, connected && sjStyles.jackActive]}>
          <ServiceIcon service={serviceKey} size={18} connected={connected} />
        </View>
        <View>
          <Text style={sjStyles.name}>{name}</Text>
          <Text style={[sjStyles.status, actionDisabled && !connected && sjStyles.statusWarning]}>
            {resolvedStatus}
          </Text>
        </View>
      </View>
      <ChromeButton
        onPress={actionPress}
        disabled={disabled}
        size="sm"
        accessibilityLabel={`${actionLabel} ${name}`}
        accessibilityHint={
          comingSoon
            ? `${name} integration is not implemented yet`
            : disabled
              ? `${name} cannot be connected until backend provider configuration is fixed`
              : `Double tap to ${connected ? 'disconnect' : 'connect'} your ${name} account`
        }
      >
        {actionLabel}
      </ChromeButton>
    </View>
  );
}

const sjStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  jack: {
    width: 32,
    height: 32,
    borderRadius: 0,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jackActive: {
    borderColor: palette.ice,
    backgroundColor: colors.accentSecondarySubtle,
  },
  name: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: palette.frost,
  },
  status: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    letterSpacing: ls.normal,
  },
  statusWarning: {
    color: palette.red,
  },
  patchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    backgroundColor: palette.steel,
  },
  patchBtnText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.orange,
    letterSpacing: ls.normal,
  },
});

// ─── Main Screen ─────────────────────────────────────────────

interface ProfileScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

export function ProfileScreen({ onOpenRoom }: ProfileScreenProps) {
  const navigation = useNavigation<any>();
  const {
    user,
    logout,
    deleteAccount,
    connectSpotify,
    connectSoundcloud,
    connectTidal,
    connectLastfm,
    disconnectService,
  } = useAuth();
  const { accent, isVoltageSag } = useTheme();
  const authDiagnostics = getAuthDiagnostics();
  const [refreshing, setRefreshing] = useState(false);
  const [providerStatus, setProviderStatus] = useState<Partial<ProviderStatusMap>>({});
  const [readManual, setReadManual] = useState(false);
  const [monitorOut, setMonitorOut] = useState(
    (user as any)?.preferences?.isIncognito ?? false
  );
  // Hydrate from server preferences (user.preferences comes from /auth/me)
  const prefs = (user as any)?.preferences;
  const [socialBattery, setSocialBattery] = useState<'low' | 'unity' | 'hot'>(
    prefs?.socialBattery || 'unity'
  );
  const noiseGateMap: Record<string, 'open' | 'gate' | 'panic'> = { off: 'open', medium: 'gate', high: 'panic' };
  const [noiseGate, setNoiseGate] = useState<'open' | 'gate' | 'panic'>(
    noiseGateMap[prefs?.noiseGate || user?.noiseGate || 'medium'] || 'gate'
  );
  const [walkOnTransient, setWalkOnTransient] = useState(
    prefs?.walkOnTransient === 'none' ? 'None'
      : prefs?.walkOnTransient ? prefs.walkOnTransient
      : '808 Kick'
  );

  const refreshProviderStatus = useCallback(async () => {
    try {
      const { providers } = await authApi.providerStatus();
      setProviderStatus(providers);
    } catch (error) {
      console.warn('[Profile] Failed to load provider status:', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { user: freshUser } = await authApi.me();
      await refreshProviderStatus();
      // Re-hydrate local state from server preferences
      const p = (freshUser as any)?.preferences;
      if (p) {
        const ngMap: Record<string, 'open' | 'gate' | 'panic'> = { off: 'open', medium: 'gate', high: 'panic' };
        if (p.noiseGate) setNoiseGate(ngMap[p.noiseGate] || 'gate');
        if (p.socialBattery) setSocialBattery(p.socialBattery);
        if (p.walkOnTransient) setWalkOnTransient(p.walkOnTransient === 'none' ? 'None' : p.walkOnTransient);
        if (p.isIncognito !== undefined) setMonitorOut(!!p.isIncognito);
      }
    } catch { /* swallow */ } finally {
      setRefreshing(false);
    }
  }, [refreshProviderStatus]);

  useEffect(() => {
    if (!user) return;
    refreshProviderStatus();
  }, [user, refreshProviderStatus]);

  // Deterministic avatar hue from username
  const avatarHue = useMemo(() => {
    const name = user?.username || '?';
    return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  }, [user?.username]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Disconnect',
      'Unplug from this signal chain?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: logout },
      ]
    );
  }, [logout]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently erase your account and all associated data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'All sessions, favorites, and listening history will be permanently deleted.',
              [
                { text: 'Go Back', style: 'cancel' },
                { text: 'Yes, Delete', style: 'destructive', onPress: deleteAccount },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount]);

  const showProviderConfigAlert = useCallback((provider: DisconnectableProvider, service: string) => {
    const status = providerStatus[provider];
    Alert.alert(
      `${service} Unavailable`,
      `${status?.reason || 'Backend provider configuration is incomplete.'}\n\nFinish the backend env setup, then retry this connection.`
    );
  }, [providerStatus]);

  const isMobileProviderConfigMissing = useCallback((provider: DisconnectableProvider) => {
    switch (provider) {
      case 'spotify':
        return !config.SPOTIFY_CLIENT_ID;
      case 'soundcloud':
        return !config.SOUNDCLOUD_CLIENT_ID;
      case 'tidal':
        return !config.TIDAL_CLIENT_ID;
      case 'lastfm':
        return !config.LASTFM_API_KEY;
      default:
        return false;
    }
  }, []);

  const isProviderUnavailable = useCallback((provider: DisconnectableProvider) => {
    const status = providerStatus[provider];
    return !!status && !status.backendConfigured;
  }, [providerStatus]);

  const getProviderStatusText = useCallback((provider: DisconnectableProvider) => {
    if (isMobileProviderConfigMissing(provider)) {
      return 'Mobile config missing';
    }
    if (isProviderUnavailable(provider)) {
      return 'Backend config missing';
    }
    return undefined;
  }, [isMobileProviderConfigMissing, isProviderUnavailable]);

  const handleConnectService = (service: string) => {
    const providerMap: Partial<Record<string, DisconnectableProvider>> = {
      Spotify: 'spotify',
      SoundCloud: 'soundcloud',
      Tidal: 'tidal',
      'Last.fm': 'lastfm',
    };
    const provider = providerMap[service];

    if (provider && isProviderUnavailable(provider)) {
      showProviderConfigAlert(provider, service);
      return;
    }

    if (service === 'Spotify') {
      if (!config.SPOTIFY_CLIENT_ID) {
        Alert.alert(
          'Spotify Not Configured',
          'Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in your .env file.\n\nCreate a free Spotify Developer App at developer.spotify.com to get your Client ID.'
        );
        return;
      }
      if (authDiagnostics.isExpoGo) {
        Alert.alert(
          'Spotify Redirect Warning',
          `Current runtime is Expo Go.\n\nSpotify redirect URI:\n${authDiagnostics.spotifyRedirectUri}\n\nIf Spotify dashboard is registered to frequenc:// instead of this runtime redirect, sign-in will fail with an invalid page.`
        );
      }
      connectSpotify();
      return;
    }
    if (service === 'SoundCloud') {
      if (!config.SOUNDCLOUD_CLIENT_ID) {
        Alert.alert(
          'SoundCloud Not Configured',
          'Set EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID in your mobile .env file.\n\nUse the public client ID from your SoundCloud developer app.'
        );
        return;
      }
      connectSoundcloud();
      return;
    }
    if (service === 'Tidal') {
      if (!config.TIDAL_CLIENT_ID) {
        Alert.alert(
          'Tidal Not Configured',
          'Set EXPO_PUBLIC_TIDAL_CLIENT_ID in your mobile .env file.\n\nUse the public client ID from your Tidal developer app.'
        );
        return;
      }
      if (authDiagnostics.isExpoGo) {
        Alert.alert(
          'Tidal Redirect Warning',
          `Current runtime is Expo Go.\n\nTidal redirect URI:\n${authDiagnostics.tidalRedirectUri}\n\nIf Tidal dashboard is registered to frequenc:// instead of this runtime redirect, sign-in will fail with an invalid page.`
        );
      }
      connectTidal();
      return;
    }
    if (service === 'Last.fm') {
      if (!config.LASTFM_API_KEY) {
        Alert.alert(
          'Last.fm Not Configured',
          'Set EXPO_PUBLIC_LASTFM_API_KEY in your .env file.\n\nGet a free API key at last.fm/api/account/create'
        );
        return;
      }
      connectLastfm();
      return;
    }
    if (service === 'Apple Music' || service === 'YouTube Music') {
      Alert.alert('Coming Soon', `${service} patch cable is not implemented yet.`);
      return;
    }
    Alert.alert('Coming Soon', `${service} patch cable is coming in a future update.`);
  };

  const handleDisconnectService = useCallback((provider: 'spotify' | 'soundcloud' | 'tidal' | 'lastfm', name: string) => {
    Alert.alert(
      `Unpatch ${name}?`,
      `This will disconnect your ${name} account from Frequen-C.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'UNPATCH',
          style: 'destructive',
          onPress: () => {
            disconnectService(provider).catch(() => {
              Alert.alert('Disconnect Failed', `Could not disconnect ${name}. Please try again.`);
            });
          },
        },
      ]
    );
  }, [disconnectService]);

  const handleCopyAuthDiagnostics = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(formatAuthDiagnosticsText());
      Alert.alert('Copied', 'Auth diagnostics copied to clipboard.');
    } catch {
      Alert.alert('Copy Failed', 'Could not copy auth diagnostics.');
    }
  }, []);

  const cycleSocialBattery = () => {
    const levels: Array<'low' | 'unity' | 'hot'> = ['low', 'unity', 'hot'];
    const idx = levels.indexOf(socialBattery);
    const next = levels[(idx + 1) % levels.length];
    setSocialBattery(next);
    authApi.setPreferences({ socialBattery: next }).catch(console.error);
  };

  const cycleNoiseGate = () => {
    const levels: Array<'open' | 'gate' | 'panic'> = ['open', 'gate', 'panic'];
    const idx = levels.indexOf(noiseGate);
    const next = levels[(idx + 1) % levels.length];
    setNoiseGate(next);
    // Map to API values
    const apiMap = { open: 'off' as const, gate: 'medium' as const, panic: 'high' as const };
    authApi.setNoiseGate(apiMap[next]).catch(console.error);
  };

  const cycleWalkOn = () => {
    const sounds = ['808 Kick', 'Vinyl Crackle', 'Synth Stab', 'Door Chime', 'None'];
    const idx = sounds.indexOf(walkOnTransient);
    const next = sounds[(idx + 1) % sounds.length];
    setWalkOnTransient(next);
    authApi.setPreferences({ walkOnTransient: next === 'None' ? 'none' : next }).catch(console.error);
  };

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />
          }
        >
          {/* ═══ Header — Brutalist Title + Close ═══════════════════ */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={styles.systemHeader}>SYSTEM PREFERENCES</Text>
              <Text style={styles.systemSubheader}>
                {user?.username ? `${user.username.toUpperCase()} / ACTIVE SIGNAL` : 'ANONYMOUS / UNPATCHED'}
                {user?.email ? `\n${user.email.toUpperCase()}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close profile"
              accessibilityHint="Double tap to close this panel"
            >
              <Ionicons name="close" size={20} color={palette.silver} />
            </TouchableOpacity>
          </View>

          {/* ═══ SONIC AURA (AI) ═════════════════════════ */}
          <SonicAuraCard
            roomsHosted={user?.sessionsHosted ?? 0}
            duelWinRate={user?.duelWinRate ?? 0}
            topArtists={user?.topArtists ?? []}
          />

          {/* ═══ READ THE MANUAL ══════════════════════════ */}
          <HardwareCard label="READ THE MANUAL">
            <View style={styles.settingRow}>
              <Ionicons name="information-circle-outline" size={16} color={isVoltageSag ? palette.amber : palette.ice} />
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[styles.toggle, readManual && { backgroundColor: accent + '33', borderColor: accent }]}
                onPress={() => setReadManual(!readManual)}
                accessibilityRole="switch"
                accessibilityLabel="Read the manual toggle"
                accessibilityState={{ checked: readManual }}
              >
                <View style={[styles.toggleKnob, readManual && { backgroundColor: accent, alignSelf: 'flex-end' }]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDesc}>
              Toggle tooltips to understand hardware features.
            </Text>
          </HardwareCard>

          {/* ═══ MONITOR OUT ══════════════════════════════ */}
          <HardwareCard label="MONITOR OUT">
            <View style={styles.settingRow}>
              <Ionicons name="headset-outline" size={16} color={palette.silver} />
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.monitorJack}
                onPress={() => {
                  const next = !monitorOut;
                  setMonitorOut(next);
                  authApi.setPreferences({ isIncognito: next }).catch(console.error);
                }}
                accessibilityRole="switch"
                accessibilityLabel="Monitor out toggle"
                accessibilityState={{ checked: monitorOut }}
                accessibilityHint="Toggle dummy cable to lurk anonymously"
              >
                <View style={[
                  styles.monitorJackHole,
                  monitorOut && { borderColor: accent, backgroundColor: accent + '33' },
                ]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDesc}>
              Patch in Dummy Cable to lurk anonymously.
            </Text>
          </HardwareCard>

          {/* ═══ SOCIAL BATTERY ════════════════════════════ */}
          <HardwareCard label="SOCIAL BATTERY">
            <View style={[styles.settingLeft, { marginBottom: 0 }]}>
              <Ionicons name="flash-outline" size={16} color={accent} />
            </View>
            <TouchableOpacity onPress={cycleSocialBattery} activeOpacity={0.7} accessibilityRole="adjustable" accessibilityLabel="Social battery level" accessibilityHint={`Current level: ${socialBattery.toUpperCase()}. Double tap to cycle through levels`}>
              <View style={styles.sliderTrack}>
                <View style={[
                  styles.sliderFill,
                  {
                    width: socialBattery === 'low' ? '15%' : socialBattery === 'unity' ? '50%' : '85%',
                    backgroundColor: socialBattery === 'hot' ? palette.red : socialBattery === 'unity' ? accent : palette.chromeBorder,
                  },
                ]} />
                <View style={[
                  styles.sliderThumb,
                  {
                    left: socialBattery === 'low' ? '15%' : socialBattery === 'unity' ? '50%' : '85%',
                    backgroundColor: socialBattery === 'hot' ? palette.red : socialBattery === 'unity' ? accent : palette.silver,
                  },
                ]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, socialBattery === 'low' && styles.sliderLabelActive]}>
                  LOW
                </Text>
                <Text style={[styles.sliderLabel, styles.sliderLabelCenter, socialBattery === 'unity' && styles.sliderLabelActive]}>
                  UNITY
                </Text>
                <Text style={[styles.sliderLabel, socialBattery === 'hot' && styles.sliderLabelActive]}>
                  HOT
                </Text>
              </View>
            </TouchableOpacity>
          </HardwareCard>

          {/* ═══ NOISE GATE ═══════════════════════════════ */}
          <HardwareCard label="NOISE GATE">
            <View style={[styles.settingLeft, { marginBottom: 0 }]}>
              <Ionicons name="volume-mute-outline" size={16} color={palette.silver} />
            </View>
            <TouchableOpacity onPress={cycleNoiseGate} activeOpacity={0.7} accessibilityRole="adjustable" accessibilityLabel="Noise gate level" accessibilityHint={`Current level: ${noiseGate.toUpperCase()}. Double tap to cycle through levels`}>
              <View style={styles.sliderTrack}>
                <View style={[
                  styles.sliderFill,
                  {
                    width: noiseGate === 'open' ? '15%' : noiseGate === 'gate' ? '50%' : '85%',
                    backgroundColor: noiseGate === 'panic' ? palette.red : noiseGate === 'gate' ? accent : palette.chromeBorder,
                  },
                ]} />
                <View style={[
                  styles.sliderThumb,
                  {
                    left: noiseGate === 'open' ? '15%' : noiseGate === 'gate' ? '50%' : '85%',
                    backgroundColor: noiseGate === 'panic' ? palette.red : noiseGate === 'gate' ? accent : palette.silver,
                  },
                ]} />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={[styles.sliderLabel, noiseGate === 'open' && styles.sliderLabelActive]}>
                  OPEN
                </Text>
                <Text style={[styles.sliderLabel, styles.sliderLabelCenter, noiseGate === 'gate' && styles.sliderLabelActive]}>
                  GATE
                </Text>
                <Text style={[styles.sliderLabel, noiseGate === 'panic' && styles.sliderLabelActive]}>
                  PANIC
                </Text>
              </View>
            </TouchableOpacity>
          </HardwareCard>

          {/* ═══ WALK-ON TRANSIENT ════════════════════════ */}
          <HardwareCard label="WALK-ON TRANSIENT">
            <View style={styles.settingRow}>
              <Ionicons name="play-outline" size={16} color={palette.silver} />
            </View>
            <TouchableOpacity style={styles.dropdown} onPress={cycleWalkOn} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Walk-on transient selector" accessibilityHint={`Current selection: ${walkOnTransient}. Double tap to cycle through sounds`}>
              <Text style={styles.dropdownText}>{walkOnTransient}</Text>
              <Ionicons name="chevron-down" size={14} color={palette.slate} />
            </TouchableOpacity>
          </HardwareCard>

          {/* ═══ PATCH CABLES (Services) ══════════════════ */}
          <ModuleFaceplate label="PATCH CABLES" style={{ marginBottom: 4 }}>
            <View style={{ paddingHorizontal: 4 }}>
              <ServiceJack
                name="Spotify"
                connected={!!user?.connectedServices?.spotify?.connected}
                username={user?.connectedServices?.spotify?.username}
                serviceKey="spotify"
                onConnect={() => handleConnectService('Spotify')}
                onDisconnect={() => handleDisconnectService('spotify', 'Spotify')}
                actionDisabled={
                  !user?.connectedServices?.spotify?.connected &&
                  (isMobileProviderConfigMissing('spotify') || isProviderUnavailable('spotify'))
                }
                statusText={!user?.connectedServices?.spotify?.connected ? getProviderStatusText('spotify') : undefined}
              />
              <ServiceJack
                name="Apple Music"
                connected={!!user?.connectedServices?.appleMusic?.connected}
                serviceKey="apple-music"
                onConnect={() => handleConnectService('Apple Music')}
                comingSoon
              />
              <ServiceJack
                name="Tidal"
                connected={!!user?.connectedServices?.tidal?.connected}
                serviceKey="tidal"
                onConnect={() => handleConnectService('Tidal')}
                onDisconnect={() => handleDisconnectService('tidal', 'Tidal')}
                actionDisabled={
                  !user?.connectedServices?.tidal?.connected &&
                  (isMobileProviderConfigMissing('tidal') || isProviderUnavailable('tidal'))
                }
                statusText={!user?.connectedServices?.tidal?.connected ? getProviderStatusText('tidal') : undefined}
              />
              <ServiceJack
                name="SoundCloud"
                connected={!!user?.connectedServices?.soundcloud?.connected}
                username={user?.connectedServices?.soundcloud?.username}
                serviceKey="soundcloud"
                onConnect={() => handleConnectService('SoundCloud')}
                onDisconnect={() => handleDisconnectService('soundcloud', 'SoundCloud')}
                actionDisabled={
                  !user?.connectedServices?.soundcloud?.connected &&
                  (isMobileProviderConfigMissing('soundcloud') || isProviderUnavailable('soundcloud'))
                }
                statusText={!user?.connectedServices?.soundcloud?.connected ? getProviderStatusText('soundcloud') : undefined}
              />
              <ServiceJack
                name="YouTube Music"
                connected={!!user?.connectedServices?.youtube?.connected}
                serviceKey="youtube-music"
                onConnect={() => handleConnectService('YouTube Music')}
                comingSoon
              />
              <ServiceJack
                name="Last.fm"
                connected={!!user?.connectedServices?.lastfm?.connected}
                username={user?.connectedServices?.lastfm?.username}
                serviceKey="lastfm"
                onConnect={() => handleConnectService('Last.fm')}
                onDisconnect={() => handleDisconnectService('lastfm', 'Last.fm')}
                actionDisabled={
                  !user?.connectedServices?.lastfm?.connected &&
                  (isMobileProviderConfigMissing('lastfm') || isProviderUnavailable('lastfm'))
                }
                statusText={!user?.connectedServices?.lastfm?.connected ? getProviderStatusText('lastfm') : undefined}
              />
            </View>
          </ModuleFaceplate>

          {/* ═══ LEGAL ═══════════════════════════════════ */}
          <ModuleFaceplate label="CONFIGURATION">
            <View style={{ paddingHorizontal: 4 }}>
              <View style={styles.legalRow}>
                <Text style={styles.legalText}>Auth Runtime</Text>
                <Text style={styles.legalValue}>
                  {authDiagnostics.isExpoGo ? 'Expo Go' : authDiagnostics.appOwnership}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.legalRow}
                onPress={handleCopyAuthDiagnostics}
              >
                <Text style={styles.legalText}>Copy Auth Diagnostics</Text>
                <Ionicons name="copy-outline" size={12} color={palette.slate} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.legalRow}
                onPress={() => Linking.openURL('https://snvckdvddy.github.io/frequen-c-landing/privacy.html').catch(() =>
                  Alert.alert('Error', 'Could not open Privacy Policy')
                )}
              >
                <Text style={styles.legalText}>Privacy Policy</Text>
                <Ionicons name="open-outline" size={12} color={palette.slate} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.legalRow}
                onPress={() => Linking.openURL('https://snvckdvddy.github.io/frequen-c-landing/terms.html').catch(() =>
                  Alert.alert('Error', 'Could not open Terms of Service')
                )}
              >
                <Text style={styles.legalText}>Terms of Service</Text>
                <Ionicons name="open-outline" size={12} color={palette.slate} />
              </TouchableOpacity>
              <View style={[styles.legalRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.legalText}>About</Text>
                <Text style={styles.legalValue}>v1.0.0-alpha</Text>
              </View>
            </View>
          </ModuleFaceplate>

          {/* ═══ DISCONNECT ══════════════════════════════ */}
          <ChromeButton
            onPress={handleLogout}
            size="md"
            style={styles.disconnectBtn}
            accessibilityLabel="Disconnect account"
            accessibilityHint="Double tap to log out and disconnect from this signal chain"
          >DISCONNECT</ChromeButton>

          {/* ═══ DELETE ACCOUNT ═══════════════════════════ */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityHint="Double tap to permanently delete your account. This action cannot be undone."
          >
            <Text style={styles.deleteText}>DELETE ACCOUNT</Text>
          </TouchableOpacity>

          {/* Build tag */}
          <Text style={styles.buildTag}>FREQUEN-C · DESN 374-040</Text>

          <View style={{ height: 60 }} />
        </ScrollView>
      </VoidSurface>
    </SafeScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 0,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemHeader: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    color: palette.frost,
    letterSpacing: 2,
    marginBottom: 4,
  },
  systemSubheader: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.wider,
    marginBottom: spacing.md,
    lineHeight: 14,
  },

  // Settings
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  settingLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.frost,
    letterSpacing: ls.wide,
  },
  settingDesc: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: palette.slate,
    lineHeight: 18,
  },

  // Toggle switch
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 0,
    backgroundColor: palette.steel,
    padding: 2,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  toggleActive: {
    // Replaced inline
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 0,
    backgroundColor: palette.slate,
  },
  toggleKnobActive: {
    // Replaced inline
  },

  // Monitor jack
  monitorJack: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: palette.midnight,
    borderWidth: 2,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorJackHole: {
    width: 14,
    height: 14,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: palette.slate,
    backgroundColor: 'transparent',
  },

  // Slider
  sliderTrack: {
    height: 4,
    backgroundColor: palette.steel,
    borderRadius: 0,
    marginTop: 12,
    marginBottom: 8,
    position: 'relative',
  },
  sliderFill: {
    height: 4,
    backgroundColor: palette.chromeBorder,
    borderRadius: 0,
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 0,
    backgroundColor: palette.silver,
    marginLeft: -8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.normal,
  },
  sliderLabelCenter: {
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
  },
  sliderLabelActive: {
    color: palette.frost,
    fontWeight: fontWeight.bold,
  },

  // Dropdown
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.steel,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  dropdownText: {
    fontFamily: fontFamily.display,
    fontSize: 14,
    color: palette.frost,
  },

  // Section labels
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.slate,
    letterSpacing: ls.wider,
    marginTop: spacing.lg,
    marginBottom: 10,
  },

  // Services panel
  servicesPanel: {
    backgroundColor: palette.midnight,
    borderRadius: 0,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    marginBottom: 4,
  },

  // Legal panel
  legalPanel: {
    backgroundColor: palette.midnight,
    borderRadius: 0,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  legalText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: palette.frost,
  },
  legalValue: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.normal,
  },

  // Action buttons
  disconnectBtn: {
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
  deleteBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 24,
    opacity: 0.6,
  },
  deleteText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.red,
    letterSpacing: ls.normal,
  },
  buildTag: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    textAlign: 'center',
    marginTop: spacing.lg,
    opacity: 0.3,
    letterSpacing: ls.wider,
  },
});

export default ProfileScreen;
