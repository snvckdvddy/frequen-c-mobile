/**
 * Profile Screen — Rack Panel Identity
 *
 * Your signal identity within Frequen-C.
 * Rack-mount layout: header strip → voltage meter → stat modules →
 * service jacks → preferences → disconnect
 *
 * Zero emoji. Chrome borders. Monochrome stats.
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, Image, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, SafeScreen, VoltageMeter, EmptyState, ErrorState, RoomCardSkeleton } from '../components/ui';
import { ServiceIcon } from '../components/icons/ServiceIcon';
import { useAuth } from '../contexts/AuthContext';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { sessionApi, authApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Session } from '../types';

// ─── Helpers ──────────────────────────────────────────────────

function formatListenTime(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ─── Rack Module (Stat Card) ─────────────────────────────────

function RackModule({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={rackStyles.module}>
      <Text variant="h2" color={colors.text.primary}>
        {value}
      </Text>
      <Text variant="labelSmall" color={colors.chrome.text} style={rackStyles.label}>
        {label}
      </Text>
    </View>
  );
}

const rackStyles = StyleSheet.create({
  module: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    alignItems: 'center',
  },
  label: {
    marginTop: 4,
    fontSize: 8,
    letterSpacing: 1.5,
  },
});

// ─── Section Strip ──────────────────────────────────────────

function SectionStrip({ label }: { label: string }) {
  return (
    <View style={stripStyles.container}>
      <View style={stripStyles.line} />
      <Text variant="labelSmall" color={colors.chrome.text} style={stripStyles.text}>
        {label}
      </Text>
      <View style={stripStyles.line} />
    </View>
  );
}

const stripStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    gap: 10,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.chrome.border,
  },
  text: {
    fontSize: 9,
    letterSpacing: 2,
  },
});

// ─── Service Jack Row ────────────────────────────────────────

function ServiceJack({
  name, connected, username, serviceKey, onConnect,
}: {
  name: string;
  connected: boolean;
  username?: string;
  serviceKey: string;
  onConnect: () => void;
}) {
  return (
    <View style={jackStyles.row}>
      <View style={jackStyles.left}>
        <View style={[jackStyles.jack, connected && jackStyles.jackActive]}>
          <ServiceIcon service={serviceKey} size={20} connected={connected} />
        </View>
        <View>
          <Text variant="label" color={colors.text.primary} style={{ fontSize: 12 }}>
            {name}
          </Text>
          <Text variant="labelSmall" color={connected ? colors.text.secondary : colors.text.muted} style={{ fontSize: 10 }}>
            {connected ? (username ? `@${username}` : 'Patched') : 'Unpatched'}
          </Text>
        </View>
      </View>
      {!connected ? (
        <TouchableOpacity onPress={onConnect} style={jackStyles.connectBtn} accessibilityRole="button" accessibilityLabel={`Connect ${name}`}>
          <Text variant="labelSmall" color={colors.action.primary} style={{ fontSize: 9, letterSpacing: 1 }}>
            PATCH
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={jackStyles.activeDot} />
      )}
    </View>
  );
}

const jackStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
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
    backgroundColor: colors.chrome.surface,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jackActive: {
    borderColor: colors.action.primary,
    backgroundColor: colors.highlight.iceFaint,
  },
  connectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    backgroundColor: colors.chrome.surface,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.action.primary,
  },
});

// ─── Recent Session Card ────────────────────────────────────

function SessionHistoryCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const listenerCount = session.listeners?.length || 0;
  return (
    <TouchableOpacity style={histStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={histStyles.header}>
        <Text variant="label" color={colors.text.primary} numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>
          {session.name}
        </Text>
        {session.isLive && <View style={histStyles.liveDot} />}
      </View>
      <Text variant="labelSmall" color={colors.text.muted} style={{ fontSize: 10 }}>
        {listenerCount} connected · {session.genre || 'Mixed'}
      </Text>
    </TouchableOpacity>
  );
}

const histStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.action.primary,
  },
});

// ─── Main Screen ─────────────────────────────────────────────

interface ProfileScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

export function ProfileScreen({ onOpenRoom }: ProfileScreenProps) {
  const { user, logout, deleteAccount, connectSpotify, connectLastfm } = useAuth();
  const { favorites, removeFavorite } = useFavoritesContext();
  const [recentRooms, setRecentRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noiseGate, setNoiseGate] = useState<'off' | 'low' | 'medium' | 'high'>(
    user?.noiseGate || 'medium'
  );

  const fetchRecentRooms = useCallback(async () => {
    try {
      setError(null);
      const { sessions } = await sessionApi.myRooms();
      setRecentRooms(sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recent rooms';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentRooms();
  }, [fetchRecentRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecentRooms();
    setRefreshing(false);
  }, [fetchRecentRooms]);

  const stats = useMemo(() => ({
    sessionsHosted: user?.sessionsHosted || 0,
    tracksAdded: user?.tracksAdded || 0,
    totalListeningTime: formatListenTime(user?.totalListeningTime),
    voltageBalance: user?.voltageBalance || 0,
  }), [user]);

  // Deterministic avatar hue from username
  const avatarHue = useMemo(() => {
    const name = user?.username || '?';
    return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  }, [user?.username]);
  const avatarBg = `hsl(${avatarHue}, 15%, 18%)`;

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
            // Double confirm — this is irreversible
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

  const noiseGateLabels: Record<string, string> = {
    off: 'OFF', low: 'LOW', medium: 'MEDIUM', high: 'HIGH',
  };

  const handleNoiseGateChange = useCallback(() => {
    const levels: Array<'off' | 'low' | 'medium' | 'high'> = ['off', 'low', 'medium', 'high'];
    const labels = ['Off — No notifications', 'Low — Critical only', 'Medium — Default', 'High — Everything', 'Cancel'];

    Alert.alert(
      'Noise Gate',
      'Set your notification threshold',
      [
        ...levels.map((level, i) => ({
          text: labels[i],
          onPress: () => {
            setNoiseGate(level);
            authApi.setNoiseGate(level).catch(console.error);
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }, []);

  const handleConnectService = (service: string) => {
    if (service === 'Spotify') {
      if (!process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID) {
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
      if (!process.env.EXPO_PUBLIC_LASTFM_API_KEY) {
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

  // Show loading state with skeletons
  if (isLoading) {
    return (
      <SafeScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action.primary} />
          }
        >
          <SectionStrip label="RECENT SIGNALS" />
          <RoomCardSkeleton />
          <RoomCardSkeleton />
          <RoomCardSkeleton />
        </ScrollView>
      </SafeScreen>
    );
  }

  // Show error state with retry
  if (error) {
    return (
      <SafeScreen>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action.primary} />
          }
        >
          <ErrorState message={error} onRetry={fetchRecentRooms} />
        </ScrollView>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action.primary} />
        }
      >
        {/* ─── Identity Header ─────────────────────────── */}
        <View style={styles.identityHeader}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text variant="displayLarge" color={colors.text.primary} style={{ fontWeight: '200' }}>
              {(user?.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityInfo}>
            <Text variant="h2" color={colors.text.primary}>
              {user?.username || 'Anonymous'}
            </Text>
            <Text variant="bodySmall" color={colors.text.muted} style={{ fontSize: 11 }}>
              {user?.email || ''}
            </Text>
            {user?.connectedServices?.spotify?.connected && (
              <Text variant="labelSmall" color={colors.chrome.text} style={{ marginTop: 2, fontSize: 9, letterSpacing: 1 }}>
                SPOTIFY: @{user.connectedServices.spotify.username || 'connected'}
              </Text>
            )}
          </View>
        </View>

        {/* ─── Voltage Meter ──────────────────────────── */}
        <View style={styles.voltageSection}>
          <VoltageMeter balance={stats.voltageBalance} max={200} variant="full" />
        </View>

        {/* ─── Rack Modules (Stats) ──────────────────── */}
        <SectionStrip label="SIGNAL STATS" />
        <View style={styles.statsRow}>
          <RackModule label="SESSIONS" value={stats.sessionsHosted} />
          <RackModule label="TRACKS" value={stats.tracksAdded} />
          <RackModule label="LISTEN TIME" value={stats.totalListeningTime} />
        </View>

        {/* ─── Saved Tracks ──────────────────────────── */}
        {favorites.length > 0 && (
          <>
            <SectionStrip label={`LIKED TRACKS (${favorites.length})`} />
            {favorites.slice(0, 8).map(({ track }) => (
              <View key={track.id} style={styles.favoriteRow}>
                {track.albumArt ? (
                  <Image source={{ uri: track.albumArt }} style={styles.favoriteArt} />
                ) : (
                  <View style={[styles.favoriteArt, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text variant="labelSmall" color={colors.text.muted}>
                      {track.artist.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text variant="label" color={colors.text.primary} numberOfLines={1} style={{ fontSize: 12 }}>
                    {track.title}
                  </Text>
                  <Text variant="labelSmall" color={colors.text.muted} numberOfLines={1} style={{ fontSize: 10 }}>
                    {track.artist}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert('Remove?', `Remove "${track.title}" from saved?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeFavorite(track.id) },
                    ]);
                  }}
                >
                  <Ionicons name="close" size={14} color={colors.text.muted} />
                </TouchableOpacity>
              </View>
            ))}
            {favorites.length > 8 && (
              <Text variant="labelSmall" color={colors.text.muted} style={{ marginTop: 4, fontSize: 9 }}>
                +{favorites.length - 8} more
              </Text>
            )}
          </>
        )}

        {/* ─── Recent Sessions ───────────────────────── */}
        <SectionStrip label="RECENT SIGNALS" />
        {recentRooms.length > 0 ? (
          <>
            {recentRooms.map((room) => (
              <SessionHistoryCard
                key={room.id}
                session={room}
                onPress={() => onOpenRoom?.(room.id)}
              />
            ))}
          </>
        ) : (
          <EmptyState
            icon="radio-outline"
            title="No recent rooms"
            subtitle="Join or create a session to get started"
          />
        )}

        {/* ─── Service Jacks ─────────────────────────── */}
        <SectionStrip label="PATCH CABLES" />
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
            name="YouTube Music"
            connected={!!user?.connectedServices?.youtube?.connected}
            serviceKey="youtube-music"
            onConnect={() => handleConnectService('YouTube Music')}
          />
          <ServiceJack
            name="Tidal"
            connected={!!user?.connectedServices?.tidal?.connected}
            serviceKey="tidal"
            onConnect={() => handleConnectService('Tidal')}
          />
          <ServiceJack
            name="Last.fm"
            connected={!!user?.connectedServices?.lastfm?.connected}
            username={user?.connectedServices?.lastfm?.username}
            serviceKey="lastfm"
            onConnect={() => handleConnectService('Last.fm')}
          />
        </View>

        {/* ─── Preferences ────────────────────────────── */}
        <SectionStrip label="CONFIGURATION" />
        <View style={styles.prefsPanel}>
          <TouchableOpacity style={styles.prefRow} onPress={handleNoiseGateChange}>
            <Text variant="label" color={colors.text.primary} style={{ fontSize: 12 }}>Noise Gate</Text>
            <Text variant="labelSmall" color={colors.chrome.text} style={{ fontSize: 9, letterSpacing: 1 }}>
              {noiseGateLabels[noiseGate] || 'MEDIUM'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.prefRow}>
            <Text variant="label" color={colors.text.primary} style={{ fontSize: 12 }}>Default Waveform</Text>
            <Text variant="labelSmall" color={colors.chrome.text} style={{ fontSize: 9, letterSpacing: 1 }}>SINE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.prefRow}
            onPress={() => Linking.openURL('https://snvckdvddy.github.io/frequen-c-landing/privacy.html').catch(() =>
              Alert.alert('Error', 'Could not open Privacy Policy')
            )}
          >
            <Text variant="label" color={colors.text.primary} style={{ fontSize: 12 }}>Privacy Policy</Text>
            <Ionicons name="open-outline" size={12} color={colors.chrome.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.prefRow}
            onPress={() => Linking.openURL('https://snvckdvddy.github.io/frequen-c-landing/terms.html').catch(() =>
              Alert.alert('Error', 'Could not open Terms of Service')
            )}
          >
            <Text variant="label" color={colors.text.primary} style={{ fontSize: 12 }}>Terms of Service</Text>
            <Ionicons name="open-outline" size={12} color={colors.chrome.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.prefRow, { borderBottomWidth: 0 }]}>
            <Text variant="label" color={colors.text.primary} style={{ fontSize: 12 }}>About</Text>
            <Text variant="labelSmall" color={colors.chrome.text} style={{ fontSize: 9, letterSpacing: 1 }}>v1.0.0-alpha</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Disconnect ─────────────────────────────── */}
        <Button
          title="Disconnect"
          onPress={handleLogout}
          variant="ghost"
          size="md"
          style={styles.disconnectBtn}
        />

        {/* ─── Delete Account ────────────────────────── */}
        <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteAccountBtn}>
          <Text variant="labelSmall" color="#FF4444" align="center" style={{ fontSize: 11, letterSpacing: 1 }}>
            DELETE ACCOUNT
          </Text>
        </TouchableOpacity>

        {/* Build tag */}
        <Text variant="labelSmall" color={colors.text.muted} align="center" style={styles.buildTag}>
          FREQUEN-C · DESN 374-040
        </Text>
      </ScrollView>
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

  // Identity header
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityInfo: {
    flex: 1,
  },

  // Voltage
  voltageSection: {
    marginBottom: spacing.sm,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  // Favorites
  favoriteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
  },
  favoriteArt: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: colors.bg.elevated,
    marginRight: 10,
  },

  // Services panel
  servicesPanel: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },

  // Preferences
  prefsPanel: {
    backgroundColor: colors.bg.elevated,
    borderRadius: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
  },

  // Footer
  disconnectBtn: {
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
  deleteAccountBtn: {
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    opacity: 0.6,
  },
  buildTag: {
    marginTop: spacing.lg,
    opacity: 0.3,
    letterSpacing: 2,
    fontSize: 9,
  },
});

export default ProfileScreen;
