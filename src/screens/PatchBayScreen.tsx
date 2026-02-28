/**
 * Patch Bay Screen — Modular Synthesis Home
 *
 * Merges Home + Discover into a live session grid.
 * Sessions displayed as "modules" in a 2-column grid.
 * Sections: Your Signal Chain → Live Grid → LFO Discovery
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, ADSRFadeIn, RoomModeBadge, ErrorState, Skeleton, CrossfadeSwitch } from '../components/ui';
import { WaveformIcon } from '../components/ui/WaveformIcon';
import { AnimatedPressable } from '../components/ui/AnimatedPressable';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import type { Session, RoomMode } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODULE_GAP = 12;
const MODULE_WIDTH = (SCREEN_WIDTH - spacing.screenPadding * 2 - MODULE_GAP) / 2;

// ─── Props ──────────────────────────────────────────────────

interface PatchBayScreenProps {
  onCreateSession: () => void;
  onJoinSession: () => void;
  onOpenRoom: (sessionId: string) => void;
  onOpenProfile?: () => void;
}

// ─── Module Card Skeleton — Loading placeholder ─────────────

function ModuleCardSkeleton() {
  return (
    <View style={styles.moduleCard}>
      {/* Header */}
      <View style={styles.moduleHeader}>
        <Skeleton width={14} height={14} borderRadius={2} />
        <Skeleton fill height={11} style={{ maxWidth: 80 }} />
      </View>

      {/* Body */}
      <View style={styles.moduleBody}>
        <Skeleton fill height={12} style={{ marginBottom: 4 }} />
        <Skeleton fill height={10} style={{ maxWidth: 100 }} />
      </View>

      {/* Footer */}
      <View style={styles.moduleFooter}>
        <Skeleton width={40} height={14} borderRadius={4} />
        <View style={{ flex: 1 }} />
        <Skeleton width={30} height={10} />
      </View>

      {/* Host label */}
      <Skeleton fill height={9} style={{ maxWidth: 60 }} />
    </View>
  );
}

// ─── Module Card — Individual session in the grid ───────────

interface ModuleCardProps {
  session: Session;
  onPress: () => void;
  isGhost?: boolean; // Reverb Tail — recently left
}

function ModuleCard({ session, onPress, isGhost = false }: ModuleCardProps) {
  const mode = (session.roomMode || 'campfire') as RoomMode;
  const listenerCount = session.listeners?.length || 0;

  return (
    <AnimatedPressable
      style={[styles.moduleCard, isGhost && styles.moduleGhost]}
      onPress={onPress}
      scaleDown={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${session.name} by ${session.hostUsername}, ${mode} mode${session.isLive ? `, live with ${listenerCount} listeners` : ''}${session.currentTrack ? `, playing ${session.currentTrack.title}` : ''}`}
    >
      {/* Chrome header bar */}
      <View style={styles.moduleHeader}>
        <WaveformIcon mode={mode} size={14} />
        <Text
          variant="labelSmall"
          color={palette.frost}
          style={styles.moduleName}
          numberOfLines={1}
        >
          {session.name}
        </Text>
      </View>

      {/* Module body */}
      <View style={styles.moduleBody}>
        {/* Current track info or empty state */}
        {session.currentTrack ? (
          <View style={styles.trackInfo}>
            <Text variant="bodySmall" color={palette.frost} numberOfLines={1}>
              {session.currentTrack.title}
            </Text>
            <Text variant="labelSmall" color={palette.slate} numberOfLines={1}>
              {session.currentTrack.artist}
            </Text>
          </View>
        ) : (
          <Text variant="labelSmall" color={palette.slate} style={styles.noTrack}>
            No signal
          </Text>
        )}
      </View>

      {/* Module footer */}
      <View style={styles.moduleFooter}>
        {/* Genre tag */}
        {session.genre && (
          <View style={styles.genreTag}>
            <Text variant="labelSmall" color={palette.slate} style={{ fontSize: 9 }}>
              {session.genre}
            </Text>
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* Listener count + LIVE dot */}
        <View style={styles.listeners}>
          {session.isLive && <View style={styles.liveDot} />}
          <Text variant="labelSmall" color={palette.silver}>
            {listenerCount}
          </Text>
        </View>
      </View>

      {/* Host */}
      <Text variant="labelSmall" color={palette.slate} style={styles.hostLabel}>
        {session.hostUsername}
      </Text>
    </AnimatedPressable>
  );
}

// ─── Genre Filter Band ──────────────────────────────────────

const GENRE_BANDS = ['All', 'Hip-Hop', 'R&B', 'Pop', 'Rock', 'Electronic', 'Jazz', 'Classical'];

function GenreFilterBand({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (genre: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterBand}
    >
      {GENRE_BANDS.map((genre) => {
        const isActive = active === genre;
        return (
          <TouchableOpacity
            key={genre}
            style={[styles.filterChip, isActive && styles.filterChipActive]}
            onPress={() => onSelect(genre)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${genre}${isActive ? ', selected' : ''}`}
            accessibilityState={{ selected: isActive }}
          >
            <Text
              variant="labelSmall"
              color={isActive ? palette.orange : palette.slate}
              style={{ fontSize: 10, letterSpacing: 0.8 }}
            >
              {genre.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ────────────────────────────────────────────

export function PatchBayScreen({
  onCreateSession,
  onJoinSession,
  onOpenRoom,
  onOpenProfile,
}: PatchBayScreenProps) {
  const { user } = useAuth();
  const [myRooms, setMyRooms] = useState<Session[]>([]);
  const [allRooms, setAllRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [genreFilter, setGenreFilter] = useState('All');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [myRes, discoverRes] = await Promise.all([
        sessionApi.myRooms(),
        sessionApi.discover(),
      ]);
      setMyRooms(myRes.sessions);
      setAllRooms(discoverRes.sessions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load rooms';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Filter out my rooms from the public grid to avoid duplicates
  const myRoomIds = useMemo(() => new Set(myRooms.map((r) => r.id)), [myRooms]);

  const filteredRooms = useMemo(() => {
    let rooms = allRooms.filter((r) => !myRoomIds.has(r.id));
    if (genreFilter !== 'All') {
      rooms = rooms.filter(
        (r) => (r.genre || '').toLowerCase() === genreFilter.toLowerCase()
      );
    }
    // Sort by listener count descending
    return rooms.sort(
      (a, b) => (b.listeners?.length || 0) - (a.listeners?.length || 0)
    );
  }, [allRooms, myRoomIds, genreFilter]);

  return (
    <SafeScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.orange}
          />
        }
      >
        {/* Header */}
        <ADSRFadeIn index={0}>
          <View style={styles.header}>
            <View>
              <Text variant="h2" color={palette.frost}>
                Home
              </Text>
              <Text variant="bodySmall" color={palette.silver}>
                {allRooms.filter((r) => r.isLive).length} live rooms
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={onJoinSession}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Join a session"
              >
                <Ionicons name="qr-code-outline" size={20} color={palette.slate} />
              </TouchableOpacity>
              {onOpenProfile && (
                <TouchableOpacity
                  style={styles.headerBtn}
                  onPress={onOpenProfile}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                >
                  <Ionicons name="person-circle-outline" size={22} color={palette.silver} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ADSRFadeIn>

        {/* Genre Filter Band */}
        <ADSRFadeIn index={1}>
          <GenreFilterBand active={genreFilter} onSelect={setGenreFilter} />
        </ADSRFadeIn>

        {/* Error State */}
        {error && (
          <ADSRFadeIn index={2}>
            <View style={styles.section}>
              <ErrorState message={error} onRetry={fetchData} />
            </View>
          </ADSRFadeIn>
        )}

        {/* Loading → Content crossfade */}
        {!error && (
          <CrossfadeSwitch loading={isLoading}>
            {/* Skeleton placeholder */}
            <ADSRFadeIn index={2}>
              <View style={styles.section}>
                <Text variant="labelSmall" color={palette.slate} style={styles.sectionLabel}>
                  LIVE GRID
                </Text>
                <View style={styles.moduleGrid}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <ModuleCardSkeleton key={`skeleton-${i}`} />
                  ))}
                </View>
              </View>
            </ADSRFadeIn>

            {/* Loaded content */}
            <View>
              {/* Your Signal Chain */}
              {myRooms.length > 0 && (
                <ADSRFadeIn index={2}>
                  <View style={styles.section}>
                    <Text variant="labelSmall" color={palette.slate} style={styles.sectionLabel}>
                      YOUR ROOMS
                    </Text>
                    <View style={styles.moduleGrid}>
                      {myRooms.map((room) => (
                        <ModuleCard
                          key={room.id}
                          session={room}
                          onPress={() => onOpenRoom(room.id)}
                        />
                      ))}
                    </View>
                  </View>
                </ADSRFadeIn>
              )}

              {/* Live Grid */}
              <ADSRFadeIn index={3}>
                <View style={styles.section}>
                  <Text variant="labelSmall" color={palette.slate} style={styles.sectionLabel}>
                    LIVE NOW
                  </Text>
                  {filteredRooms.length === 0 ? (
                    <View style={styles.emptyModule}>
                      <Ionicons name="radio-outline" size={32} color={palette.slate} />
                      <Text variant="body" color={palette.slate} align="center">
                        No live rooms{genreFilter !== 'All' ? ` in ${genreFilter}` : ''}.
                      </Text>
                      <TouchableOpacity onPress={onCreateSession} accessibilityRole="button" accessibilityLabel="Create a session">
                        <Text variant="label" color={palette.orange}>
                          Create a room
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.moduleGrid}>
                      {filteredRooms.map((room) => (
                        <ModuleCard
                          key={room.id}
                          session={room}
                          onPress={() => onOpenRoom(room.id)}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </ADSRFadeIn>
            </View>
          </CrossfadeSwitch>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeScreen>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingTop: spacing['2xl'],
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter Band
  filterBand: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  filterChipActive: {
    borderColor: palette.orange,
    backgroundColor: 'rgba(100, 200, 255, 0.10)',
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.screenPadding,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },

  // Module Grid
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: MODULE_GAP,
  },

  // Module Card
  moduleCard: {
    width: MODULE_WIDTH,
    backgroundColor: palette.steel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    padding: 12,
    gap: 8,
  },
  moduleGhost: {
    opacity: 0.35,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  moduleName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  moduleBody: {
    minHeight: 36,
    justifyContent: 'center',
  },
  trackInfo: {
    gap: 2,
  },
  noTrack: {
    fontStyle: 'italic',
    fontSize: 10,
  },
  moduleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genreTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  listeners: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.red,
  },
  hostLabel: {
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Empty state
  emptyModule: {
    backgroundColor: palette.steel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
});

export default PatchBayScreen;
