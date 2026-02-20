/**
 * Discover Screen — Browse live rooms
 *
 * SoundCloud-inspired: content-forward, restrained chrome, one accent.
 * No emoji, no colored badges, no rank numbers, no animated indicators.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, ScrollView, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, FadeIn } from '../components/ui';
import { AnimatedPressable } from '../components/ui/AnimatedPressable';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Session } from '../types';

// ─── Props ──────────────────────────────────────────────────

interface DiscoverScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

// ─── Room Mode Config (text only, monochrome) ───────────────

const modeLabel: Record<string, string> = {
  campfire: 'Campfire',
  spotlight: 'Spotlight',
  openFloor: 'Open Floor',
};

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

/** Deterministic color from string */
function hashColor(str: string): string {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  const hue = sum % 360;
  return `hsl(${hue}, 30%, 30%)`;
}

// ─── Listener Avatars (stacked circles) ─────────────────────

function ListenerAvatars({ listeners, max = 4 }: { listeners: { username: string }[]; max?: number }) {
  const shown = listeners.slice(0, max);
  const overflow = listeners.length - max;

  return (
    <View style={avatarStyles.row}>
      {shown.map((l, i) => {
        const bg = hashColor(l.username);
        return (
          <View key={l.username + i} style={[avatarStyles.circle, { marginLeft: i > 0 ? -8 : 0, backgroundColor: bg }]}>
            <Text variant="labelSmall" color={colors.text.primary} style={{ fontSize: 9 }}>
              {l.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        );
      })}
      {overflow > 0 && (
        <View style={[avatarStyles.circle, { marginLeft: -8, backgroundColor: colors.bg.input }]}>
          <Text variant="labelSmall" color={colors.text.muted} style={{ fontSize: 9 }}>
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.bg.elevated,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─── Hot Room Card (large, horizontal scroll) ───────────────

function HotRoomCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const listenerCount = session.listeners?.length || 0;
  const mode = modeLabel[session.roomMode] || 'Campfire';

  return (
    <AnimatedPressable style={hotStyles.card} onPress={onPress} scaleDown={0.97}>
      {/* Room name */}
      <Text variant="h3" color={colors.text.primary} numberOfLines={1}>
        {session.name}
      </Text>

      {/* Host */}
      <Text variant="bodySmall" color={colors.text.muted} numberOfLines={1}>
        {session.hostUsername}
      </Text>

      {/* Now playing strip */}
      {session.currentTrack && (
        <View style={hotStyles.nowPlaying}>
          <View style={{ flex: 1 }}>
            <Text variant="label" color={colors.text.primary} numberOfLines={1}>
              {session.currentTrack.title}
            </Text>
            <Text variant="labelSmall" color={colors.text.muted} numberOfLines={1}>
              {session.currentTrack.artist}
            </Text>
          </View>
        </View>
      )}

      {/* Footer — listeners + mode */}
      <View style={hotStyles.footer}>
        <ListenerAvatars listeners={session.listeners || []} max={3} />
        <View style={{ flex: 1 }} />
        <Text variant="labelSmall" color={colors.text.muted}>
          {listenerCount} in · {mode}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const hotStyles = StyleSheet.create({
  card: {
    width: 240,
    padding: spacing.cardPadding,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 4,
  },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: spacing.radius.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});

// ─── Activity Feed Item ─────────────────────────────────────

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

// ─── Compact Session Card (vertical list) ───────────────────

function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const listenerCount = session.listeners?.length || 0;
  const mode = modeLabel[session.roomMode] || 'Campfire';

  return (
    <AnimatedPressable style={cardStyles.card} onPress={onPress} scaleDown={0.98}>
      <View style={cardStyles.body}>
        <View style={cardStyles.header}>
          <Text variant="labelLarge" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
            {session.name}
          </Text>
          {session.isLive && (
            <View style={cardStyles.liveDot} />
          )}
        </View>

        {session.currentTrack && (
          <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
            {session.currentTrack.title} — {session.currentTrack.artist}
          </Text>
        )}

        <View style={cardStyles.meta}>
          <Text variant="labelSmall" color={colors.text.muted}>
            {listenerCount} listening
          </Text>
          <Text variant="labelSmall" color={colors.text.muted}>
            {mode}
          </Text>
          {session.genre && session.genre !== 'Mixed' && (
            <Text variant="labelSmall" color={colors.text.muted}>
              {session.genre}
            </Text>
          )}
          <Text variant="labelSmall" color={colors.text.muted}>
            {session.hostUsername}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  body: { padding: spacing.cardPadding, gap: 4 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.action.primary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: 4,
  },
});

// ─── Genre Section (horizontal row) ─────────────────────────

function GenreSection({
  genre,
  sessions,
  onPress,
}: {
  genre: string;
  sessions: Session[];
  onPress: (session: Session) => void;
}) {
  return (
    <View style={genreStyles.section}>
      <View style={genreStyles.header}>
        <Text variant="labelLarge" color={colors.text.primary}>{genre}</Text>
        <Text variant="labelSmall" color={colors.text.muted}>{sessions.length} live</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={genreStyles.row}>
        {sessions.map((s) => (
          <GenreCard key={s.id} session={s} onPress={() => onPress(s)} />
        ))}
      </ScrollView>
    </View>
  );
}

function GenreCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const listenerCount = session.listeners?.length || 0;

  return (
    <AnimatedPressable style={genreStyles.card} onPress={onPress} scaleDown={0.96}>
      <Text variant="label" color={colors.text.primary} numberOfLines={1}>
        {session.name}
      </Text>
      {session.currentTrack && (
        <Text variant="labelSmall" color={colors.text.muted} numberOfLines={1}>
          {session.currentTrack.artist}
        </Text>
      )}
      <Text variant="labelSmall" color={colors.text.muted} style={{ marginTop: 4 }}>
        {listenerCount} listening
      </Text>
    </AnimatedPressable>
  );
}

const genreStyles = StyleSheet.create({
  section: { marginBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  card: {
    width: 160,
    padding: spacing.cardPadding,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 4,
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
        active && { backgroundColor: colors.action.primary + '14', borderColor: colors.action.primary },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
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

// ─── Main Screen ────────────────────────────────────────────

export function DiscoverScreen({ onOpenRoom }: DiscoverScreenProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');
  const [activeGenre, setActiveGenre] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      const { sessions: list } = await sessionApi.discover();
      setSessions(list || []);
    } catch {
      setSessions([]);
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
    [sessions]
  );

  // Unique genres present in live rooms
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
          (s.currentTrack?.artist || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [liveSessions, activeFilter, activeGenre, searchQuery]);

  // Hot rooms — top 3 by activity score
  const hotRooms = useMemo(() => {
    return [...filteredSessions]
      .sort((a, b) => activityScore(b) - activityScore(a))
      .slice(0, 3);
  }, [filteredSessions]);

  // Activity feed
  const activityFeed = useMemo(() => buildActivityFeed(liveSessions), [liveSessions]);

  // Genre groups (rooms NOT in hot top 3)
  const hotIds = new Set(hotRooms.map((s) => s.id));
  const genreGroups = useMemo(() => {
    const rest = filteredSessions.filter((s) => !hotIds.has(s.id));
    const groups = new Map<string, Session[]>();
    for (const s of rest) {
      const genre = s.genre || 'Other';
      if (!groups.has(genre)) groups.set(genre, []);
      groups.get(genre)!.push(s);
    }
    return Array.from(groups.entries())
      .filter(([, arr]) => arr.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);
  }, [filteredSessions, hotIds]);

  // Remaining rooms
  const displayedGenreIds = new Set(genreGroups.flatMap(([, arr]) => arr.map((s) => s.id)));
  const remainingRooms = useMemo(
    () => filteredSessions.filter((s) => !hotIds.has(s.id) && !displayedGenreIds.has(s.id)),
    [filteredSessions, hotIds, displayedGenreIds]
  );

  const isSearchActive = searchQuery.trim().length > 0;

  const handleOpenRoom = (session: Session) => {
    if (onOpenRoom) onOpenRoom(session.id);
  };

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
          <View style={{ paddingHorizontal: spacing.screenPadding }}>
            <SessionCard session={item} onPress={() => handleOpenRoom(item)} />
          </View>
        )}
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
                {/* Trending */}
                {hotRooms.length > 0 && (
                  <View>
                    <SectionHeader title="Trending" />
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hotRow}
                    >
                      {hotRooms.map((s) => (
                        <HotRoomCard
                          key={s.id}
                          session={s}
                          onPress={() => handleOpenRoom(s)}
                        />
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
                          onPress={() => handleOpenRoom({ id: item.sessionId } as Session)}
                        />
                      ))}
                    </View>
                  </View>
                )}

                {/* Genre Sections */}
                {genreGroups.map(([genre, genreSessions]) => (
                  <GenreSection
                    key={genre}
                    genre={genre}
                    sessions={genreSessions}
                    onPress={handleOpenRoom}
                  />
                ))}

                {/* All Rooms header */}
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
    paddingBottom: spacing['3xl'],
  },
  emptyState: {
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.screenPadding,
  },
});

export default DiscoverScreen;
