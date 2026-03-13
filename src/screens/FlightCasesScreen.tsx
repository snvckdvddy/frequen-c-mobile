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
    borderRadius: 26,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 4,
    backgroundColor: palette.steel,
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
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Signal Matrix</Text>
                <Text style={styles.subtitle}>PHYSICAL PATCH BAY ROUTING</Text>
              </View>
              <TouchableOpacity
                onPress={onOpenProfile}
                activeOpacity={0.7}
                style={styles.profileBtn}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <Ionicons name="person-outline" size={20} color={palette.silver} />
              </TouchableOpacity>
            </View>
          </ADSRFadeIn>

          {/* ═══ Patch Bay Panel ═══════════════════════════ */}
          <ADSRFadeIn index={1}>
            <ModuleFaceplate label="PATCH BAY" screws style={styles.patchBayPanel}>
              {/* Column headers */}
              <View style={styles.patchBayHeaders}>
                <Text style={styles.patchBayHeaderText}>OUTPUTS</Text>
                <Text style={styles.patchBayHeaderText}>INPUTS</Text>
              </View>

              {/* Row 1 */}
              <View style={styles.patchBayRow}>
                <PatchJack label="SPOTIFY" connected />
                <PatchJack label="LIVE ROOM" connected />
              </View>

              {/* Row 2 */}
              <View style={styles.patchBayRow}>
                <PatchJack label="TAPE 01" />
                <PatchJack label="BOUNCE" />
              </View>

              {/* Instruction */}
              <Text style={styles.patchBayInstruction}>
                CLICK JACKS TO PATCH SIGNALS
              </Text>
            </ModuleFaceplate>
          </ADSRFadeIn>

          {/* ═══ DATA CARTRIDGES (Session History) ════════ */}
          <ADSRFadeIn index={2}>
            <ModuleFaceplate label="DATA CARTRIDGES" screws>
              {historyLoading ? (
                <View style={styles.loadingCenter}>
                  <ActivityIndicator color={accent} size="small" />
                </View>
              ) : sessionHistory.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {sessionHistory.map((session) => (
                    <TouchableOpacity
                      key={session.id}
                      style={styles.cartridgeCard}
                      onPress={() => setLoreSession(session)}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Session: ${session.name}`}
                      accessibilityHint={`Saved ${session.createdAt?.split('T')[0]}. Double tap to view archive detail.`}
                    >
                      {/* Red left accent */}
                      <View style={styles.cartridgeAccent} />
                      <View style={styles.cartridgeContent}>
                        <Text style={styles.cartridgeName}>{session.name}</Text>
                        <Text style={styles.cartridgeMeta}>
                          SAVED: {(session.endedAt || session.createdAt)?.split('T')[0] || 'Unknown'} · {session.tracksPlayedCount ?? (session.queue.length + (session.currentTrack ? 1 : 0))} PLAYED
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.loreBadge} activeOpacity={0.7} onPress={() => setLoreSession(session)} accessibilityRole="button" accessibilityLabel="View session lore" accessibilityHint="Double tap to see additional session information">
                        <Ionicons name="sparkles" size={10} color={accent} />
                        <Text style={[styles.loreBadgeText, { color: accent }]}>SESSION LORE</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCartridges}>
                  <Ionicons name="disc-outline" size={28} color={palette.slate} />
                  <Text style={styles.emptyText}>No data cartridges yet.</Text>
                  <Text style={styles.emptySubtext}>
                    Session archives will appear here after completed sessions.
                  </Text>
                </View>
              )}
            </ModuleFaceplate>
          </ADSRFadeIn>

          {/* ═══ LIKED TRACKS ═════════════════════════════ */}
          <ADSRFadeIn index={3}>
            <CollapsibleSection
              title="LIKED TRACKS"
              count={favTracks.length}
              defaultOpen={favTracks.length > 0}
            >
              {favTracks.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="heart-outline" size={24} color={palette.slate} />
                  <Text style={styles.emptySubtext}>
                    Heart tracks during a session to save them here.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 4 }}>
                  {favTracks.map((track) => (
                    <TrackListItem
                      key={track.id}
                      title={track.title}
                      artist={track.artist}
                      albumArt={track.albumArt}
                      duration={track.duration}
                      onPress={() => Alert.alert(track.title, `${track.artist}${track.duration ? ` · ${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : ''}`)}
                    />
                  ))}
                </View>
              )}
            </CollapsibleSection>
          </ADSRFadeIn>

          {/* ═══ COLLECTIONS (Coming Soon) ════════════════ */}
          <ADSRFadeIn index={4}>
            <CollapsibleSection title="COLLECTIONS" count={0}>
              <View style={styles.emptySection}>
                <Ionicons name="folder-open-outline" size={24} color={palette.slate} />
                <Text style={styles.emptySubtext}>
                  Organize sessions and tracks into collections.
                </Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>COMING SOON</Text>
                </View>
              </View>
            </CollapsibleSection>
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
    marginBottom: spacing.lg,
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
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  // Patch Bay Panel
  patchBayPanel: {
    marginBottom: spacing.xl,
  },
  patchBayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  patchBayHeaderText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.wider,
  },
  patchBayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  patchBayInstruction: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    color: palette.slate,
    letterSpacing: ls.wide,
    textAlign: 'center',
    marginTop: 4,
  },

  // Section labels
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.slate,
    letterSpacing: ls.wider,
    marginBottom: 12,
    marginTop: spacing.md,
  },

  // Data Cartridge cards
  cartridgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.midnight,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    overflow: 'hidden',
  },
  cartridgeAccent: {
    width: 3,
    height: '100%',
    backgroundColor: palette.red,
  },
  cartridgeContent: {
    flex: 1,
    padding: 14,
  },
  cartridgeName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: palette.frost,
    marginBottom: 4,
  },
  cartridgeMeta: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    letterSpacing: ls.normal,
  },
  loreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.accentPrimarySubtle,
    borderWidth: 1,
    borderColor: colors.accentPrimarySubtle,
    marginRight: 12,
  },
  loreBadgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    color: palette.orange,
    letterSpacing: ls.normal,
  },

  // Empty states
  emptyCartridges: {
    alignItems: 'center',
    paddingVertical: 32,
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
  emptySection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  comingSoonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    marginTop: 4,
  },
  comingSoonText: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    color: palette.slate,
    letterSpacing: ls.wider,
  },
  loadingCenter: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});

export default FlightCasesScreen;
