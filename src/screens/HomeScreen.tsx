/**
 * Home Screen — Gemini V7 Layout
 *
 * Structure:
 *   F-C FREQUEN-C  ⚡145  [avatar]      ← Top bar: logo, CV balance, profile
 *   ─────────────────────────────────────
 *   LIVE CONNECTION                      ← Section label (monospace)
 *   ┌─────────────────────────────────┐
 *   │ ● ACTIVE PATCH        4/10      │  ← Live room card w/ badge
 *   │ Studio B Vibe                    │
 *   │ Night Drive                  ▶   │
 *   │ Synthwave Collective             │
 *   └─────────────────────────────────┘
 *   RECENT FLIGHT CASES    VIEW ALL    ← Section label
 *   [card] [card] [card] →             ← Horizontal scroll archive cards
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  Image, FlatList, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, ADSRFadeIn, RoomCard, ErrorState } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import { spacing } from '../theme/spacing';
import { VoidSurface, LEDReadout, StatusLight } from '../design/components';
import { palette } from '../design/tokens/materials';
import type { Session, RoomMode } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FLIGHT_CASE_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2.4; // ~2.4 cards visible

// ─── Component ──────────────────────────────────────────────

interface HomeScreenProps {
  onCreateSession: () => void;
  onJoinSession: () => void;
  onOpenRoom: (sessionId: string) => void;
  onOpenProfile?: () => void;
  onOpenDesignTest?: () => void;
}

export function HomeScreen({
  onCreateSession, onJoinSession, onOpenRoom, onOpenProfile, onOpenDesignTest,
}: HomeScreenProps) {
  const { user } = useAuth();
  const [myRooms, setMyRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyRooms = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      setMyRooms(sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    }
  }, []);

  useEffect(() => {
    fetchMyRooms();
    const interval = setInterval(fetchMyRooms, 15000);
    return () => clearInterval(interval);
  }, [fetchMyRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyRooms();
    setRefreshing(false);
  }, [fetchMyRooms]);

  // Active (live) room — show as "LIVE CONNECTION" card
  const liveRoom = myRooms.find((r) => r.isLive);
  // Archive rooms — show as "RECENT FLIGHT CASES"
  const archiveRooms = myRooms.filter((r) => !r.isLive);

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
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
          {/* Error State */}
          {error && (
            <View style={styles.errorContainer}>
              <ErrorState message={error} onRetry={fetchMyRooms} />
            </View>
          )}

          {/* ═══ TOP BAR — F-C FREQUEN-C ⚡CV [avatar] ═══════ */}
          <ADSRFadeIn index={0}>
            <View style={styles.topBar}>
              {/* Logo mark */}
              <View style={styles.logoGroup}>
                <View style={styles.logoMark}>
                  <Text style={styles.logoText}>F-C</Text>
                </View>
                <Text style={styles.appName}>FREQUEN-C</Text>
              </View>

              <View style={styles.topBarRight}>
                {/* CV Balance pill */}
                <View style={styles.cvBadge}>
                  <Ionicons name="flash" size={12} color={palette.green} />
                  <Text style={styles.cvText}>145</Text>
                </View>

                {/* Profile avatar */}
                <TouchableOpacity
                  onPress={onOpenProfile}
                  style={styles.avatarBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-outline" size={20} color={palette.silver} />
                </TouchableOpacity>
              </View>
            </View>
          </ADSRFadeIn>

          {/* ═══ LIVE CONNECTION ══════════════════════════════ */}
          <ADSRFadeIn index={1}>
            <Text style={styles.sectionLabel}>LIVE CONNECTION</Text>

            {liveRoom ? (
              <TouchableOpacity
                style={styles.liveCard}
                onPress={() => onOpenRoom(liveRoom.id)}
                activeOpacity={0.8}
              >
                {/* ACTIVE PATCH badge + listener count */}
                <View style={styles.liveCardHeader}>
                  <View style={styles.activePatchBadge}>
                    <StatusLight variant="pulse" color="red" size="sm" />
                    <Text style={styles.activePatchText}>ACTIVE PATCH</Text>
                  </View>
                  <View style={styles.listenerCount}>
                    <Text style={styles.listenerCountText}>
                      {liveRoom.listeners?.length || 0}/10
                    </Text>
                  </View>
                </View>

                {/* Room name */}
                <Text style={styles.liveRoomName}>{liveRoom.name}</Text>

                {/* Current track + play button */}
                <View style={styles.liveTrackRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveTrackTitle} numberOfLines={1}>
                      {liveRoom.currentTrack?.title || 'No track playing'}
                    </Text>
                    <Text style={styles.liveTrackArtist} numberOfLines={1}>
                      {liveRoom.currentTrack?.artist || 'Add a track to start'}
                    </Text>
                  </View>
                  <View style={styles.playBtnSmall}>
                    <Ionicons name="play" size={20} color={palette.void} style={{ marginLeft: 2 }} />
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              /* Empty state — no live connection */
              <TouchableOpacity
                style={styles.emptyLiveCard}
                onPress={onCreateSession}
                activeOpacity={0.8}
              >
                <View style={styles.emptyLiveInner}>
                  <Ionicons name="radio-outline" size={28} color={palette.slate} />
                  <Text style={styles.emptyLiveText}>No active patch.</Text>
                  <Text style={styles.emptyLiveSubtext}>
                    Initialize a new signal to start listening.
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </ADSRFadeIn>

          {/* ═══ RECENT FLIGHT CASES ═════════════════════════ */}
          <ADSRFadeIn index={2}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>RECENT FLIGHT CASES</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.viewAllText}>VIEW ALL</Text>
              </TouchableOpacity>
            </View>

            {archiveRooms.length > 0 ? (
              <FlatList
                horizontal
                data={archiveRooms.slice(0, 10)}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.flightCaseList}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.flightCaseCard}
                    onPress={() => onOpenRoom(item.id)}
                    activeOpacity={0.8}
                  >
                    {/* Album art placeholder */}
                    <View style={styles.flightCaseArt}>
                      {item.currentTrack?.albumArt ? (
                        <Image
                          source={{ uri: item.currentTrack.albumArt }}
                          style={styles.flightCaseArtImage}
                        />
                      ) : (
                        <Ionicons name="disc-outline" size={24} color={palette.slate} />
                      )}
                    </View>
                    <Text style={styles.flightCaseName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.flightCaseDate} numberOfLines={1}>
                      {formatTimeAgo(item.createdAt)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={styles.emptyFlightCases}>
                <Text style={styles.emptyFlightCaseText}>
                  No flight cases yet. Your session archives will appear here.
                </Text>
              </View>
            )}
          </ADSRFadeIn>

          {/* Bottom spacer for tab bar + mini player */}
          <View style={{ height: 120 }} />
        </ScrollView>
      </VoidSurface>
    </SafeScreen>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['3xl'],
  },
  errorContainer: {
    marginBottom: spacing.lg,
  },

  // ─── Top Bar ──────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'ChakraPetch-Bold',
    fontSize: 11,
    color: palette.orange,
    letterSpacing: 1,
  },
  appName: {
    fontFamily: 'ChakraPetch-Bold',
    fontSize: 20,
    color: palette.frost,
    letterSpacing: 2,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cvBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.20)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cvText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 13,
    color: palette.green,
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Section Labels ───────────────────────────────────
  sectionLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.slate,
    letterSpacing: 2,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: spacing.xl,
  },
  viewAllText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.silver,
    letterSpacing: 1,
  },

  // ─── Live Connection Card ─────────────────────────────
  liveCard: {
    backgroundColor: palette.midnight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.12)',
  },
  liveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activePatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activePatchText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.red,
    letterSpacing: 1.5,
  },
  listenerCount: {
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  listenerCountText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: palette.silver,
  },
  liveRoomName: {
    fontFamily: 'ChakraPetch-Bold',
    fontSize: 24,
    color: palette.frost,
    marginBottom: 10,
  },
  liveTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveTrackTitle: {
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 15,
    color: palette.frost,
    marginBottom: 2,
  },
  liveTrackArtist: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 13,
    color: palette.silver,
  },
  playBtnSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    // Orange glow
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  // ─── Empty Live State ─────────────────────────────────
  emptyLiveCard: {
    backgroundColor: palette.midnight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderStyle: 'dashed',
  },
  emptyLiveInner: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyLiveText: {
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 16,
    color: palette.silver,
    marginTop: 10,
  },
  emptyLiveSubtext: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 13,
    color: palette.slate,
    marginTop: 4,
    textAlign: 'center',
  },

  // ─── Flight Case Cards ────────────────────────────────
  flightCaseList: {
    paddingRight: spacing.screenPadding,
  },
  flightCaseCard: {
    width: FLIGHT_CASE_WIDTH,
    marginRight: 12,
  },
  flightCaseArt: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: palette.steel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  flightCaseArtImage: {
    width: '100%',
    height: '100%',
  },
  flightCaseName: {
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 13,
    color: palette.frost,
    marginBottom: 2,
  },
  flightCaseDate: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.slate,
  },
  emptyFlightCases: {
    backgroundColor: 'rgba(148, 163, 184, 0.04)',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  emptyFlightCaseText: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 13,
    color: palette.slate,
    textAlign: 'center',
  },
});

export default HomeScreen;
