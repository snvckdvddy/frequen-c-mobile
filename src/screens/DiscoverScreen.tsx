/**
 * Discover Screen — "Live Sonar" (Gemini V7)
 *
 * Structure:
 *   Live Sonar                         ← Title
 *   SCANNING LOCAL FREQUENCIES         ← Subtitle (monospace)
 *   ┌─────────────────────────────┐
 *   │                             │
 *   │     ·  Sonar Radar  ·       │    ← Animated radar with room dots
 *   │         Visualization       │
 *   │                             │
 *   └─────────────────────────────┘
 *   [LP FILTER]  [HP FILTER]          ← Knob-style filters
 *   🔍 Ping a vibe (e.g. Rainy 2AM)  ← Search bar
 *   ─────────────────────────────────
 *   LIVE SIGNALS                       ← Room list section
 *   [room] [room] [room]
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput, Dimensions, Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, RoomCard, ErrorState, ADSRFadeIn } from '../components/ui';
import { sessionApi } from '../services/api';
import { spacing } from '../theme/spacing';
import type { Session, RoomMode } from '../types';
import { VoidSurface, StatusLight } from '../design/components';
import { palette } from '../design/tokens/materials';
import { useTheme } from '../contexts/ThemeContext';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, fontWeight, letterSpacing as ls } from '../design/tokens/typography';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SONAR_SIZE = SCREEN_WIDTH - 64;

// ─── Props ──────────────────────────────────────────────────

interface DiscoverScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

// ─── Sonar Radar Visualization ──────────────────────────────

function SonarRadar({ rooms, onRoomPress }: { rooms: Session[]; onRoomPress?: (id: string) => void }) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Place rooms pseudo-randomly on the radar
  const roomDots = useMemo(() => {
    return rooms.slice(0, 8).map((room, i) => {
      const angle = (i / Math.max(rooms.length, 1)) * 2 * Math.PI + 0.3 * i;
      const distance = 0.25 + (i % 3) * 0.2; // 25-65% from center
      const x = SONAR_SIZE / 2 + Math.cos(angle) * (SONAR_SIZE / 2) * distance - 6;
      const y = SONAR_SIZE / 2 + Math.sin(angle) * (SONAR_SIZE / 2) * distance - 6;
      return { ...room, x, y };
    });
  }, [rooms]);

  return (
    <View style={sonarStyles.container}>
      {/* Concentric circles */}
      <View style={[sonarStyles.ring, sonarStyles.ringOuter]} />
      <View style={[sonarStyles.ring, sonarStyles.ringMiddle]} />
      <View style={[sonarStyles.ring, sonarStyles.ringInner]} />

      {/* Crosshairs */}
      <View style={sonarStyles.crossH} />
      <View style={sonarStyles.crossV} />

      {/* Sweep line */}
      <Animated.View style={[sonarStyles.sweepArm, { transform: [{ rotate: spin }] }]}>
        <View style={sonarStyles.sweepLine} />
      </Animated.View>

      {/* Room dots */}
      {roomDots.map((room) => (
        <TouchableOpacity
          key={room.id}
          style={[sonarStyles.roomDot, { left: room.x, top: room.y }]}
          onPress={() => onRoomPress?.(room.id)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Room: ${room.name}`}
          accessibilityHint={`${room.hostUsername}'s ${room.roomMode} room. Double tap to join.`}
        >
          <View style={sonarStyles.roomDotInner} accessible={false} />
        </TouchableOpacity>
      ))}

      {/* Center point */}
      <View style={sonarStyles.centerDot} />
    </View>
  );
}

const sonarStyles = StyleSheet.create({
  container: {
    width: SONAR_SIZE,
    height: SONAR_SIZE,
    alignSelf: 'center',
    backgroundColor: colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: colors.accentSecondarySubtle,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: colors.accentSecondarySubtle,
  },
  ringOuter: {
    width: SONAR_SIZE * 0.85,
    height: SONAR_SIZE * 0.85,
    left: SONAR_SIZE * 0.075,
    top: SONAR_SIZE * 0.075,
  },
  ringMiddle: {
    width: SONAR_SIZE * 0.55,
    height: SONAR_SIZE * 0.55,
    left: SONAR_SIZE * 0.225,
    top: SONAR_SIZE * 0.225,
  },
  ringInner: {
    width: SONAR_SIZE * 0.25,
    height: SONAR_SIZE * 0.25,
    left: SONAR_SIZE * 0.375,
    top: SONAR_SIZE * 0.375,
  },
  crossH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    top: '50%',
    backgroundColor: palette.iceGlow,
  },
  crossV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    left: '50%',
    backgroundColor: palette.iceGlow,
  },
  sweepArm: {
    position: 'absolute',
    width: SONAR_SIZE,
    height: SONAR_SIZE,
    alignItems: 'center',
  },
  sweepLine: {
    width: 2,
    height: SONAR_SIZE / 2,
    backgroundColor: palette.iceGlow,
  },
  roomDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomDotInner: {
    width: 8,
    height: 8,
    backgroundColor: palette.ice,
    shadowColor: palette.ice,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  centerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: palette.orange,
    left: SONAR_SIZE / 2 - 3,
    top: SONAR_SIZE / 2 - 3,
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});

// ─── Main Screen ────────────────────────────────────────────

export function DiscoverScreen({ onOpenRoom }: DiscoverScreenProps) {
  const { accent } = useTheme();
  const [rooms, setRooms] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.discover();
      setRooms(sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan frequencies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  }, [fetchRooms]);

  // Filter rooms by search
  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();
    return rooms.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.genre?.toLowerCase().includes(q) ||
      r.hostUsername?.toLowerCase().includes(q)
    );
  }, [rooms, search]);

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={accent}
            />
          }
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              {/* Title */}
              <Text style={styles.title}>Live Sonar</Text>
              <Text style={styles.subtitle}>SCANNING LOCAL FREQUENCIES</Text>

              {/* Sonar Radar */}
              <View style={styles.sonarContainer}>
                <SonarRadar rooms={rooms} onRoomPress={onOpenRoom} />
              </View>

              {/* Filter knobs row */}
              <View style={styles.filterRow}>
                <View style={styles.filterKnob}>
                  <Text style={styles.knobLabel}>LP FILTER</Text>
                  <View style={styles.knobDial}>
                    <View style={styles.knobIndicator} />
                  </View>
                </View>
                <View style={styles.filterKnob}>
                  <Text style={styles.knobLabel}>HP FILTER</Text>
                  <View style={styles.knobDial}>
                    <View style={styles.knobIndicator} />
                  </View>
                </View>
              </View>

              {/* Search bar */}
              <View style={styles.searchBar}>
                <Ionicons name="radio-outline" size={16} color={palette.slate} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Ping a vibe (e.g. Rainy 2AM)..."
                  placeholderTextColor={palette.slate}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Search rooms and frequencies"
                  accessibilityHint="Enter keywords to find sessions"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" accessibilityHint="Double tap to clear the search field">
                    <Ionicons name="close-circle" size={16} color={palette.slate} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Section label */}
              <Text style={styles.sectionLabel}>LIVE SIGNALS</Text>

              {error && <ErrorState message={error} onRetry={fetchRooms} />}

              {loading && (
                <View style={styles.loadingCenter}>
                  <ActivityIndicator color={accent} size="large" />
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => (
            <ADSRFadeIn index={index} staggerMs={50}>
              <View style={styles.roomCardWrapper}>
                <RoomCard
                  roomName={item.name}
                  hostUsername={item.hostUsername}
                  roomMode={(item.roomMode || 'campfire') as RoomMode}
                  isLive={item.isLive ?? true}
                  listenerCount={item.listeners?.length || 0}
                  genre={item.genre}
                  currentTrack={
                    item.currentTrack
                      ? {
                          title: item.currentTrack.title,
                          artist: item.currentTrack.artist,
                          albumArt: item.currentTrack.albumArt,
                        }
                      : undefined
                  }
                  onJoin={() => onOpenRoom?.(item.id)}
                  onPress={() => onOpenRoom?.(item.id)}
                />
              </View>
            </ADSRFadeIn>
          )}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="radio-outline" size={40} color={palette.slate} />
                <Text style={styles.emptyText}>No signals detected.</Text>
                <Text style={styles.emptySubtext}>
                  {search ? 'Try a different frequency.' : 'No live rooms right now. Start one.'}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      </VoidSurface>
    </SafeScreen>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['3xl'],
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['4xl'],
    color: palette.frost,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.wider,
    marginBottom: spacing.lg,
  },
  sonarContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },

  // Filter knobs
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: spacing.lg,
  },
  filterKnob: {
    alignItems: 'center',
  },
  knobLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    letterSpacing: ls.wide,
    marginBottom: 8,
  },
  knobDial: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: colors.skeletonHighlight,
    backgroundColor: palette.steel,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  knobIndicator: {
    width: 2,
    height: 10,
    backgroundColor: palette.orange,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.steel,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: palette.frost,
  },

  // Section
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.slate,
    letterSpacing: ls.wider,
    marginBottom: 12,
  },

  // Room cards
  roomCardWrapper: {
    marginBottom: 10,
  },

  // Loading
  loadingCenter: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: fontFamily.display,
    fontSize: 16,
    color: palette.silver,
    marginTop: 12,
  },
  emptySubtext: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: palette.slate,
    marginTop: 4,
  },
});

export default DiscoverScreen;
