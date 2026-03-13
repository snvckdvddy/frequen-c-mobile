/**
 * Library Screen — User's personal music & session history.
 *
 * Sprint 3: Fleshed out with real favorites data from FavoritesContext,
 * mock session history, and segmented tabs (Liked / History).
 *
 * Tab 4 of 4 in bottom nav.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, ADSRFadeIn, TrackListItem, ErrorState, TrackCardSkeleton } from '../components/ui';
import { ArchiveSessionModal } from '../components/ArchiveSessionModal';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { sessionApi } from '../services/api';
import { VoidSurface } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { spacing } from '../theme/spacing';
import type { Track, FavoriteTrack, Session, RoomMode } from '../types';

// ─── Segment Tabs ────────────────────────────────────────────

type Segment = 'liked' | 'history';

interface SegmentTabsProps {
  active: Segment;
  onChange: (s: Segment) => void;
}

function SegmentTabs({ active, onChange }: SegmentTabsProps) {
  const { accent } = useTheme();
  return (
    <View style={segStyles.row}>
      <TouchableOpacity
        style={[segStyles.tab, active === 'liked' && [segStyles.tabActive, { borderColor: accent }]]}
        onPress={() => onChange('liked')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel="Liked tracks tab"
        accessibilityState={{ selected: active === 'liked' }}
      >
        <Ionicons
          name={active === 'liked' ? 'heart' : 'heart-outline'}
          size={16}
          color={active === 'liked' ? accent : palette.slate}
        />
        <Text
          variant="label"
          color={active === 'liked' ? accent : palette.slate}
          style={{ marginLeft: 6 }}
        >
          Liked
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[segStyles.tab, active === 'history' && [segStyles.tabActive, { borderColor: accent }]]}
        onPress={() => onChange('history')}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityLabel="Session history tab"
        accessibilityState={{ selected: active === 'history' }}
      >
        <Ionicons
          name={active === 'history' ? 'time' : 'time-outline'}
          size={16}
          color={active === 'history' ? accent : palette.slate}
        />
        <Text
          variant="label"
          color={active === 'history' ? accent : palette.slate}
          style={{ marginLeft: 6 }}
        >
          History
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  tabActive: {
    backgroundColor: colors.accentPrimarySubtle,
  },
});

// ─── Mock Session History ─────────────────────────────────────

interface PastSession {
  id: string;
  name: string;
  hostUsername: string;
  roomMode: RoomMode;
  tracksPlayed: number;
  date: string;
  session: Session;
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const modeIcons: Record<RoomMode, keyof typeof Ionicons.glyphMap> = {
  campfire: 'bonfire-outline',
  spotlight: 'flashlight-outline',
  openFloor: 'people-outline',
};

// ─── History Card ──────────────────────────────────────────────

function HistoryCard({ session, onPress }: { session: PastSession; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={histStyles.card}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.name} session, hosted by ${session.hostUsername}, ${session.tracksPlayed} tracks played`}
      accessibilityHint="Double tap to open this session"
    >
      <View style={histStyles.iconWrap}>
        <Ionicons name={modeIcons[session.roomMode]} size={20} color={palette.silver} />
      </View>
      <View style={histStyles.info}>
        <Text variant="label" color={palette.frost} numberOfLines={1}>
          {session.name}
        </Text>
        <Text variant="bodySmall" color={palette.silver} numberOfLines={1}>
          {session.hostUsername} · {session.tracksPlayed} tracks
        </Text>
      </View>
      <Text variant="labelSmall" color={palette.slate}>{session.date}</Text>
    </TouchableOpacity>
  );
}

const histStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: palette.midnight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
});

// ─── Main Component ───────────────────────────────────────────

interface LibraryScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

export function LibraryScreen({ onOpenRoom }: LibraryScreenProps) {
  const { favorites, removeFavorite, isLoaded } = useFavoritesContext();
  const { user } = useAuth();
  const { accent } = useTheme();
  const [segment, setSegment] = useState<Segment>('liked');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionHistory, setSessionHistory] = useState<PastSession[]>([]);
  const [archivePreview, setArchivePreview] = useState<Session | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      // Convert Session[] to PastSession[] — archived sessions only
      const history: PastSession[] = sessions
        .filter((s) => !s.isLive)
        .map((s) => ({
          id: s.id,
          name: s.name,
          hostUsername: s.hostId === user?.id ? 'You' : (s.hostUsername || 'Friend'),
          roomMode: s.roomMode,
          tracksPlayed: s.tracksPlayedCount ?? (s.queue.length + (s.currentTrack ? 1 : 0)),
          date: formatTimeAgo(s.endedAt || s.createdAt),
          session: s,
        }));
      setSessionHistory(history);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      setError(message);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory().then(() => setIsLoading(false));
  }, [fetchHistory]);

  // Sort favorites: most recently saved first
  const sortedFavorites = useMemo(
    () => [...favorites].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()),
    [favorites],
  );

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
        <Text variant="h2" color={palette.frost}>Library</Text>
        {favorites.length > 0 && (
          <Text variant="labelSmall" color={palette.slate}>
            {favorites.length} liked
          </Text>
        )}
      </View>

      {/* Segment Tabs */}
      <SegmentTabs active={segment} onChange={setSegment} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={accent}
          />
        }
      >
        {/* ─── Liked Tracks ─────────────────────────── */}
        {segment === 'liked' && (
          <ADSRFadeIn index={0}>
            {error && (
              <ErrorState
                message={error}
                onRetry={onRefresh}
              />
            )}
            {isLoading && !error ? (
              <View style={styles.trackList}>
                {[...Array(5)].map((_, i) => (
                  <TrackCardSkeleton key={`skeleton-${i}`} />
                ))}
              </View>
            ) : sortedFavorites.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={48} color={palette.slate} />
                <Text variant="body" color={palette.silver} align="center" style={{ marginTop: spacing.sm }}>
                  No liked tracks yet
                </Text>
                <Text variant="bodySmall" color={palette.slate} align="center" style={{ marginTop: spacing.xs }}>
                  Tap the heart on any track to save it here
                </Text>
              </View>
            ) : (
              <View style={styles.trackList}>
                {sortedFavorites.map((fav, i) => (
                  <ADSRFadeIn index={i} staggerMs={40}>
                    <TrackListItem
                      title={fav.track.title}
                      artist={fav.track.artist}
                      albumArt={fav.track.albumArt}
                      duration={fav.track.duration}
                      rightAction={
                        <TouchableOpacity
                          onPress={() => removeFavorite(fav.track.id)}
                          style={styles.removeBtn}
                          activeOpacity={0.6}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${fav.track.title} from liked tracks`}
                          accessibilityHint="Double tap to remove this track from your favorites"
                        >
                          <Ionicons name="heart" size={18} color={accent} />
                        </TouchableOpacity>
                      }
                    />
                  </ADSRFadeIn>
                ))}
              </View>
            )}
          </ADSRFadeIn>
        )}

        {/* ─── Session History ──────────────────────── */}
        {segment === 'history' && (
          <ADSRFadeIn index={0}>
            {error && (
              <ErrorState
                message={error}
                onRetry={onRefresh}
              />
            )}
            {isLoading && !error ? (
              <View style={styles.historyList}>
                {[...Array(5)].map((_, i) => (
                  <TrackCardSkeleton key={`skeleton-${i}`} />
                ))}
              </View>
            ) : sessionHistory.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color={palette.slate} />
                <Text variant="body" color={palette.silver} align="center" style={{ marginTop: spacing.sm }}>
                  No session history yet
                </Text>
                <Text variant="bodySmall" color={palette.slate} align="center" style={{ marginTop: spacing.xs }}>
                  Sessions you join will appear here
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {sessionHistory.map((session, i) => (
                  <ADSRFadeIn index={i} staggerMs={60}>
                    <HistoryCard
                      session={session}
                      onPress={() => setArchivePreview(session.session)}
                    />
                  </ADSRFadeIn>
                ))}
              </View>
            )}
          </ADSRFadeIn>
        )}
      </ScrollView>
      <ArchiveSessionModal
        session={archivePreview}
        onClose={() => setArchivePreview(null)}
      />
      </VoidSurface>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120, // clear mini-player + tab bar
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: palette.steel,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  trackList: {
    gap: 0,
  },
  historyList: {
    gap: 0,
  },
  removeBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default LibraryScreen;
