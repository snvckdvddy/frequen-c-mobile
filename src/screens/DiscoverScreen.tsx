/**
 * Discover Screen — Browse live rooms.
 *
 * Sprint 2: Wired to convergence strategy components.
 * Uses RoomCard (§4.2) for all room entries.
 * Uses RoomModeBadge (§3.1) in filter context.
 * SoundCloud-inspired: content-forward, restrained chrome, one accent.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, ScrollView, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, RoomCard, ErrorState } from '../components/ui';
import { AnimatedPressable } from '../components/ui/AnimatedPressable';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Session, RoomMode } from '../types';

// ─── Props ──────────────────────────────────────────────────

interface DiscoverScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────

/** Activity score — higher = hotter. Combines listener count + recency. */
function activityScore(session: Session): number {
  const listeners = session.listeners?.length || 0;
  const ageMinutes = (Date.now() - new Date(session.createdAt).getTime()) / 60_000;
  const recencyBoost = Math.max(0, 1 - ageMinutes / 360);
  return listeners * 2 + recencyBoost * 5 + (session.currentTrack?.votes || 0) * 0.5;
}

/** Relative time — "2m ago", "1h ago", "just now" */
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Activity Feed ──────────────────────────────────────────

interface ActivityItem {
  id: string;
  text: string;
  roomName: string;
  sessionId: string;
  time: string;
  type: 'started' | 'joined';
}

function buildActivityFeed(sessions: Session[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const s of sessions) {
    items.push({
      id: `start_${s.id}`,
      text: `${s.hostUsername} started`,
      roomName: s.name,
      sessionId: s.id,
      time: relativeTime(s.createdAt),
      type: 'started',
    });
    const lastListener = s.listeners?.at(-1);
    if (lastListener) {
      items.push({
        id: `join_${s.id}_${lastListener.username}`,
        text: `${lastListener.username} joined`,
        roomName: s.name,
        sessionId: s.id,
        time: relativeTime(s.createdAt),
        type: 'joined',
      });
    }
  }
  return items.slice(0, 8);
}

function ActivityFeedRow({ item, onPress }: { item: ActivityItem; onPress: () => void }) {
  return (
    <AnimatedPressable style={activityStyles.row} onPress={onPress} scaleDown={0.98}>
      <View style={activityStyles.dot} />
      <View style={{ flex: 1 }}>
        <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
          {item.text}{' '}
          <Text variant="label" color={colors.text.primary}>{item.roomName}</Text>
        </Text>
      </View>
      <Text variant="labelSmall" color={colors.text.muted}>{item.time}</Text>
    </AnimatedPressable>
  );
}

const activityStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: spacing.cardPadding,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.muted,
  },
});

// ─── Filter Chips ───────────────────────────────────────────

const FILTERS = ['All', 'Campfire', 'Spotlight', 'Open Floor'] as const;
type FilterType = (typeof FILTERS)[number];

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[
        filterStyles.chip,
        active && { backgroundColor: colors.highlight.iceSubtle, borderColor: colors.action.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Filter by ${label}${active ? ', selected' : ''}`}
      accessibilityState={{ selected: active }}
    >
      <Text variant="labelSmall" color={active ? colors.action.primary : colors.text.muted}>
        {label.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

const filterStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginRight: spacing.sm,
  },
});

// ─── Section Header ─────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={sectionStyles.header}>
      <Text variant="h3" color={colors.text.primary}>{title}</Text>
      {subtitle && <Text variant="labelSmall" color={colors.text.muted}>{subtitle}</Text>}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
});

// ─── Session → RoomCard adapter ─────────────────────────────

/** Maps a Session object to RoomCard props */
function sessionToRoomCardProps(
  session: Session,
  onOpenRoom: (sessionId: string) => void,
) {
  return {
    roomName: session.name,
    hostUsername: session.hostUsername,
    roomMode: (session.roomMode || 'campfire') as RoomMode,
    isLive: session.isLive ?? true,
    listenerCount: session.listeners?.length || 0,
    genre: session.genre,
    currentTrack: session.currentTrack
      ? {
          title: session.currentTrack.title,
          artist: session.currentTrack.artist,
          albumArt: session.currentTrack.albumArt,
        }
      : undefined,
    onJoin: () => onOpenRoom(session.id),
    onPress: () => onOpenRoom(session.id),
  };
}

// ─── Main Screen ────────────────────────────────────────────

export function DiscoverScreen({ onOpenRoom }: DiscoverScreenProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [activeGenre, setActiveGenre] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      const { sessions: list } = await sessionApi.discover();
      setSessions(list || []);
      setError(null);
    } catch (err) {
      setSessions([]);
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchSessions().finally(() => setLoading(false));
  }, [fetchSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  }, [fetchSessions]);

  // ─── Derived data ──────────────────────────────────────
  const liveSessions = useMemo(
    () => sessions.filter((s) => s.isLive && s.isPublic),
    [sessions],
  );

  const availableGenres = useMemo(() => {
    const genres = new Set<string>();
    for (const s of liveSessions) {
      if (s.genre && s.genre !== 'Mixed') genres.add(s.genre);
    }
    return ['All', ...Array.from(genres).sort()];
  }, [liveSessions]);

  const filteredSessions = useMemo(() => {
    let list = liveSessions;

    if (activeFilter === 'Campfire') list = list.filter((s) => s.roomMode === 'campfire');
    else if (activeFilter === 'Spotlight') list = list.filter((s) => s.roomMode === 'spotlight');
    else if (activeFilter === 'Open Floor') list = list.filter((s) => s.roomMode === 'openFloor');

    if (activeGenre !== 'All') list = list.filter((s) => s.genre === activeGenre);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description || '').toLowerCase().includes(q) ||
          (s.genre || '').toLowerCase().includes(q) ||
          s.hostUsername.toLowerCase().includes(q) ||
          (s.currentTrack?.artist || '').toLowerCase().includes(q),
      );
    }

    return list;
  }, [liveSessions, activeFilter, activeGenre, searchQuery]);

  // Hot rooms — top 3 by activity score
  const hotRooms = useMemo(
    () => [...filteredSessions].sort((a, b) => activityScore(b) - activityScore(a)).slice(0, 3),
    [filteredSessions],
  );

  // Activity feed
  const activityFeed = useMemo(() => buildActivityFeed(liveSessions), [liveSessions]);

  // Remaining rooms (not in top 3)
  const hotIds = useMemo(() => new Set(hotRooms.map((s) => s.id)), [hotRooms]);
  const remainingRooms = useMemo(
    () => filteredSessions.filter((s) => !hotIds.has(s.id)),
    [filteredSessions, hotIds],
  );

  const isSearchActive = searchQuery.trim().length > 0;

  const handleOpenRoom = useCallback(
    (sessionId: string) => {
      if (onOpenRoom) onOpenRoom(sessionId);
    },
    [onOpenRoom],
  );

  // ─── Loading state ─────────────────────────────────────
  if (loading) {
    return (
      <SafeScreen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.action.primary} />
          <Text variant="label" color={colors.text.muted} style={{ marginTop: spacing.md }}>
            Loading rooms...
          </Text>
        </View>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <FlatList
        data={isSearchActive ? filteredSessions : remainingRooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <RoomCard {...sessionToRoomCardProps(item, handleOpenRoom)} />
          </View>
        )}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.action.primary}
            colors={[colors.action.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* ─── Error State ─────────────────────────── */}
            {error && (
              <ErrorState variant="banner" message={error} onRetry={fetchSessions} />
            )}
            {/* ─── Header ──────────────────────────────── */}
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text variant="h1" color={colors.text.primary}>
                  Discover
                </Text>
                <Text variant="labelSmall" color={colors.text.muted}>
                  {liveSessions.length} live
                </Text>
              </View>
            </View>

            {/* ─── Search Bar ──────────────────────────── */}
            <View style={styles.searchRow}>
              <View style={styles.searchIcon}>
                <Ionicons name="search-outline" size={16} color={colors.text.muted} />
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Search rooms, genres, artists..."
                placeholderTextColor={colors.text.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => { setSearchQuery(''); Keyboard.dismiss(); }}
                  style={styles.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons name="close" size={16} color={colors.text.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* ─── Room Mode Filter ──────────────────── */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => (
                <FilterChip
                  key={f}
                  label={f}
                  active={activeFilter === f}
                  onPress={() => setActiveFilter(f)}
                />
              ))}
            </ScrollView>

            {/* ─── Genre Filter ─────────────────────────── */}
            {availableGenres.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
              >
                {availableGenres.map((g) => (
                  <FilterChip
                    key={g}
                    label={g}
                    active={activeGenre === g}
                    onPress={() => setActiveGenre(g)}
                  />
                ))}
              </ScrollView>
            )}

            {/* ─── Browse Mode (no search active) ──────── */}
            {!isSearchActive && (
              <View>
                {/* Trending — top 3 by activity score, horizontal scroll */}
                {hotRooms.length > 0 && (
                  <View>
                    <SectionHeader title="Trending" />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hotRow}
                    >
                      {hotRooms.map((s) => (
                        <View key={s.id} style={styles.hotCardWrapper}>
                          <RoomCard {...sessionToRoomCardProps(s, handleOpenRoom)} />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Activity Feed */}
                {activityFeed.length > 0 && (
                  <View>
                    <SectionHeader title="Activity" />
                    <View style={styles.activityCard}>
                      {activityFeed.slice(0, 5).map((item) => (
                        <ActivityFeedRow
                          key={item.id}
                          item={item}
                          onPress={() => handleOpenRoom(item.sessionId)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {/* All remaining rooms header */}
                {remainingRooms.length > 0 && (
                  <SectionHeader
                    title="More Rooms"
                    subtitle={`${remainingRooms.length} more`}
                  />
                )}

                {/* Empty state */}
                {filteredSessions.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text variant="body" color={colors.text.muted} align="center">
                      No rooms match this filter.{'\n'}Start one and set the vibe.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ─── Search Mode Header ─────────────────── */}
            {isSearchActive && (
              <View style={styles.searchResultsHeader}>
                <Text variant="label" color={colors.text.secondary}>
                  {filteredSessions.length} result{filteredSessions.length !== 1 ? 's' : ''} for "{searchQuery}"
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isSearchActive ? (
            <View style={styles.emptyState}>
              <Text variant="body" color={colors.text.muted} align="center">
                No rooms match "{searchQuery}".{'\n'}Try a different search.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeScreen>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.sm,
    backgroundColor: colors.bg.input,
    borderRadius: spacing.radius.md,
    overflow: 'hidden',
  },
  searchIcon: {
    paddingLeft: 12,
    paddingRight: 4,
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 8,
    color: colors.text.primary,
    fontSize: 14,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterRow: {
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xs,
  },
  hotRow: {
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  hotCardWrapper: {
    width: 300, // wider for horizontal scroll prominence
  },
  cardWrapper: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
  },
  activityCard: {
    marginHorizontal: spacing.screenPadding,
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  searchResultsHeader: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: 120, // clear mini-player + tab bar
  },
  emptyState: {
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.screenPadding,
  },
});

export default DiscoverScreen;
