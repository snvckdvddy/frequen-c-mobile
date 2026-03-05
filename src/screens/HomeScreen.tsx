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
import { Text, SafeScreen, ADSRFadeIn, ErrorState } from '../components/ui';
import { NetworkForecastCard } from '../components/home/NetworkForecastCard';
import { NotificationDrawer } from '../components/NotificationDrawer';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCV } from '../hooks/useCV';
import { sessionApi, notificationApi } from '../services/api';
import { spacing } from '../theme/spacing';
import { VoidSurface, LEDReadout, StatusLight, ModuleFaceplate } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, letterSpacing as ls } from '../design/tokens/typography';
import type { Session, RoomMode } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FLIGHT_CASE_WIDTH = (SCREEN_WIDTH - 48 - 12) / 2.4; // ~2.4 cards visible

// ─── Component ──────────────────────────────────────────────

interface HomeScreenProps {
  onCreateSession: () => void;
  onJoinSession: () => void;
  onOpenRoom: (sessionId: string) => void;
  onOpenProfile?: () => void;
  onOpenFriends?: () => void;
  onOpenActivityFeed?: () => void;
  onViewAllFlightCases?: () => void;
}

export function HomeScreen({
  onCreateSession, onJoinSession, onOpenRoom, onOpenProfile, onOpenFriends,
  onOpenActivityFeed, onViewAllFlightCases,
}: HomeScreenProps) {
  const { user } = useAuth();
  const { accent, isVoltageSag } = useTheme();
  const cv = useCV();
  const [myRooms, setMyRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

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

  // Poll unread notification count
  useEffect(() => {
    const fetchUnread = () => {
      notificationApi.unreadCount()
        .then((res) => setUnreadCount(res.count ?? 0))
        .catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

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
              tintColor={accent}
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
                  <Ionicons name="flash" size={12} color={isVoltageSag ? accent : palette.green} />
                  <LEDReadout value={String(cv.balance)} size="sm" variant={isVoltageSag ? 'amber' : 'ice'} />
                </View>

                {/* Friends (Patch Bay) */}
                <TouchableOpacity
                  onPress={onOpenFriends}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open friends"
                >
                  <Ionicons name="people-outline" size={20} color={palette.silver} />
                </TouchableOpacity>

                {/* Activity Feed (Signal Monitor) */}
                <TouchableOpacity
                  onPress={onOpenActivityFeed}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Activity feed"
                >
                  <Ionicons name="pulse-outline" size={20} color={palette.silver} />
                </TouchableOpacity>

                {/* Notification bell */}
                <TouchableOpacity
                  onPress={() => setShowNotifications(true)}
                  style={styles.headerIconBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                >
                  <Ionicons
                    name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                    size={20}
                    color={unreadCount > 0 ? accent : palette.silver}
                  />
                  {unreadCount > 0 && (
                    <View style={styles.notifBadge}>
                      <Text style={styles.notifBadgeText}>
                        {unreadCount > 9 ? '9+' : String(unreadCount)}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Profile avatar */}
                <TouchableOpacity
                  onPress={onOpenProfile}
                  style={styles.avatarBtn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
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
              <ModuleFaceplate label="ACTIVE PATCH" screws>
                <TouchableOpacity
                  style={styles.liveCard}
                  onPress={() => onOpenRoom(liveRoom.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Open live room: ${liveRoom.name}`}
                >
                {/* Listener count */}
                <View style={styles.liveCardHeader}>
                  <StatusLight variant="pulse" color="red" size="sm" />
                  <LEDReadout value={`${liveRoom.listeners?.length || 0}/10`} size="sm" variant="ice" style={styles.listenerCount} />
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
                  <View style={[styles.playBtnSmall, {
                    backgroundColor: accent,
                    shadowColor: accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 6,
                  }]}>
                    <Ionicons name="play" size={20} color={palette.void} style={{ marginLeft: 2 }} />
                  </View>
                </View>
              </TouchableOpacity>
              </ModuleFaceplate>
            ) : (
              /* Empty state — no live connection */
              <ModuleFaceplate label="NO SIGNAL">
                <TouchableOpacity
                  style={styles.emptyLiveCard}
                  onPress={onCreateSession}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Create a new session"
                >
                <View style={styles.emptyLiveInner}>
                  <Ionicons name="radio-outline" size={28} color={palette.slate} />
                  <Text style={styles.emptyLiveText}>No active patch.</Text>
                  <Text style={styles.emptyLiveSubtext}>
                    Initialize a new signal to start listening.
                  </Text>
                </View>
              </TouchableOpacity>
              </ModuleFaceplate>
            )}
          </ADSRFadeIn>

          {/* ═══ NETWORK FORECAST (AI) ═══════════════════════ */}
          <ADSRFadeIn index={2}>
            <NetworkForecastCard />
          </ADSRFadeIn>

          {/* ═══ RECENT FLIGHT CASES ═════════════════════════ */}
          <ADSRFadeIn index={3}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>RECENT FLIGHT CASES</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={onViewAllFlightCases}
                accessibilityRole="button"
                accessibilityLabel="View all flight cases"
              >
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
                renderItem={({ item, index }) => (
                  <ADSRFadeIn index={index} staggerMs={60} slideFrom="right">
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
                  </ADSRFadeIn>
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

      {/* Notification Drawer Modal */}
      <NotificationDrawer
        visible={showNotifications}
        onClose={() => {
          setShowNotifications(false);
          // Refresh unread count after closing
          notificationApi.unreadCount()
            .then((res) => setUnreadCount(res.count ?? 0))
            .catch(() => {});
        }}
        onOpenRoom={onOpenRoom}
      />
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
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.sm,
    color: palette.orange,
    letterSpacing: ls.wide,
  },
  appName: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['2xl'],
    color: palette.frost,
    letterSpacing: ls.wider,
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
    backgroundColor: colors.statusSuccessSubtle,
    borderWidth: 1,
    borderColor: colors.statusSuccessBorder,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.frost,
    fontWeight: '700',
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
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.slate,
    letterSpacing: ls.wider,
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
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.silver,
    letterSpacing: ls.wide,
  },

  // ─── Live Connection Card ─────────────────────────────
  liveCard: {
    padding: 4,
  },
  liveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  listenerCount: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveRoomName: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['3xl'],
    color: palette.frost,
    marginBottom: 10,
  },
  liveTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveTrackTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.frost,
    marginBottom: 2,
  },
  liveTrackArtist: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.silver,
  },
  playBtnSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  // ─── Empty Live State ─────────────────────────────────
  emptyLiveCard: {
  },
  emptyLiveInner: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyLiveText: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.silver,
    marginTop: 10,
  },
  emptyLiveSubtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
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
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: palette.frost,
    marginBottom: 2,
  },
  flightCaseDate: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.slate,
  },
  emptyFlightCases: {
    backgroundColor: colors.skeleton,
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  emptyFlightCaseText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.slate,
    textAlign: 'center',
  },
});

export default HomeScreen;
