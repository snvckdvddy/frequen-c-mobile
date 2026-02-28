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
import { Text, SafeScreen, RoomCard, ErrorState } from '../components/ui';
import { sessionApi } from '../services/api';
import { spacing } from '../theme/spacing';
import type { Session, RoomMode } from '../types';
import { VoidSurface, StatusLight } from '../design/components';
import { palette } from '../design/tokens/materials';

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
        >
          <View style={sonarStyles.roomDotInner} />
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
    borderRadius: SONAR_SIZE / 2,
    backgroundColor: 'rgba(14, 18, 25, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.08)',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.06)',
    borderRadius: 999,
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
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
  },
  crossV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    left: '50%',
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
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
    backgroundColor: 'rgba(0, 229, 255, 0.20)',
    borderRadius: 1,
  },
  roomDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    borderRadius: 3,
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
              tintColor={palette.orange}
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
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons name="close-circle" size={16} color={palette.slate} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Section label */}
              <Text style={styles.sectionLabel}>LIVE SIGNALS</Text>

              {error && <ErrorState message={error} onRetry={fetchRooms} />}

              {loading && (
                <View style={styles.loadingCenter}>
                  <ActivityIndicator color={palette.orange} size="large" />
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
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
    fontFamily: 'ChakraPetch-Bold',
    fontSize: 28,
    color: palette.frost,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
    letterSpacing: 2,
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
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.slate,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  knobDial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.20)',
    backgroundColor: palette.steel,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  knobIndicator: {
    width: 2,
    height: 10,
    borderRadius: 1,
    backgroundColor: palette.orange,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.steel,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.10)',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'SpaceMono-Regular',
    fontSize: 13,
    color: palette.frost,
  },

  // Section
  sectionLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.slate,
    letterSpacing: 2,
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
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 16,
    color: palette.silver,
    marginTop: 12,
  },
  emptySubtext: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 13,
    color: palette.slate,
    marginTop: 4,
  },
});

export default DiscoverScreen;
