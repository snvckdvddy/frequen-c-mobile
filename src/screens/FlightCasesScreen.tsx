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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, ADSRFadeIn, TrackListItem } from '../components/ui';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { sessionApi } from '../services/api';
import { spacing } from '../theme/spacing';
import { VoidSurface } from '../design/components';
import { palette } from '../design/tokens/materials';
import type { Session, Track, FavoriteTrack, RoomMode } from '../types';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Props ──────────────────────────────────────────────────

interface FlightCasesScreenProps {
  onOpenRoom?: (sessionId: string) => void;
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
    backgroundColor: 'rgba(0, 229, 255, 0.10)',
  },
  label: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.slate,
    letterSpacing: 1.5,
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
      >
        <Text style={sectionStyles.title}>{title}</Text>
        <View style={sectionStyles.countBadge}>
          <Text style={sectionStyles.countText}>{count}</Text>
        </View>
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
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.silver,
    letterSpacing: 1.5,
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
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
  },
  body: {
    backgroundColor: palette.steel,
    padding: 12,
  },
});

// ─── Main Screen ────────────────────────────────────────────

export function FlightCasesScreen({ onOpenRoom }: FlightCasesScreenProps) {
  const { favorites } = useFavoritesContext();
  const [refreshing, setRefreshing] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

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
              tintColor={palette.orange}
            />
          }
        >
          {/* ═══ Header ════════════════════════════════════ */}
          <ADSRFadeIn index={0}>
            <Text style={styles.title}>Signal Matrix</Text>
            <Text style={styles.subtitle}>PHYSICAL PATCH BAY ROUTING</Text>
          </ADSRFadeIn>

          {/* ═══ Patch Bay Panel ═══════════════════════════ */}
          <ADSRFadeIn index={1}>
            <View style={styles.patchBayPanel}>
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
            </View>
          </ADSRFadeIn>

          {/* ═══ DATA CARTRIDGES (Session History) ════════ */}
          <ADSRFadeIn index={2}>
            <Text style={styles.sectionLabel}>DATA CARTRIDGES</Text>

            {historyLoading ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator color={palette.orange} size="small" />
              </View>
            ) : sessionHistory.length > 0 ? (
              <View style={{ gap: 8 }}>
                {sessionHistory.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    style={styles.cartridgeCard}
                    onPress={() => onOpenRoom?.(session.id)}
                    activeOpacity={0.8}
                  >
                    {/* Red left accent */}
                    <View style={styles.cartridgeAccent} />
                    <View style={styles.cartridgeContent}>
                      <Text style={styles.cartridgeName}>{session.name}</Text>
                      <Text style={styles.cartridgeMeta}>
                        SAVED: {session.createdAt?.split('T')[0] || 'Unknown'} · {session.queue?.length || 0} TRACKS
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.loreBadge} activeOpacity={0.7}>
                      <Ionicons name="sparkles" size={10} color={palette.orange} />
                      <Text style={styles.loreBadgeText}>SESSION LORE</Text>
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
                      onPress={() => {}}
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

  // Patch Bay Panel
  patchBayPanel: {
    backgroundColor: palette.midnight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    padding: 20,
    marginBottom: spacing.xl,
  },
  patchBayHeaders: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  patchBayHeaderText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
    letterSpacing: 2,
  },
  patchBayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  patchBayInstruction: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 8,
    color: palette.slate,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 4,
  },

  // Section labels
  sectionLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    color: palette.slate,
    letterSpacing: 2,
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
    fontFamily: 'ChakraPetch-Bold',
    fontSize: 15,
    color: palette.frost,
    marginBottom: 4,
  },
  cartridgeMeta: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.slate,
    letterSpacing: 1,
  },
  loreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.20)',
    marginRight: 12,
  },
  loreBadgeText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 8,
    color: palette.orange,
    letterSpacing: 1,
  },

  // Empty states
  emptyCartridges: {
    alignItems: 'center',
    paddingVertical: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 15,
    color: palette.silver,
    marginTop: 10,
  },
  emptySubtext: {
    fontFamily: 'ChakraPetch-Regular',
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
    fontFamily: 'SpaceMono-Regular',
    fontSize: 8,
    color: palette.slate,
    letterSpacing: 2,
  },
  loadingCenter: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});

export default FlightCasesScreen;
