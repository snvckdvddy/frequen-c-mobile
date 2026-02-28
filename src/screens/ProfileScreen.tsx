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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Text, Button, SafeScreen } from '../components/ui';
import { ServiceIcon } from '../components/icons/ServiceIcon';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';
import { config } from '../config';
import { spacing } from '../theme/spacing';
import { VoidSurface } from '../design/components';
import { palette } from '../design/tokens/materials';

// ─── Helpers ──────────────────────────────────────────────────

function formatListenTime(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ─── Hardware Setting Card ──────────────────────────────────

function HardwareCard({ children }: { children: React.ReactNode }) {
  return <View style={hwStyles.card}>{children}</View>;
}

const hwStyles = StyleSheet.create({
  card: {
    backgroundColor: palette.midnight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    padding: 18,
    marginBottom: 12,
  },
});

// ─── Service Jack Row ────────────────────────────────────────

function ServiceJack({
  name, connected, username, serviceKey, onConnect,
}: {
  name: string; connected: boolean; username?: string;
  serviceKey: string; onConnect: () => void;
}) {
  return (
    <View style={sjStyles.row}>
      <View style={sjStyles.left}>
        <View style={[sjStyles.jack, connected && sjStyles.jackActive]}>
          <ServiceIcon service={serviceKey} size={18} connected={connected} />
        </View>
        <View>
          <Text style={sjStyles.name}>{name}</Text>
          <Text style={sjStyles.status}>
            {connected ? (username ? `@${username}` : 'Patched') : 'Unpatched'}
          </Text>
        </View>
      </View>
      {!connected ? (
        <TouchableOpacity onPress={onConnect} style={sjStyles.patchBtn}>
          <Text style={sjStyles.patchBtnText}>PATCH</Text>
        </TouchableOpacity>
      ) : (
        <View style={sjStyles.activeDot} />
      )}
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
    borderRadius: 16,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jackActive: {
    borderColor: palette.ice,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
  },
  name: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 13,
    color: palette.frost,
  },
  status: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.slate,
    letterSpacing: 1,
  },
  patchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    backgroundColor: palette.steel,
  },
  patchBtnText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.orange,
    letterSpacing: 1,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.ice,
  },
});

// ─── Main Screen ─────────────────────────────────────────────

interface ProfileScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

export function ProfileScreen({ onOpenRoom }: ProfileScreenProps) {
  const navigation = useNavigation<any>();
  const { user, logout, deleteAccount, connectSpotify, connectLastfm } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [readManual, setReadManual] = useState(false);
  const [monitorOut, setMonitorOut] = useState(false);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { user: freshUser } = await authApi.me();
      // Re-hydrate local state from server preferences
      const p = (freshUser as any)?.preferences;
      if (p) {
        const ngMap: Record<string, 'open' | 'gate' | 'panic'> = { off: 'open', medium: 'gate', high: 'panic' };
        if (p.noiseGate) setNoiseGate(ngMap[p.noiseGate] || 'gate');
        if (p.socialBattery) setSocialBattery(p.socialBattery);
        if (p.walkOnTransient) setWalkOnTransient(p.walkOnTransient === 'none' ? 'None' : p.walkOnTransient);
      }
    } catch { /* swallow */ } finally {
      setRefreshing(false);
    }
  }, []);

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

  const handleConnectService = (service: string) => {
    if (service === 'Spotify') {
      if (!config.SPOTIFY_CLIENT_ID) {
        Alert.alert(
          'Spotify Not Configured',
          'Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID in your .env file.\n\nCreate a free Spotify Developer App at developer.spotify.com to get your Client ID.'
        );
        return;
      }
      connectSpotify();
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
    Alert.alert('Coming Soon', `${service} patch cable is coming in a future update.`);
  };

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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.orange} />
          }
        >
          {/* ═══ Header — Avatar + Close ═══════════════════ */}
          <View style={styles.headerRow}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person-outline" size={28} color={palette.silver} />
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={palette.silver} />
            </TouchableOpacity>
          </View>

          <Text style={styles.username}>
            {user?.username
              ? `${user.username.charAt(0).toUpperCase()}${user.username.slice(1)}.`
              : 'Anonymous'}
          </Text>
          {user?.email && (
            <Text style={styles.email}>{user.email}</Text>
          )}

          {/* ═══ READ THE MANUAL ══════════════════════════ */}
          <HardwareCard>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="information-circle-outline" size={16} color={palette.ice} />
                <Text style={styles.settingLabel}>READ THE MANUAL</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, readManual && styles.toggleActive]}
                onPress={() => setReadManual(!readManual)}
              >
                <View style={[styles.toggleKnob, readManual && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDesc}>
              Toggle tooltips to understand hardware features.
            </Text>
          </HardwareCard>

          {/* ═══ MONITOR OUT ══════════════════════════════ */}
          <HardwareCard>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="headset-outline" size={16} color={palette.silver} />
                <Text style={styles.settingLabel}>MONITOR OUT</Text>
              </View>
              <TouchableOpacity
                style={styles.monitorJack}
                onPress={() => setMonitorOut(!monitorOut)}
              >
                <View style={[
                  styles.monitorJackHole,
                  monitorOut && { borderColor: palette.ice, backgroundColor: 'rgba(0, 229, 255, 0.10)' },
                ]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.settingDesc}>
              Patch in Dummy Cable to lurk anonymously.
            </Text>
          </HardwareCard>

          {/* ═══ SOCIAL BATTERY ════════════════════════════ */}
          <HardwareCard>
            <View style={styles.settingLeft}>
              <Ionicons name="flash-outline" size={16} color={palette.orange} />
              <Text style={styles.settingLabel}>SOCIAL BATTERY</Text>
            </View>
            <TouchableOpacity onPress={cycleSocialBattery} activeOpacity={0.7}>
              <View style={styles.sliderTrack}>
                <View style={[
                  styles.sliderFill,
                  {
                    width: socialBattery === 'low' ? '15%' : socialBattery === 'unity' ? '50%' : '85%',
                  },
                ]} />
                <View style={[
                  styles.sliderThumb,
                  {
                    left: socialBattery === 'low' ? '15%' : socialBattery === 'unity' ? '50%' : '85%',
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
          <HardwareCard>
            <View style={styles.settingLeft}>
              <Ionicons name="volume-mute-outline" size={16} color={palette.silver} />
              <Text style={styles.settingLabel}>NOISE GATE</Text>
            </View>
            <TouchableOpacity onPress={cycleNoiseGate} activeOpacity={0.7}>
              <View style={styles.sliderTrack}>
                <View style={[
                  styles.sliderFill,
                  {
                    width: noiseGate === 'open' ? '15%' : noiseGate === 'gate' ? '50%' : '85%',
                  },
                ]} />
                <View style={[
                  styles.sliderThumb,
                  {
                    left: noiseGate === 'open' ? '15%' : noiseGate === 'gate' ? '50%' : '85%',
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
          <HardwareCard>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Ionicons name="play-outline" size={16} color={palette.silver} />
                <Text style={styles.settingLabel}>WALK-ON TRANSIENT</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.dropdown} onPress={cycleWalkOn} activeOpacity={0.7}>
              <Text style={styles.dropdownText}>{walkOnTransient}</Text>
              <Ionicons name="chevron-down" size={14} color={palette.slate} />
            </TouchableOpacity>
          </HardwareCard>

          {/* ═══ PATCH CABLES (Services) ══════════════════ */}
          <Text style={styles.sectionLabel}>PATCH CABLES</Text>
          <View style={styles.servicesPanel}>
            <ServiceJack
              name="Spotify"
              connected={!!user?.connectedServices?.spotify?.connected}
              username={user?.connectedServices?.spotify?.username}
              serviceKey="spotify"
              onConnect={() => handleConnectService('Spotify')}
            />
            <ServiceJack
              name="Apple Music"
              connected={!!user?.connectedServices?.appleMusic?.connected}
              serviceKey="apple-music"
              onConnect={() => handleConnectService('Apple Music')}
            />
            <ServiceJack
              name="SoundCloud"
              connected={!!user?.connectedServices?.soundcloud?.connected}
              username={user?.connectedServices?.soundcloud?.username}
              serviceKey="soundcloud"
              onConnect={() => handleConnectService('SoundCloud')}
            />
            <ServiceJack
              name="Last.fm"
              connected={!!user?.connectedServices?.lastfm?.connected}
              username={user?.connectedServices?.lastfm?.username}
              serviceKey="lastfm"
              onConnect={() => handleConnectService('Last.fm')}
            />
          </View>

          {/* ═══ LEGAL ═══════════════════════════════════ */}
          <Text style={styles.sectionLabel}>CONFIGURATION</Text>
          <View style={styles.legalPanel}>
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

          {/* ═══ DISCONNECT ══════════════════════════════ */}
          <TouchableOpacity
            style={styles.disconnectBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.disconnectText}>DISCONNECT</Text>
          </TouchableOpacity>

          {/* ═══ DELETE ACCOUNT ═══════════════════════════ */}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
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
    borderRadius: 28,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontFamily: 'ChakraPetch-Bold',
    fontSize: 28,
    color: palette.frost,
    marginBottom: 2,
  },
  email: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.slate,
    letterSpacing: 0.5,
    marginBottom: spacing.xl,
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
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.frost,
    letterSpacing: 1.5,
  },
  settingDesc: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 12,
    color: palette.slate,
    lineHeight: 18,
  },

  // Toggle switch
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.steel,
    padding: 2,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  toggleActive: {
    backgroundColor: palette.ice,
    borderColor: palette.ice,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.slate,
  },
  toggleKnobActive: {
    backgroundColor: palette.frost,
    alignSelf: 'flex-end',
  },

  // Monitor jack
  monitorJack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.midnight,
    borderWidth: 2,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monitorJackHole: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: palette.slate,
    backgroundColor: 'transparent',
  },

  // Slider
  sliderTrack: {
    height: 4,
    backgroundColor: palette.steel,
    borderRadius: 2,
    marginTop: 12,
    marginBottom: 8,
    position: 'relative',
  },
  sliderFill: {
    height: 4,
    backgroundColor: palette.chromeBorder,
    borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: palette.silver,
    marginLeft: -8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
    letterSpacing: 1,
  },
  sliderLabelCenter: {
    fontFamily: 'SpaceMono-Regular',
    fontWeight: '700',
  },
  sliderLabelActive: {
    color: palette.frost,
    fontWeight: '700',
  },

  // Dropdown
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.steel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },
  dropdownText: {
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 14,
    color: palette.frost,
  },

  // Section labels
  sectionLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.slate,
    letterSpacing: 2,
    marginTop: spacing.lg,
    marginBottom: 10,
  },

  // Services panel
  servicesPanel: {
    backgroundColor: palette.midnight,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    marginBottom: 4,
  },

  // Legal panel
  legalPanel: {
    backgroundColor: palette.midnight,
    borderRadius: 12,
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
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 13,
    color: palette.frost,
  },
  legalValue: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
    letterSpacing: 1,
  },

  // Action buttons
  disconnectBtn: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  disconnectText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: palette.silver,
    letterSpacing: 2,
  },
  deleteBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 24,
    opacity: 0.6,
  },
  deleteText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.red,
    letterSpacing: 1,
  },
  buildTag: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.slate,
    textAlign: 'center',
    marginTop: spacing.lg,
    opacity: 0.3,
    letterSpacing: 2,
  },
});

export default ProfileScreen;
