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
import { Text, SafeScreen, ADSRFadeIn, ErrorState, AudioMeter } from '../components/ui';
import { NetworkForecastCard } from '../components/home/NetworkForecastCard';
import { NotificationDrawer } from '../components/NotificationDrawer';
import { ArchiveSessionModal } from '../components/ArchiveSessionModal';
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
import PowerRoutingSheet from '../features/power-routing/PowerRoutingSheet';

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
  const [archivePreview, setArchivePreview] = useState<Session | null>(null);
  const [powerRoutingOpen, setPowerRoutingOpen] = useState(false);

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

          {/* ═══ TOP BAR — F-C FREQUEN-C  ⚡145  [avatar] ══ */}
          {/* ═══ TOP BAR — GLOBAL RADAR ═ */}
          <ADSRFadeIn index={0}>
            <View style={styles.topBar}>
              <View style={styles.logoGroup}>
                <Text style={styles.radarTitle}>GLOBAL RADAR</Text>
                <Text style={styles.radarSubtitle}>SCANNING FREQUENCIES...</Text>
              </View>

              <View style={styles.topBarRight}>
                {/* CV Balance pill (Tactical Cyan) */}
                <TouchableOpacity
                  style={styles.cvTacticalBadge}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  onPress={() => setPowerRoutingOpen(true)}
                >
                  <Text style={styles.cvTacticalText}>⚡ {cv.balance}V</Text>
                </TouchableOpacity>

                {/* Profile / Notifications can be reached via other means, or we can keep a minimal avatar */}
                <TouchableOpacity
                  onPress={onOpenProfile}
                  style={styles.avatarBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-outline" size={16} color={palette.silver} />
                </TouchableOpacity>
              </View>
            </View>
          </ADSRFadeIn>

          {/* ═══ ACTIVE PATCH (Live) ══════════════════════════════ */}
          <ADSRFadeIn index={1}>
            <View style={styles.tacticalSectionHeader}>
              <View style={[styles.tacticalSectionBarGreen, { backgroundColor: '#39FF14' }]} />
              <Text style={[styles.tacticalSectionLabelGreen, { color: '#39FF14' }]}>ACTIVE PATCH</Text>
            </View>

            {liveRoom ? (
              <TouchableOpacity
                style={styles.activePatchCard}
                onPress={() => onOpenRoom(liveRoom.id)}
                activeOpacity={0.8}
              >
                <View style={styles.activePatchHeader}>
                  <Text style={styles.activePatchTitle} numberOfLines={1}>{liveRoom.name}</Text>
                  <View style={styles.liveRecBadge}>
                    <Text style={styles.liveRecText}>LIVE REC</Text>
                  </View>
                </View>

                <View style={styles.activePatchBody}>
                  {liveRoom.currentTrack?.albumArt ? (
                    <Image
                      source={{ uri: liveRoom.currentTrack.albumArt }}
                      style={styles.activePatchArt}
                    />
                  ) : (
                    <View style={[styles.activePatchArt, { backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="musical-notes" size={24} color="#333" />
                    </View>
                  )}
                  <View style={styles.activePatchInfo}>
                    <Text style={styles.activePatchTrackTitle} numberOfLines={1}>
                      {liveRoom.currentTrack?.title || 'No track playing'}
                    </Text>
                    <Text style={styles.activePatchTrackArtist} numberOfLines={1}>
                      {liveRoom.currentTrack?.artist || 'Add a track to start'}
                    </Text>
                  </View>
                  {/* Real bouncing audio meter */}
                  <View style={styles.fakeFreqBars}>
                    <AudioMeter bars={4} width={40} height={24} color="#39FF14" gap={2} />
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.activePatchCard, { borderColor: '#333', opacity: 0.7 }]}
                onPress={onCreateSession}
                activeOpacity={0.8}
              >
                <View style={[styles.activePatchInner, { padding: 24, alignItems: 'center' }]}>
                  <Ionicons name="radio-outline" size={28} color="#666" />
                  <Text style={[styles.activePatchTitle, { color: '#666', marginTop: 10 }]}>No Active Patch</Text>
                  <Text style={styles.activePatchTrackArtist}>Tap to create a new live room</Text>
                </View>
              </TouchableOpacity>
            )}
          </ADSRFadeIn>

          {/* ═══ NETWORK FORECAST (AI) ═══════════════════════ */}
          <ADSRFadeIn index={2}>
            <NetworkForecastCard />
          </ADSRFadeIn>

          {/* ═══ AVAILABLE FREQUENCIES (Grid) ═══════════════════════ */}
          <ADSRFadeIn index={3}>
            <View style={[styles.tacticalSectionHeader, { marginTop: spacing.xl }]}>
              <Text style={[styles.tacticalSectionLabel, { borderLeftWidth: 4, borderLeftColor: '#666', paddingLeft: 8 }]}>FREQUENCY TUNER</Text>
            </View>

            <View style={styles.tunerBlock}>
              <View style={styles.tunerDisplay}>
                <TouchableOpacity style={styles.tBtn} activeOpacity={0.7}><Text style={styles.tBtnText}>◀</Text></TouchableOpacity>
                <Text style={styles.tValue}>BASS // 140</Text>
                <TouchableOpacity style={styles.tBtn} activeOpacity={0.7}><Text style={styles.tBtnText}>▶</Text></TouchableOpacity>
              </View>
              <View style={styles.tunerTicks}>
                <View style={[styles.tick, styles.tickMajor]} /><View style={styles.tick} /><View style={styles.tick} /><View style={styles.tick} />
                <View style={[styles.tick, styles.tickMajor]} /><View style={styles.tick} /><View style={styles.tick} /><View style={styles.tick} />
                <View style={[styles.tick, styles.tickMajor]} /><View style={styles.tick} /><View style={styles.tick} /><View style={styles.tick} />
                <View style={[styles.tick, styles.tickMajor]} />
              </View>
            </View>

            {archiveRooms.length > 0 ? (
              <View style={styles.tacticalGrid}>
                {archiveRooms.slice(0, 4).map((item, index) => {
                  const isLiveValue = (item.tracksPlayedCount ?? 0) === 0; // Using tracksPlayedCount as mock logic for OPEN FLR / CAMPFIRE
                  const modeText = isLiveValue ? 'OPEN FLR' : 'ARCHIVED';
                  const themeColor = isLiveValue ? '#00E5FF' : '#FF4500';
                  const dotColor = isLiveValue ? '#FF4500' : '#666';

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.radarNode}
                      onPress={() => setArchivePreview(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.rHead}>
                        <View style={[styles.rDot, { backgroundColor: dotColor, shadowColor: dotColor, shadowOpacity: dotColor === '#FF4500' ? 1 : 0, shadowRadius: 8 }]} />
                        <Text style={styles.rUsers}>{item.listeners?.length || 0} USERS</Text>
                      </View>
                      <Text style={styles.rTitle} numberOfLines={1}>{item.name}</Text>
                      
                      <Text style={[styles.rMeta, { color: themeColor, borderColor: themeColor }]}>
                        {modeText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyFlightCases}>
                <Text style={styles.emptyFlightCaseText}>
                  No frequencies detected.
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
      <ArchiveSessionModal
        session={archivePreview}
        onClose={() => setArchivePreview(null)}
      />
      <PowerRoutingSheet
        visible={powerRoutingOpen}
        voltage={cv.balance}
        onClose={() => setPowerRoutingOpen(false)}
        onExecute={() => setPowerRoutingOpen(false)}
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
    paddingTop: spacing.md,
  },
  errorContainer: {
    marginBottom: spacing.lg,
  },

  // ─── Tactical Top Bar ─────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  logoGroup: {
    flexDirection: 'column',
    flex: 1,
  },
  radarTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 28,
    color: palette.frost,
    letterSpacing: 1,
  },
  radarSubtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.green,
    letterSpacing: 2,
    marginTop: 4,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cvTacticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'cyan',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cvTacticalText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: 'cyan',
    fontWeight: '700',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 2, // Slightly boxy for tactical vibe
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    backgroundColor: palette.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Tactical Section Headers ─────────────────────────
  tacticalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: spacing.md,
  },
  tacticalSectionBarGreen: {
    width: 4,
    height: 14,
    backgroundColor: palette.green,
    marginRight: 8,
  },
  tacticalSectionLabelGreen: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: palette.green,
    letterSpacing: 2,
  },
  tacticalSectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: palette.slate,
    letterSpacing: 2,
  },

  // ─── ACTIVE PATCH Widget ──────────────────────────────
  activePatchCard: {
    borderWidth: 1,
    borderColor: '#39FF14',
    backgroundColor: '#111111',
    marginBottom: 32,
    flexDirection: 'column',
  },
  activePatchInner: {},
  activePatchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#0A0A0A',
  },
  activePatchTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 20,
    color: '#39FF14',
    textTransform: 'uppercase',
  },
  liveRecBadge: {
    backgroundColor: '#39FF14',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveRecText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#000000',
    fontWeight: 'bold',
  },
  activePatchBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  activePatchArt: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: '#333',
  },
  activePatchInfo: {
    flex: 1,
    gap: 4,
  },
  activePatchTrackTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  activePatchTrackArtist: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666666',
  },
  fakeFreqBars: {
    marginLeft: 'auto',
  },
  
  // ─── Tactical Grid ────────────────────────────────────
  tunerBlock: {
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111111',
    marginBottom: 24,
  },
  tunerDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tBtn: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.mono,
  },
  tValue: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    color: '#00E5FF',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,229,255,0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  tunerTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    opacity: 0.5,
  },
  tick: {
    width: 2,
    height: 8,
    backgroundColor: '#666666',
  },
  tickMajor: {
    height: 16,
    backgroundColor: '#00E5FF',
  },
  tacticalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  radarNode: {
    width: '48%',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#333',
    padding: 12,
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  rHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rDot: {
    width: 8,
    height: 8,
  },
  rUsers: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666666',
  },
  rTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  rMeta: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },

  emptyFlightCases: {
    padding: 24,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
  },
  emptyFlightCaseText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: palette.slate,
  },
});

export default HomeScreen;
