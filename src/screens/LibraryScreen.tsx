/**
 * Library Screen — User's personal music & session history.
 *
 * Sprint 3: Fleshed out with real favorites data from FavoritesContext,
 * mock session history, and segmented tabs (Liked / History).
 *
 * Tab 4 of 4 in bottom nav.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Image,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, ADSRFadeIn, TrackListItem, ErrorState, TrackCardSkeleton } from '../components/ui';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Track, FavoriteTrack, Session, RoomMode } from '../types';

// ─── Segment Tabs ────────────────────────────────────────────

type Segment = 'liked' | 'history';

interface SegmentTabsProps {
  active: Segment;
  onChange: (s: Segment) => void;
}

function SegmentTabs({ active, onChange }: SegmentTabsProps) {
  return (
    <View style={segStyles.row}>
      <TouchableOpacity
        style={[segStyles.tab, active === 'liked' && segStyles.tabActive]}
        onPress={() => onChange('liked')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={active === 'liked' ? 'heart' : 'heart-outline'}
          size={16}
          color={active === 'liked' ? colors.action.primary : colors.text.muted}
        />
        <Text
          variant="label"
          color={active === 'liked' ? colors.action.primary : colors.text.muted}
          style={{ marginLeft: 6 }}
        >
          Liked
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[segStyles.tab, active === 'history' && segStyles.tabActive]}
        onPress={() => onChange('history')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={active === 'history' ? 'time' : 'time-outline'}
          size={16}
          color={active === 'history' ? colors.action.primary : colors.text.muted}
        />
        <Text
          variant="label"
          color={active === 'history' ? colors.action.primary : colors.text.muted}
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
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  tabActive: {
    borderColor: colors.action.primary,
    backgroundColor: colors.highlight.iceFaint,
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
}

const MOCK_HISTORY: PastSession[] = [
  { id: 'hist_1', name: 'Late Night Vibes', hostUsername: 'You', roomMode: 'campfire', tracksPlayed: 12, date: '2 hours ago' },
  { id: 'hist_2', name: 'Study Session', hostUsername: 'zara', roomMode: 'spotlight', tracksPlayed: 8, date: 'Yesterday' },
  { id: 'hist_3', name: 'Open Mic Friday', hostUsername: 'finn', roomMode: 'openFloor', tracksPlayed: 23, date: '3 days ago' },
];

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
    >
      <View style={histStyles.iconWrap}>
        <Ionicons name={modeIcons[session.roomMode]} size={20} color={colors.text.secondary} />
      </View>
      <View style={histStyles.info}>
        <Text variant="label" color={colors.text.primary} numberOfLines={1}>
          {session.name}
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
          {session.hostUsername} · {session.tracksPlayed} tracks
        </Text>
      </View>
      <Text variant="labelSmall" color={colors.text.muted}>{session.date}</Text>
    </TouchableOpacity>
  );
}

const histStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bg.surface,
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
  const [segment, setSegment] = useState<Segment>('liked');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      // Simulate network fetch
      await new Promise((r) => setTimeout(r, 600));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh library';
      setError(message);
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  // Sort favorites: most recently saved first
  const sortedFavorites = useMemo(
    () => [...favorites].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()),
    [favorites],
  );

  return (
    <SafeScreen>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h2" color={colors.text.primary}>Library</Text>
        {favorites.length > 0 && (
          <Text variant="labelSmall" color={colors.text.muted}>
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
            tintColor={colors.action.primary}
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
                <Ionicons name="heart-outline" size={48} color={colors.text.muted} />
                <Text variant="body" color={colors.text.secondary} align="center" style={{ marginTop: spacing.sm }}>
                  No liked tracks yet
                </Text>
                <Text variant="bodySmall" color={colors.text.muted} align="center" style={{ marginTop: spacing.xs }}>
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
                        >
                          <Ionicons name="heart" size={18} color={colors.action.primary} />
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
            ) : MOCK_HISTORY.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color={colors.text.muted} />
                <Text variant="body" color={colors.text.secondary} align="center" style={{ marginTop: spacing.sm }}>
                  No session history yet
                </Text>
                <Text variant="bodySmall" color={colors.text.muted} align="center" style={{ marginTop: spacing.xs }}>
                  Sessions you join will appear here
                </Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {MOCK_HISTORY.map((session, i) => (
                  <ADSRFadeIn index={i} staggerMs={60}>
                    <HistoryCard
                      session={session}
                      onPress={onOpenRoom ? () => onOpenRoom(session.id) : undefined}
                    />
                  </ADSRFadeIn>
                ))}
              </View>
            )}
          </ADSRFadeIn>
        )}
      </ScrollView>
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
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
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
