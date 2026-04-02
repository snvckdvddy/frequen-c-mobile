/**
 * @archived 2026-03-30 — replaced by LibraryScreen.tsx
 * DO NOT import or render. Retained for reference only.
 * Relative imports assume placement in src/screens/_archive/.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, showToast } from '../components/ui';
import { ArchiveSessionModal } from '../components/ArchiveSessionModal';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { sessionApi } from '../services/api';
import { VoidSurface } from '../design/components';
import type { FavoriteTrack, Session } from '../types';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import {
  formatModeLabel,
  getModeBlockColors,
  tacticalTokens,
} from '../features/session-v2/theme/tacticalTokens';
import { tapLight } from '../utils/haptics';

interface FlightCasesScreenProps {
  onOpenRoom?: (sessionId: string) => void;
  onOpenProfile?: () => void;
}

function MonoText({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.summaryChip}>
      <MonoText style={[styles.summaryValue, { color: accent }]}>
        {String(value).padStart(2, '0')}
      </MonoText>
      <MonoText style={styles.summaryLabel}>{label}</MonoText>
    </View>
  );
}

function SectionHeader({
  label,
  accent,
}: {
  label: string;
  accent: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionBar, { backgroundColor: accent }]} />
      <MonoText style={[styles.sectionLabel, { color: accent }]}>{label}</MonoText>
    </View>
  );
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return 'NO STAMP';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'JUST NOW';
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  return `${Math.floor(days / 7)}W AGO`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return 'RAW';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function FavoriteLogCard({
  favorite,
  onRemove,
}: {
  favorite: FavoriteTrack;
  onRemove: (trackId: string, title: string) => void;
}) {
  const track = favorite.track;

  return (
    <View style={styles.logCard}>
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={styles.logArt} />
      ) : (
        <View style={[styles.logArt, styles.logArtGhost]}>
          <Ionicons name="disc-outline" size={18} color={tacticalTokens.colors.textMuted} />
        </View>
      )}

      <View style={styles.logMeta}>
        <MonoText style={styles.logEyebrow}>DATA LOG</MonoText>
        <MonoText style={styles.logTitle} numberOfLines={1}>{track.title.toUpperCase()}</MonoText>
        <MonoText style={styles.logSub} numberOfLines={1}>
          {track.artist.toUpperCase()} // {formatDuration(track.duration)} // SAVED {formatTimeAgo(favorite.savedAt)}
        </MonoText>
      </View>

      <Pressable
        onPress={() => {
          tapLight();
          onRemove(track.id, track.title);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${track.title} from archive logs`}
        style={({ pressed }) => [styles.logAction, pressed && styles.pressed]}
      >
        <Ionicons name="heart" size={18} color={tacticalTokens.colors.hotPink} />
      </Pressable>
    </View>
  );
}

function FlightCaseCard({
  session,
  onPress,
}: {
  session: Session;
  onPress: () => void;
}) {
  const modeColors = getModeBlockColors(session.roomMode);
  const trackCount = session.tracksPlayedCount ?? (session.queue.length + (session.currentTrack ? 1 : 0));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open flight case ${session.name}`}
      style={({ pressed }) => [styles.caseCard, pressed && styles.pressed]}
    >
      <View style={styles.caseIndexRail}>
        <MonoText style={styles.caseIndex}>{session.joinCode?.toUpperCase() || 'CASE'}</MonoText>
      </View>

      <View style={styles.caseBody}>
        <View style={styles.caseTopRow}>
          <View style={styles.caseTitleWrap}>
            <MonoText style={styles.caseEyebrow}>FLIGHT CASE</MonoText>
            <MonoText style={styles.caseTitle} numberOfLines={1}>{session.name.toUpperCase()}</MonoText>
          </View>
          <View
            style={[
              styles.caseModeChip,
              { backgroundColor: modeColors.backgroundColor, borderColor: modeColors.borderColor },
            ]}
          >
            <MonoText style={[styles.caseModeText, { color: modeColors.color }]}>
              {formatModeLabel(session.roomMode)}
            </MonoText>
          </View>
        </View>

        <View style={styles.caseMetaRow}>
          <MonoText style={styles.caseMetaText}>
            {String(trackCount).padStart(2, '0')} TRACKS // {formatTimeAgo(session.endedAt || session.createdAt)}
          </MonoText>
          <Ionicons name="open-outline" size={16} color={tacticalTokens.colors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

export function FlightCasesScreen({ onOpenProfile }: FlightCasesScreenProps) {
  const { favorites, removeFavorite, isLoaded } = useFavoritesContext();
  const [refreshing, setRefreshing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [archivePreview, setArchivePreview] = useState<Session | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      setSessionHistory(sessions.filter((session) => !session.isLive));
      setHistoryError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ARCHIVE BUS OFFLINE';
      setHistoryError(message.toUpperCase());
    } finally {
      setHistoryLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchHistory();
  }, [fetchHistory]);

  const stats = useMemo(() => {
    const archivedTracks = sessionHistory.reduce((sum, session) => {
      return sum + (session.tracksPlayedCount ?? (session.queue.length + (session.currentTrack ? 1 : 0)));
    }, 0);

    return {
      logs: favorites.length,
      cases: sessionHistory.length,
      tracks: archivedTracks,
    };
  }, [favorites.length, sessionHistory]);

  const sortedFavorites = useMemo(
    () => [...favorites].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()),
    [favorites],
  );

  const handleRemoveFavorite = useCallback((trackId: string, title: string) => {
    removeFavorite(trackId);
    showToast(`${title} removed from data logs.`, 'success', '!');
  }, [removeFavorite]);

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.58} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={tacticalTokens.colors.acid}
              />
            )}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.headerTextWrap}>
                <MonoText style={styles.eyebrow}>SYS.FREQ // ARCHIVE BUS</MonoText>
                <MonoText style={styles.title}>FLIGHT CASES</MonoText>
                <MonoText style={styles.subtitle}>
                  Saved data logs and archived room cases routed into one tactical archive surface.
                </MonoText>
              </View>

              {onOpenProfile ? (
                <Pressable
                  onPress={onOpenProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                  style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
                >
                  <Ionicons name="person-outline" size={18} color={tacticalTokens.colors.white} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.summaryRow}>
              <SummaryChip label="LOGS" value={stats.logs} accent={tacticalTokens.colors.hotPink} />
              <SummaryChip label="CASES" value={stats.cases} accent={tacticalTokens.colors.ice} />
              <SummaryChip label="TRACKS" value={stats.tracks} accent={tacticalTokens.colors.acid} />
            </View>

            <SectionHeader label="DATA LOGS" accent={tacticalTokens.colors.hotPink} />
            {!isLoaded ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={tacticalTokens.colors.hotPink} />
              </View>
            ) : sortedFavorites.length > 0 ? (
              <View style={styles.stack}>
                {sortedFavorites.map((favorite) => (
                  <FavoriteLogCard
                    key={favorite.track.id}
                    favorite={favorite}
                    onRemove={handleRemoveFavorite}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="heart-outline" size={36} color={tacticalTokens.colors.textMuted} />
                <MonoText style={styles.emptyTitle}>NO DATA LOGS</MonoText>
                <MonoText style={styles.emptyText}>
                  Favorited tracks will be archived here as reusable signal references.
                </MonoText>
              </View>
            )}

            <SectionHeader label="FLIGHT CASES" accent={tacticalTokens.colors.ice} />
            {historyLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={tacticalTokens.colors.ice} />
              </View>
            ) : sessionHistory.length > 0 ? (
              <View style={styles.stack}>
                {sessionHistory.map((session) => (
                  <FlightCaseCard
                    key={session.id}
                    session={session}
                    onPress={() => setArchivePreview(session)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="folder-open-outline" size={36} color={tacticalTokens.colors.textMuted} />
                <MonoText style={styles.emptyTitle}>NO FLIGHT CASES</MonoText>
                <MonoText style={styles.emptyText}>
                  Finished sessions will archive here once the room goes dark.
                </MonoText>
              </View>
            )}

            {historyError ? (
              <View style={styles.errorRail}>
                <Ionicons name="warning-outline" size={16} color={tacticalTokens.colors.orange} />
                <MonoText style={styles.errorText}>{historyError}</MonoText>
              </View>
            ) : null}

            <View style={{ height: tacticalTokens.spacing.xxxl * 2 }} />
          </ScrollView>
        </View>

        <ArchiveSessionModal
          session={archivePreview}
          onClose={() => setArchivePreview(null)}
        />
      </VoidSurface>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.md,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.hero,
    color: tacticalTokens.colors.white,
  },
  subtitle: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.lg,
    marginBottom: tacticalTokens.spacing.lg,
  },
  summaryChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  summaryValue: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
  },
  summaryLabel: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.md,
  },
  sectionBar: {
    width: 4,
    height: 18,
  },
  sectionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    letterSpacing: 1.8,
  },
  stack: {
    gap: tacticalTokens.spacing.sm,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.92)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  logArt: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  logArtGhost: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logMeta: {
    flex: 1,
    minWidth: 0,
  },
  logEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.4,
  },
  logTitle: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  logSub: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  logAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  caseCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.92)',
    overflow: 'hidden',
  },
  caseIndexRail: {
    width: 64,
    borderRightWidth: 1,
    borderRightColor: tacticalTokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.matte,
    paddingVertical: tacticalTokens.spacing.md,
  },
  caseIndex: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.4,
    transform: [{ rotate: '-90deg' }],
    width: 90,
    textAlign: 'center',
  },
  caseBody: {
    flex: 1,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  caseTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
  },
  caseTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  caseEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.4,
  },
  caseTitle: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  caseModeChip: {
    borderWidth: 1,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: 4,
  },
  caseModeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.3,
  },
  caseMetaRow: {
    marginTop: tacticalTokens.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
  },
  caseMetaText: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  loadingCard: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.92)',
    paddingVertical: tacticalTokens.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(7, 7, 7, 0.84)',
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingVertical: tacticalTokens.spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: tacticalTokens.spacing.md,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  emptyText: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.82,
  },
});

export default FlightCasesScreen;
