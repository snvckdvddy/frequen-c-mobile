import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErrorState, SafeScreen } from '../components/ui';
import { VoidSurface } from '../design/components';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import {
  formatModeLabel,
  getModeBlockColors,
  tacticalTokens,
} from '../features/session-v2/theme/tacticalTokens';
import { sessionApi } from '../services/api';
import type { RoomMode, Session } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 40, 320);

interface DiscoverScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

type ModeFilter = 'all' | RoomMode;

function MonoText(props: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text {...props} />;
}

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <View style={styles.summaryChip}>
      <MonoText style={[styles.display, styles.summaryValue, { color: accent }]}>{value}</MonoText>
      <MonoText style={[styles.mono, styles.summaryLabel]}>{label}</MonoText>
    </View>
  );
}

function SonarRadar({
  rooms,
  onOpenRoom,
}: {
  rooms: Session[];
  onOpenRoom?: (sessionId: string) => void;
}) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const roomDots = useMemo(
    () =>
      rooms.slice(0, 8).map((room, index) => {
        const angle = (index / Math.max(rooms.length, 1)) * Math.PI * 2 + index * 0.36;
        const distance = 0.28 + (index % 3) * 0.18;
        const x = RADAR_SIZE / 2 + Math.cos(angle) * (RADAR_SIZE / 2) * distance - 8;
        const y = RADAR_SIZE / 2 + Math.sin(angle) * (RADAR_SIZE / 2) * distance - 8;
        return { room, x, y };
      }),
    [rooms],
  );

  return (
    <View style={styles.radarFrame}>
      <View style={styles.radarField}>
        <View style={[styles.radarRing, styles.radarOuter]} />
        <View style={[styles.radarRing, styles.radarMiddle]} />
        <View style={[styles.radarRing, styles.radarInner]} />
        <View style={styles.radarCrossHorizontal} />
        <View style={styles.radarCrossVertical} />

        <Animated.View style={[styles.radarSweep, { transform: [{ rotate: spin }] }]}>
          <View style={styles.radarSweepLine} />
        </Animated.View>

        {roomDots.map(({ room, x, y }) => {
          const modeColors = getModeBlockColors(room.roomMode);
          return (
            <Pressable
              key={room.id}
              onPress={() => onOpenRoom?.(room.id)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${room.name}`}
              style={({ pressed }) => [
                styles.radarDot,
                { left: x, top: y, borderColor: modeColors.borderColor },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radarDotCore, { backgroundColor: modeColors.borderColor }]} />
            </Pressable>
          );
        })}

        <View style={styles.radarCenter} />

        {!rooms.length ? (
          <View pointerEvents="none" style={styles.radarEmptyOverlay}>
            <MonoText style={[styles.display, styles.radarEmptyTitle]}>NO ACTIVE PINGS</MonoText>
            <MonoText style={[styles.mono, styles.radarEmptyCopy]}>
              SCAN QUEUE IS IDLE. PULL TO REFRESH OR WAIT FOR PUBLIC ROOMS TO GO LIVE.
            </MonoText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function RoomSignalCard({
  room,
  onOpenRoom,
}: {
  room: Session;
  onOpenRoom?: (sessionId: string) => void;
}) {
  const modeColors = getModeBlockColors(room.roomMode);

  return (
    <Pressable
      onPress={() => onOpenRoom?.(room.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${room.name}`}
      style={({ pressed }) => [styles.roomCard, pressed && styles.pressed]}
    >
      <View style={styles.roomCardTop}>
        <View style={[styles.modeBlock, { backgroundColor: modeColors.backgroundColor, borderColor: modeColors.borderColor }]}>
          <MonoText style={[styles.monoBold, styles.modeBlockText, { color: modeColors.color }]}>
            {formatModeLabel(room.roomMode)}
          </MonoText>
        </View>
        <View style={styles.roomTopMeta}>
          <MonoText style={[styles.mono, styles.roomSignalText]}>
            {String(room.listeners?.length || 0).padStart(2, '0')} LISTENERS
          </MonoText>
        </View>
      </View>

      <MonoText style={[styles.display, styles.roomTitle]} numberOfLines={1}>
        {room.name.toUpperCase()}
      </MonoText>
      <MonoText style={[styles.mono, styles.roomMeta]} numberOfLines={1}>
        HOST // {room.hostUsername.toUpperCase()}
        {room.genre ? ` // ${room.genre.toUpperCase()}` : ''}
      </MonoText>

      <View style={styles.roomTrackRail}>
        <View style={styles.roomTrackCopy}>
          <MonoText style={[styles.mono, styles.roomTrackLabel]}>
            {room.currentTrack ? 'CURRENT PATCH' : 'QUEUE STATUS'}
          </MonoText>
          <MonoText style={[styles.display, styles.roomTrackTitle]} numberOfLines={1}>
            {room.currentTrack ? room.currentTrack.title.toUpperCase() : 'STANDBY'}
          </MonoText>
          <MonoText style={[styles.mono, styles.roomTrackArtist]} numberOfLines={1}>
            {room.currentTrack ? room.currentTrack.artist.toUpperCase() : 'NO TRACK PATCHED'}
          </MonoText>
        </View>
        <Pressable
          onPress={() => onOpenRoom?.(room.id)}
          accessibilityRole="button"
          accessibilityLabel={`Join ${room.name}`}
          style={({ pressed }) => [styles.joinButton, pressed && styles.pressed]}
        >
          <MonoText style={[styles.monoBold, styles.joinButtonText]}>JOIN</MonoText>
        </Pressable>
      </View>
    </Pressable>
  );
}

export function DiscoverScreen({ onOpenRoom }: DiscoverScreenProps) {
  const [rooms, setRooms] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<ModeFilter>('all');

  const fetchRooms = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.discover();
      setRooms(sessions);
      setError(null);
    } catch (err) {
      setRooms([]);
      setError('ROOM BUS OFFLINE // LOCAL RADAR FALLBACK');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
    const interval = setInterval(() => {
      void fetchRooms();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  }, [fetchRooms]);

  const filteredRooms = useMemo(() => {
    let next = rooms;
    if (mode !== 'all') {
      next = next.filter((room) => room.roomMode === mode);
    }
    if (!search.trim()) {
      return next;
    }
    const query = search.toLowerCase();
    return next.filter((room) =>
      room.name.toLowerCase().includes(query) ||
      room.hostUsername.toLowerCase().includes(query) ||
      room.genre?.toLowerCase().includes(query),
    );
  }, [mode, rooms, search]);

  const liveCount = rooms.length;
  const openCount = rooms.filter((room) => room.isPublic).length;
  const listenerCount = rooms.reduce((sum, room) => sum + (room.listeners?.length || 0), 0);

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.58} />
          </View>

          <FlatList
            data={filteredRooms}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={tacticalTokens.colors.ice}
              />
            }
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <>
                <View style={styles.header}>
                  <MonoText style={[styles.mono, styles.eyebrow]}>SYS.FREQ // ROOM BUS</MonoText>
                  <MonoText style={[styles.display, styles.title]}>LIVE SONAR</MonoText>
                  <MonoText style={[styles.mono, styles.subtitle]}>
                    Scan public rooms, lock onto active sessions, and patch directly into live traffic.
                  </MonoText>
                </View>

                <View style={styles.summaryRow}>
                  <SummaryChip label="LIVE" value={String(liveCount).padStart(2, '0')} accent={tacticalTokens.colors.ice} />
                  <SummaryChip label="OPEN" value={String(openCount).padStart(2, '0')} accent={tacticalTokens.colors.acid} />
                  <SummaryChip label="LISTENERS" value={String(listenerCount).padStart(2, '0')} accent={tacticalTokens.colors.orange} />
                </View>

                <View style={styles.panel}>
                  <View style={styles.panelHeader}>
                    <MonoText style={[styles.mono, styles.panelEyebrow]}>SCAN RADAR</MonoText>
                    <MonoText style={[styles.monoBold, styles.panelMetric]}>
                      {String(filteredRooms.length).padStart(2, '0')} SIGNALS
                    </MonoText>
                  </View>
                  <SonarRadar rooms={filteredRooms} onOpenRoom={onOpenRoom} />
                </View>

                <View style={styles.searchPanel}>
                  <View style={styles.searchRow}>
                    <Ionicons name="search-outline" size={16} color={tacticalTokens.colors.textMuted} />
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder="PING ROOM, HOST, OR GENRE"
                      placeholderTextColor={tacticalTokens.colors.textMuted}
                      style={styles.searchInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                      accessibilityLabel="Search rooms"
                    />
                    {search ? (
                      <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
                        <Ionicons name="close" size={14} color={tacticalTokens.colors.white} />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.modeRow}>
                    {(['all', 'campfire', 'spotlight', 'openFloor'] as ModeFilter[]).map((filterValue) => {
                      const active = mode === filterValue;
                      const filterLabel = filterValue === 'all' ? 'ALL' : formatModeLabel(filterValue);
                      return (
                        <Pressable
                          key={filterValue}
                          onPress={() => setMode(filterValue)}
                          accessibilityRole="button"
                          accessibilityLabel={`Filter by ${filterLabel}`}
                          accessibilityState={{ selected: active }}
                          style={({ pressed }) => [
                            styles.modeFilter,
                            active && styles.modeFilterActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <MonoText style={[styles.monoBold, styles.modeFilterText, active && styles.modeFilterTextActive]}>
                            {filterLabel}
                          </MonoText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.sectionRow}>
                  <MonoText style={[styles.mono, styles.sectionLabel]}>LIVE SIGNALS</MonoText>
                  {loading ? (
                    <ActivityIndicator size="small" color={tacticalTokens.colors.ice} />
                  ) : null}
                </View>

                {error ? (
                  <View style={styles.errorRail}>
                    <ErrorState variant="banner" message={error} onRetry={fetchRooms} />
                  </View>
                ) : null}
              </>
            }
            renderItem={({ item }) => (
              <View style={styles.cardWrap}>
                <RoomSignalCard room={item} onOpenRoom={onOpenRoom} />
              </View>
            )}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyState}>
                  <Ionicons name="radio-outline" size={42} color={tacticalTokens.colors.textMuted} />
                  <MonoText style={[styles.display, styles.emptyTitle]}>NO ACTIVE ROUTE</MonoText>
                  <MonoText style={[styles.mono, styles.emptyCopy]}>
                    {search || mode !== 'all'
                      ? 'NO ROOMS MATCH THE CURRENT FILTER. TRY A WIDER SCAN.'
                      : 'NO PUBLIC ROOMS ARE BROADCASTING RIGHT NOW.'}
                  </MonoText>
                </View>
              ) : null
            }
            ListFooterComponent={<View style={{ height: 120 }} />}
          />
        </View>
      </VoidSurface>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  pressed: { opacity: 0.82 },
  mono: { fontFamily: tacticalTokens.fonts.mono },
  monoBold: { fontFamily: tacticalTokens.fonts.monoBold },
  display: { fontFamily: tacticalTokens.fonts.display },
  header: {},
  eyebrow: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontSize: 32,
    color: tacticalTokens.colors.white,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  summaryChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  summaryValue: {
    fontSize: 16,
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  panel: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    padding: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelEyebrow: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.8,
  },
  panelMetric: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.6,
  },
  radarFrame: {
    alignItems: 'center',
  },
  radarField: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    overflow: 'hidden',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
  },
  radarOuter: {
    width: RADAR_SIZE * 0.86,
    height: RADAR_SIZE * 0.86,
    left: RADAR_SIZE * 0.07,
    top: RADAR_SIZE * 0.07,
  },
  radarMiddle: {
    width: RADAR_SIZE * 0.58,
    height: RADAR_SIZE * 0.58,
    left: RADAR_SIZE * 0.21,
    top: RADAR_SIZE * 0.21,
  },
  radarInner: {
    width: RADAR_SIZE * 0.3,
    height: RADAR_SIZE * 0.3,
    left: RADAR_SIZE * 0.35,
    top: RADAR_SIZE * 0.35,
  },
  radarCrossHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: tacticalTokens.colors.borderGhost,
  },
  radarCrossVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: tacticalTokens.colors.borderGhost,
  },
  radarSweep: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
  },
  radarSweepLine: {
    width: 1,
    height: RADAR_SIZE / 2,
    backgroundColor: tacticalTokens.colors.ice,
    opacity: 0.5,
  },
  radarDot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050505',
  },
  radarDotCore: {
    width: 8,
    height: 8,
  },
  radarCenter: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: tacticalTokens.colors.orange,
    left: RADAR_SIZE / 2 - 4,
    top: RADAR_SIZE / 2 - 4,
  },
  radarEmptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  radarEmptyTitle: {
    fontSize: 24,
    color: tacticalTokens.colors.white,
  },
  radarEmptyCopy: {
    marginTop: 8,
    fontSize: 12,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
    textAlign: 'center',
  },
  searchPanel: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    padding: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: tacticalTokens.colors.white,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 12,
    letterSpacing: 1.1,
    padding: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  modeFilter: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modeFilterActive: {
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.white,
  },
  modeFilterText: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.4,
  },
  modeFilterTextActive: {
    color: tacticalTokens.colors.void,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 2.2,
  },
  errorRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 10,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.2,
  },
  cardWrap: {
    marginBottom: 10,
  },
  roomCard: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.94)',
    padding: 12,
  },
  roomCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  modeBlock: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  modeBlockText: {
    fontSize: 10,
    letterSpacing: 1.5,
  },
  roomTopMeta: {
    alignItems: 'flex-end',
  },
  roomSignalText: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  roomTitle: {
    marginTop: 12,
    fontSize: 24,
    color: tacticalTokens.colors.white,
  },
  roomMeta: {
    marginTop: 4,
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  roomTrackRail: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  roomTrackCopy: {
    flex: 1,
    minWidth: 0,
  },
  roomTrackLabel: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.3,
  },
  roomTrackTitle: {
    marginTop: 2,
    fontSize: 16,
    color: tacticalTokens.colors.white,
  },
  roomTrackArtist: {
    marginTop: 2,
    fontSize: 10,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  joinButton: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#04161A',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  joinButtonText: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(7, 7, 7, 0.84)',
    paddingHorizontal: 24,
    paddingVertical: 32,
    marginTop: 8,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 24,
    color: tacticalTokens.colors.white,
  },
  emptyCopy: {
    marginTop: 4,
    fontSize: 12,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
    textAlign: 'center',
  },
});

export default DiscoverScreen;
