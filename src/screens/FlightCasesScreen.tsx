/**
 * Flight Cases Screen — "Signal Matrix" (Gemini V7)
 *
 * Structure:
 *   Signal Matrix                         ← Title (bold)
 *   PHYSICAL PATCH BAY ROUTING            ← Subtitle (monospace)
 *   ┌─────────────────────────────────┐
 *   │  OUTPUTS          INPUTS        │
 *   │  (○) SPOTIFY      (○) LIVE ROOM │   ← Patch bay jack connectors
 *   │  (○) TAPE 01      (○) BOUNCE    │
 *   │  CLICK JACKS TO PATCH SIGNALS   │
 *   └─────────────────────────────────┘
 *   DATA CARTRIDGES                       ← Section label
 *   [archive card] [archive card]         ← Saved sessions / liked tracks
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, LayoutAnimation, Platform, UIManager,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, ADSRFadeIn, TrackListItem } from '../components/ui';
import { ArchiveSessionModal } from '../components/ArchiveSessionModal';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { useTheme } from '../contexts/ThemeContext';
import { sessionApi } from '../services/api';
import { spacing } from '../theme/spacing';
import { VoidSurface, ModuleFaceplate, LEDReadout } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, letterSpacing as ls } from '../design/tokens/typography';
import type { Session, Track, FavoriteTrack, RoomMode } from '../types';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Props ──────────────────────────────────────────────────

interface FlightCasesScreenProps {
  onOpenRoom?: (sessionId: string) => void;
  onOpenProfile?: () => void;
}

// ─── Patch Bay Jack ─────────────────────────────────────────

function PatchJack({ label, connected = false }: { label: string; connected?: boolean }) {
  return (
    <View style={jackStyles.container}>
      <View style={[jackStyles.jack, connected && jackStyles.jackConnected]}>
        <View style={[jackStyles.jackHole, connected && jackStyles.jackHoleConnected]} />
      </View>
      <Text style={jackStyles.label}>{label}</Text>
    </View>
  );
}

const jackStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  jack: {
    width: 52,
    height: 52,
    backgroundColor: palette.midnight,
    borderWidth: 2,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jackConnected: {
    borderColor: palette.ice,
  },
  jackHole: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: palette.slate,
    backgroundColor: 'transparent',
  },
  jackHoleConnected: {
    borderColor: palette.ice,
    backgroundColor: colors.accentSecondarySubtle,
  },
  label: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
});

// ─── Session History (from API) ─────────────────────────────
// Archived sessions (isLive=false) become "Data Cartridges"

// ─── Collapsible Section ────────────────────────────────────

function CollapsibleSection({
  title, count, children, defaultOpen = false,
}: {
  title: string; count: number; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen((prev) => !prev);
  };

  return (
    <View style={sectionStyles.container}>
      <TouchableOpacity
        style={sectionStyles.header}
        onPress={toggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: isOpen }}
        accessibilityHint={`Double tap to ${isOpen ? 'collapse' : 'expand'} ${title}`}
      >
        <Text style={sectionStyles.title}>{title}</Text>
        <LEDReadout value={String(count)} size="sm" variant="ice" />
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={palette.slate}
        />
      </TouchableOpacity>
      {isOpen && <View style={sectionStyles.body}>{children}</View>}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.midnight,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.silver,
    letterSpacing: ls.wide,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  countText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
  },
  body: {
    backgroundColor: palette.steel,
    padding: 12,
  },
});

// ─── Main Screen ────────────────────────────────────────────

export function FlightCasesScreen({ onOpenRoom, onOpenProfile }: FlightCasesScreenProps) {
  const { favorites } = useFavoritesContext();
  const { accent, isVoltageSag } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loreSession, setLoreSession] = useState<Session | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      // Archived sessions (not live) = Data Cartridges
      // Live sessions are shown on HomeScreen, so filter them out here
      const archived = sessions.filter((s) => !s.isLive);
      setSessionHistory(archived);
    } catch {
      // Silently fail — history is non-critical
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const favTracks: Track[] = favorites.map((f: FavoriteTrack) => f.track);

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
          {/* ═══ Header ════════════════════════════════════ */}
          <ADSRFadeIn index={0}>
            <View style={styles.headerRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.tacticalHeaderBar} />
                <Text style={styles.title}>ARCHIVES</Text>
              </View>
              <TouchableOpacity
                onPress={onOpenProfile}
                activeOpacity={0.7}
                style={styles.sysBtn}
              >
                <Text style={styles.sysBtnText}>[ SYS ]</Text>
              </TouchableOpacity>
            </View>
          </ADSRFadeIn>

          {/* ═══ DATA LOGS ═════════════════════════════════ */}
          <ADSRFadeIn index={1}>
            <View style={styles.tacticalSectionHeader}>
              <Text style={styles.tacticalSectionLabelWhite}>DATA LOGS</Text>
            </View>

            <View style={{ gap: 8 }}>
              {favTracks.length > 0 ? (
                favTracks.slice(0, 3).map((track, i) => (
                  <View key={track.id || i} style={styles.dataLogCard}>
                    <View style={styles.dataLogLeft}>
                      <Text style={styles.dataLogTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.dataLogSub} numberOfLines={1}>
                        {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : 'RAW'} · {track.artist}
                      </Text>
                    </View>
                    <Text style={styles.dataLogDate}>ARCHIVED</Text>
                  </View>
                ))
              ) : (
                <>
                  <View style={styles.dataLogCard}>
                    <View style={styles.dataLogLeft}>
                      <Text style={styles.dataLogTitle}>RAW AUDIO STREAM</Text>
                      <Text style={styles.dataLogSub}>102 BPM · 29V</Text>
                    </View>
                    <Text style={styles.dataLogDate}>04.22.25</Text>
                  </View>
                  <View style={styles.dataLogCard}>
                    <View style={styles.dataLogLeft}>
                      <Text style={styles.dataLogTitle}>VOCAL COMP WIP</Text>
                      <Text style={styles.dataLogSub}>-- BPM · 8V</Text>
                    </View>
                    <Text style={styles.dataLogDate}>04.20.25</Text>
                  </View>
                </>
              )}
            </View>
          </ADSRFadeIn>

          {/* ═══ FLIGHT CASES (Session History) ════════ */}
          <ADSRFadeIn index={2}>
            <View style={[styles.tacticalSectionHeader, { marginTop: 32 }]}>
              <Text style={styles.tacticalSectionLabelDim}>FLIGHT CASES</Text>
            </View>

            {historyLoading ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator color={accent} size="small" />
              </View>
            ) : sessionHistory.length > 0 ? (
              <View style={{ gap: 8 }}>
                {sessionHistory.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.flightCaseCard}
                    onPress={() => setLoreSession(session)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.fcIconBox}>
                      <Ionicons name="folder-outline" size={16} color="#666" />
                    </View>
                    <View style={styles.fcContent}>
                      <Text style={styles.fcName} numberOfLines={1}>{session.name}</Text>
                      <Text style={styles.fcMeta}>
                        {session.tracksPlayedCount ?? (session.queue.length + (session.currentTrack ? 1 : 0))} TRKS // ARCHIVED
                      </Text>
                    </View>
                    <View style={styles.fcBadge}>
                      <Ionicons name="download-outline" size={16} color="#666" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCartridges}>
                <Ionicons name="disc-outline" size={28} color={palette.slate} />
                <Text style={styles.emptyText}>No flight cases yet.</Text>
                <Text style={styles.emptySubtext}>
                  Session archives will appear here after completed sessions.
                </Text>
              </View>
            )}
          </ADSRFadeIn>

          <View style={{ height: 120 }} />
        </ScrollView>
        <ArchiveSessionModal session={loreSession} onClose={() => setLoreSession(null)} />
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  sysBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#111',
  },
  sysBtnText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666',
  },

  // Tactical Section Headers
  tacticalSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tacticalHeaderBar: {
    width: 4,
    height: 16,
    backgroundColor: '#FFFFFF',
  },
  tacticalSectionLabelWhite: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    fontWeight: '700',
    borderLeftWidth: 4,
    borderLeftColor: '#FFFFFF',
    paddingLeft: 8,
  },
  tacticalSectionLabelDim: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: '#666666',
    textTransform: 'uppercase',
    fontWeight: '700',
    borderLeftWidth: 4,
    borderLeftColor: '#666666',
    paddingLeft: 8,
  },

  // ─── DATA LOGS ────────────────────────────────────────
  dataLogCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0A0A0A',
  },
  dataLogLeft: {
    flex: 1,
  },
  dataLogTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  dataLogSub: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666666',
  },
  dataLogDate: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666666',
  },

  // ─── FLIGHT CASES ─────────────────────────────────────
  flightCaseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: '#0A0A0A',
  },
  fcIconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fcContent: {
    flex: 1,
  },
  fcName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  fcMeta: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666666',
  },
  fcBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },

  // Empty states
  emptyCartridges: {
    alignItems: 'center',
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  emptyText: {
    fontFamily: fontFamily.display,
    fontSize: 15,
    color: palette.silver,
    marginTop: 10,
  },
  emptySubtext: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: palette.slate,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  loadingCenter: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});

export default FlightCasesScreen;
