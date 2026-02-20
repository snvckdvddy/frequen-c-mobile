/**
 * Profile Screen
 *
 * Your identity within Frequen-C.
 * Shows listening stats, contribution history, connected services,
 * and recent room activity.
 *
 * SoundCloud-inspired: monochrome stats, no emoji, quiet chrome.
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, FlatList, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, SafeScreen } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Session, RoomMode, Track } from '../types';

// ─── Helpers ───────────────────────────────────────────────

/** Format minutes into human-readable string: "72h 0m" or "0m" */
function formatListenTime(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Room mode label (text only) */
const modeLabel: Record<string, string> = {
  campfire: 'Campfire',
  spotlight: 'Spotlight',
  openFloor: 'Open Floor',
};

// ─── Stat Card ──────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={statStyles.card}>
      <Text variant="h2" color={colors.text.primary}>
        {value}
      </Text>
      <Text variant="labelSmall" color={colors.text.muted} style={statStyles.label}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
  },
  label: {
    marginTop: spacing.xs,
  },
});

// ─── Section Header ─────────────────────────────────────────

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={sectionStyles.headerRow}>
      <Text variant="h3" color={colors.text.primary}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
});

// ─── Connected Service Row ───────────────────────────────────

function ServiceRow({
  name,
  connected,
  username,
  iconName,
  onConnect,
}: {
  name: string;
  connected: boolean;
  username?: string;
  iconName: string;
  onConnect: () => void;
}) {
  return (
    <View style={serviceStyles.row}>
      <View style={serviceStyles.left}>
        <Ionicons
          name={iconName as any}
          size={18}
          color={connected ? colors.text.primary : colors.text.muted}
        />
        <View>
          <Text variant="label" color={colors.text.primary}>{name}</Text>
          <Text variant="labelSmall" color={connected ? colors.text.secondary : colors.text.muted}>
            {connected ? (username ? `@${username}` : 'Connected') : 'Not connected'}
          </Text>
        </View>
      </View>
      {!connected ? (
        <TouchableOpacity onPress={onConnect}>
          <Text variant="labelSmall" color={colors.action.primary}>CONNECT</Text>
        </TouchableOpacity>
      ) : (
        <View style={serviceStyles.connectedDot} />
      )}
    </View>
  );
}

const serviceStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.action.primary,
  },
});

// ─── Recent Room Card ──────────────────────────────────────

function RecentRoomCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const mode = modeLabel[session.roomMode] || 'Campfire';
  const listenerCount = session.listeners?.length || 0;

  return (
    <TouchableOpacity style={roomCardStyles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={roomCardStyles.body}>
        <View style={roomCardStyles.header}>
          <Text variant="label" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
            {session.name}
          </Text>
          {session.isLive && (
            <View style={roomCardStyles.liveDot} />
          )}
        </View>
        <Text variant="labelSmall" color={colors.text.muted}>
          {mode} · {listenerCount} listening · {session.genre || 'Mixed'}
        </Text>
        {session.currentTrack && (
          <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1} style={{ marginTop: 2 }}>
            {session.currentTrack.title} — {session.currentTrack.artist}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const roomCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  body: { padding: spacing.cardPadding, gap: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.action.primary,
  },
});

// ─── Main Screen ─────────────────────────────────────────────

interface ProfileScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

export function ProfileScreen({ onOpenRoom }: ProfileScreenProps) {
  const { user, logout } = useAuth();
  const { favorites, removeFavorite } = useFavoritesContext();
  const [recentRooms, setRecentRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRecentRooms = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      setRecentRooms(sessions);
    } catch {
      // silent — empty state is fine
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

  // Formatted stats
  const stats = useMemo(() => ({
    sessionsHosted: user?.sessionsHosted || 0,
    tracksAdded: user?.tracksAdded || 0,
    totalListeningTime: formatListenTime(user?.totalListeningTime),
    voltageBalance: user?.voltageBalance || 0,
  }), [user]);

  // Deterministic avatar color from username — desaturated
  const avatarHue = useMemo(() => {
    const name = user?.username || '?';
    return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  }, [user?.username]);
  const avatarBg = `hsl(${avatarHue}, 20%, 20%)`;

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to leave?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const handleConnectService = (service: string) => {
    Alert.alert('Coming Soon', `${service} integration is coming in a future update.`);
  };

  return (
    <SafeScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.action.primary} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text variant="displayLarge" color={colors.text.primary}>
              {(user?.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text variant="h1" color={colors.text.primary} style={styles.username}>
            {user?.username || 'Anonymous'}
          </Text>
          <Text variant="body" color={colors.text.secondary}>
            {user?.email || ''}
          </Text>
          {user?.connectedServices?.spotify?.connected && (
            <Text variant="labelSmall" color={colors.text.muted} style={styles.spotifyLabel}>
              Spotify: @{user.connectedServices.spotify.username || 'connected'}
            </Text>
          )}
        </View>

        {/* Stats Grid */}
        <SectionHeader title="Stats" />
        <View style={styles.statsRow}>
          <StatCard label="Rooms Hosted" value={stats.sessionsHosted} />
          <StatCard label="Tracks Added" value={stats.tracksAdded} />
        </View>
        <View style={[styles.statsRow, { marginTop: spacing.md }]}>
          <StatCard label="Listen Time" value={stats.totalListeningTime} />
          <StatCard label="Voltage" value={stats.voltageBalance} />
        </View>

        {/* Saved Tracks (Favorites) */}
        {favorites.length > 0 && (
          <>
            <SectionHeader
              title={`Saved Tracks (${favorites.length})`}
              right={
                <Text variant="labelSmall" color={colors.text.muted}>
                  {favorites.length} saved
                </Text>
              }
            />
            {favorites.slice(0, 10).map(({ track }) => (
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
                  <Text variant="label" color={colors.text.primary} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text variant="labelSmall" color={colors.text.muted} numberOfLines={1}>
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
                  <Text variant="labelSmall" color={colors.text.muted}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            {favorites.length > 10 && (
              <Text variant="labelSmall" color={colors.text.muted} style={{ marginTop: spacing.xs }}>
                +{favorites.length - 10} more
              </Text>
            )}
          </>
        )}

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <>
            <SectionHeader title="Recent Rooms" />
            {recentRooms.map((room) => (
              <RecentRoomCard
                key={room.id}
                session={room}
                onPress={() => onOpenRoom?.(room.id)}
              />
            ))}
          </>
        )}

        {/* Connected Services */}
        <SectionHeader title="Connected Services" />
        <View style={styles.servicesContainer}>
          <ServiceRow
            name="Spotify"
            connected={!!user?.connectedServices?.spotify?.connected}
            username={user?.connectedServices?.spotify?.username}
            iconName="musical-notes-outline"
            onConnect={() => handleConnectService('Spotify')}
          />
          <ServiceRow
            name="Apple Music"
            connected={!!user?.connectedServices?.appleMusic?.connected}
            iconName="musical-note-outline"
            onConnect={() => handleConnectService('Apple Music')}
          />
          <ServiceRow
            name="SoundCloud"
            connected={!!user?.connectedServices?.soundcloud?.connected}
            username={user?.connectedServices?.soundcloud?.username}
            iconName="cloud-outline"
            onConnect={() => handleConnectService('SoundCloud')}
          />
          <ServiceRow
            name="YouTube Music"
            connected={!!user?.connectedServices?.youtube?.connected}
            iconName="play-outline"
            onConnect={() => handleConnectService('YouTube Music')}
          />
          <ServiceRow
            name="Tidal"
            connected={!!user?.connectedServices?.tidal?.connected}
            iconName="water-outline"
            onConnect={() => handleConnectService('Tidal')}
          />
        </View>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View style={styles.prefsContainer}>
          <TouchableOpacity style={styles.prefRow}>
            <Text variant="label" color={colors.text.primary}>Notification Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.prefRow}>
            <Text variant="label" color={colors.text.primary}>Default Room Mode</Text>
            <Text variant="labelSmall" color={colors.text.muted}>Campfire</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.prefRow}>
            <Text variant="label" color={colors.text.primary}>Privacy</Text>
            <Text variant="labelSmall" color={colors.text.muted}>Public profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.prefRow, { borderBottomWidth: 0 }]}>
            <Text variant="label" color={colors.text.primary}>About Frequen-C</Text>
            <Text variant="labelSmall" color={colors.text.muted}>v1.0.0-alpha</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="ghost"
          size="md"
          style={styles.logoutBtn}
        />

        {/* Build tag */}
        <Text variant="labelSmall" color={colors.text.muted} align="center" style={styles.buildTag}>
          FREQUEN-C · DESN 374-040
        </Text>
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['3xl'],
  },

  // Profile header
  profileHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  username: {
    marginBottom: spacing.xs,
  },
  spotifyLabel: {
    marginTop: spacing.sm,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  // Favorites
  favoriteRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  favoriteArt: {
    width: 40,
    height: 40,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.elevated,
    marginRight: spacing.sm,
  },

  // Services
  servicesContainer: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },

  // Preferences
  prefsContainer: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },

  // Footer
  logoutBtn: {
    alignSelf: 'center',
    marginTop: spacing.xl,
  },
  buildTag: {
    marginTop: spacing.xl,
    opacity: 0.4,
  },
});

export default ProfileScreen;
