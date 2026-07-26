/**
 * Library Screen — User's personal music & session history.
 *
 * Three segments:
 *   Liked    — local Frequen-C favorites (FavoritesContext)
 *   Playlists — streaming service playlists (adapter library methods)
 *   History  — archived session history (backend API)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, ADSRFadeIn, TrackListItem, ErrorState, TrackCardSkeleton, showToast } from '../components/ui';
import { ServiceSelectorPills } from '../components/library/ServiceSelectorPills';
import { PlaylistList } from '../components/library/PlaylistList';
import { PlaylistTrackList } from '../components/library/PlaylistTrackList';
import { ArchiveSessionModal } from '../components/ArchiveSessionModal';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGlobalSessionRoom } from '../contexts/GlobalSessionRoomContext';
import { useLibraryBrowse } from '../hooks/useLibraryBrowse';
import { sessionApi } from '../services/api';
import { addToQueue } from '../services/socket';
import {
  importLocalTracks, listLocalTracks, removeLocalTrack, localRecordToTrack,
  type LocalTrackRecord,
} from '../services/localLibrary';
import { VoidSurface } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { spacing } from '../theme/spacing';
import type { Track, Session, RoomMode, QueueTrack } from '../types';

// ─── Segment Tabs ────────────────────────────────────────────

type Segment = 'liked' | 'playlists' | 'history' | 'local';

interface SegmentTabsProps {
  active: Segment;
  onChange: (s: Segment) => void;
}

function SegmentTabs({ active, onChange }: SegmentTabsProps) {
  const { accent } = useTheme();

  const tabs: { key: Segment; label: string; icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'liked', label: 'Liked', icon: 'heart-outline', iconActive: 'heart' },
    { key: 'playlists', label: 'Playlists', icon: 'albums-outline', iconActive: 'albums' },
    { key: 'local', label: 'Local', icon: 'folder-open-outline', iconActive: 'folder-open' },
    { key: 'history', label: 'History', icon: 'time-outline', iconActive: 'time' },
  ];

  return (
    <View style={segStyles.row}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.key}
          style={[segStyles.tab, active === tab.key && [segStyles.tabActive, { borderColor: accent }]]}
          onPress={() => onChange(tab.key)}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityLabel={`${tab.label} tab`}
          accessibilityState={{ selected: active === tab.key }}
        >
          <Ionicons
            name={active === tab.key ? tab.iconActive : tab.icon}
            size={16}
            color={active === tab.key ? accent : palette.slate}
          />
          <Text
            variant="label"
            color={active === tab.key ? accent : palette.slate}
            style={{ marginLeft: 6 }}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const segStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  tabActive: {
    backgroundColor: colors.accentPrimarySubtle,
  },
});

// ─── Session History Types ───────────────────────────────────

interface PastSession {
  id: string;
  name: string;
  hostUsername: string;
  roomMode: RoomMode;
  tracksPlayed: number;
  date: string;
  session: Session;
}

function formatTimeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

const modeIcons: Record<RoomMode, keyof typeof Ionicons.glyphMap> = {
  campfire: 'bonfire-outline',
  spotlight: 'flashlight-outline',
  openFloor: 'people-outline',
};

// ─── History Card ──────────────────────────────────────────────

function HistoryCard({ session, onPress }: { session: PastSession; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={histStyles.card}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${session.name} session, hosted by ${session.hostUsername}, ${session.tracksPlayed} tracks played`}
      accessibilityHint="Double tap to open this session"
    >
      <View style={histStyles.iconWrap}>
        <Ionicons name={modeIcons[session.roomMode]} size={20} color={palette.silver} />
      </View>
      <View style={histStyles.info}>
        <Text variant="label" color={palette.frost} numberOfLines={1}>
          {session.name}
        </Text>
        <Text variant="bodySmall" color={palette.silver} numberOfLines={1}>
          {session.hostUsername} · {session.tracksPlayed} tracks
        </Text>
      </View>
      <Text variant="labelSmall" color={palette.slate}>{session.date}</Text>
    </TouchableOpacity>
  );
}

const histStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40, height: 40,
    backgroundColor: palette.midnight,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
});

// ─── Main Component ───────────────────────────────────────────

interface LibraryScreenProps {
  onOpenRoom?: (sessionId: string) => void;
  initialSegment?: Segment;
  route?: { params?: { initialSegment?: Segment } };
}

export function LibraryScreen({ onOpenRoom, initialSegment, route }: LibraryScreenProps) {
  const resolvedInitialSegment: Segment = route?.params?.initialSegment || initialSegment || 'liked';
  const { favorites, removeFavorite, isLoaded } = useFavoritesContext();
  const { user } = useAuth();
  const { accent } = useTheme();
  const [segment, setSegment] = useState<Segment>(resolvedInitialSegment);

  // Switch segment when navigated to with a different initialSegment param
  useEffect(() => {
    if (route?.params?.initialSegment) {
      setSegment(route.params.initialSegment);
    }
  }, [route?.params?.initialSegment]);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionHistory, setSessionHistory] = useState<PastSession[]>([]);
  const [archivePreview, setArchivePreview] = useState<Session | null>(null);

  // ─── Library browsing (via shared hook) ───────────────────
  const library = useLibraryBrowse({
    connectedServices: user?.connectedServices,
    enableCache: true,
  });

  // ─── History fetch ────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      const history: PastSession[] = sessions
        .filter((s) => !s.isLive)
        .map((s) => ({
          id: s.id,
          name: s.name,
          hostUsername: s.hostId === user?.id ? 'You' : (s.hostUsername || 'Friend'),
          roomMode: s.roomMode,
          tracksPlayed: s.tracksPlayedCount ?? (s.queue.length + (s.currentTrack ? 1 : 0)),
          date: formatTimeAgo(s.endedAt || s.createdAt),
          session: s,
        }));
      setSessionHistory(history);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      setError(message);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (segment === 'playlists') {
      library.refreshPlaylists();
    } else {
      await fetchHistory();
    }
    setRefreshing(false);
  }, [fetchHistory, library, segment]);

  useEffect(() => {
    fetchHistory().then(() => setIsLoading(false));
  }, [fetchHistory]);

  // Sort favorites: most recently saved first
  const sortedFavorites = useMemo(
    () => [...favorites].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()),
    [favorites],
  );

  // ─── Track tap handler (standalone context) ───────────────
  const globalRoom = useGlobalSessionRoom();
  const hasActiveSession = Boolean(globalRoom.session?.isLive);

  const handleTrackPress = useCallback((track: Track) => {
    if (hasActiveSession) {
      showToast('Open the queue in your active session to add tracks', 'info', '!');
    } else {
      showToast(`${track.title} — join or create a room to queue tracks`, 'info', '!');
    }
  }, [hasActiveSession]);

  // ─── Local files (device audio, host-output native path) ──
  const [localTracks, setLocalTracks] = useState<LocalTrackRecord[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    void listLocalTracks().then(setLocalTracks);
  }, []);

  // Local files exist on THIS device, so queueing is host-only: the
  // host's phone is the room's output. Guests queueing their local
  // files needs the auto-host-handoff design pass (known_debt #1).
  const canQueueLocal =
    hasActiveSession && globalRoom.session?.hostId === user?.id;

  const handleImportLocal = useCallback(async () => {
    setImporting(true);
    try {
      const next = await importLocalTracks();
      setLocalTracks(next);
    } catch {
      showToast('Import failed. Try a different file.', 'error', '!');
    } finally {
      setImporting(false);
    }
  }, []);

  const handleRemoveLocal = useCallback(async (id: string) => {
    setLocalTracks(await removeLocalTrack(id));
  }, []);

  const handleQueueLocal = useCallback((rec: LocalTrackRecord) => {
    if (!canQueueLocal || !user || !globalRoom.session) return;
    const track = localRecordToTrack(rec);
    const queueTrack: QueueTrack = {
      ...track,
      addedBy: { userId: user.id, username: user.username },
      addedById: user.id,
      addedAt: new Date().toISOString(),
      votes: 0,
      voltageBoost: 0,
      reactions: [],
    };
    addToQueue(globalRoom.session.id, queueTrack);
    // No inline queue surface exists on this screen, so the toast is
    // the only confirmation channel (allowed per toast policy).
    showToast(`"${rec.title}" queued to ${globalRoom.session.name}.`, 'success', '!');
  }, [canQueueLocal, user, globalRoom.session]);

  const formatDuration = (sec: number): string => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h2" color={palette.frost}>Library</Text>
          {favorites.length > 0 && segment === 'liked' && (
            <Text variant="labelSmall" color={palette.slate}>
              {favorites.length} liked
            </Text>
          )}
        </View>

        {/* Segment Tabs */}
        <SegmentTabs active={segment} onChange={setSegment} />

        {/* ─── Playlists Segment ─────────────────────── */}
        {segment === 'playlists' && (
          <View style={{ flex: 1 }}>
            <ServiceSelectorPills
              connectedServices={library.connectedSources}
              selectedService={library.selectedService}
              onSelectService={library.selectService}
            />

            {library.connectedSources.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="link-outline" size={48} color={palette.slate} />
                <Text variant="body" color={palette.silver} align="center" style={{ marginTop: spacing.sm }}>
                  No services connected
                </Text>
                <Text variant="bodySmall" color={palette.slate} align="center" style={{ marginTop: spacing.xs }}>
                  Connect a streaming service in Settings to browse your playlists
                </Text>
              </View>
            ) : library.selectedPlaylist ? (
              <PlaylistTrackList
                playlist={library.selectedPlaylist}
                tracks={library.tracks}
                loading={library.tracksLoading}
                onTrackPress={handleTrackPress}
                onBack={library.clearPlaylist}
              />
            ) : (
              <PlaylistList
                playlists={library.playlists}
                loading={library.playlistsLoading}
                onSelectPlaylist={library.selectPlaylist}
                onRefresh={library.refreshPlaylists}
                refreshing={refreshing}
              />
            )}
          </View>
        )}

        {/* ─── Liked / History Segments (ScrollView) ── */}
        {segment !== 'playlists' && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={accent}
              />
            }
          >
            {/* ─── Local Files ──────────────────────────── */}
            {segment === 'local' && (
              <ADSRFadeIn index={0}>
                <View style={styles.localHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" color={palette.frost}>Device audio</Text>
                    <Text variant="bodySmall" color={palette.slate}>
                      {canQueueLocal
                        ? 'Plays natively from this phone — no service required.'
                        : 'Host a room to queue local files (they play from the host device).'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => void handleImportLocal()}
                    disabled={importing}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Import audio files"
                    style={[styles.localImportButton, importing && { opacity: 0.5 }]}
                  >
                    <Ionicons name="add" size={16} color={palette.void} />
                    <Text variant="labelSmall" color={palette.void}>
                      {importing ? 'IMPORTING' : 'IMPORT'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {localTracks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="folder-open-outline" size={48} color={palette.slate} />
                    <Text variant="body" color={palette.silver} align="center" style={{ marginTop: spacing.sm }}>
                      No local files yet
                    </Text>
                    <Text variant="bodySmall" color={palette.slate} align="center" style={{ marginTop: spacing.xs }}>
                      Import audio from this device — the one source no platform can take away
                    </Text>
                  </View>
                ) : (
                  <View style={styles.trackList}>
                    {localTracks.map((rec, i) => (
                      <ADSRFadeIn key={rec.id} index={i} staggerMs={40}>
                        <View style={styles.localRow}>
                          <Ionicons name="musical-note-outline" size={18} color={palette.green} />
                          <View style={styles.localRowMeta}>
                            <Text variant="body" color={palette.frost} numberOfLines={1}>
                              {rec.title}
                            </Text>
                            <Text variant="bodySmall" color={palette.slate}>
                              {formatDuration(rec.durationSec)} · LOCAL
                            </Text>
                          </View>
                          {canQueueLocal && (
                            <TouchableOpacity
                              onPress={() => handleQueueLocal(rec)}
                              activeOpacity={0.7}
                              accessibilityRole="button"
                              accessibilityLabel={`Queue ${rec.title}`}
                              style={styles.localQueueButton}
                            >
                              <Text variant="labelSmall" color={palette.green}>QUEUE</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            onPress={() => void handleRemoveLocal(rec.id)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove ${rec.title}`}
                            style={styles.localRemoveButton}
                          >
                            <Ionicons name="trash-outline" size={16} color={palette.slate} />
                          </TouchableOpacity>
                        </View>
                      </ADSRFadeIn>
                    ))}
                  </View>
                )}
              </ADSRFadeIn>
            )}

            {/* ─── Liked Tracks ─────────────────────────── */}
            {segment === 'liked' && (
              <ADSRFadeIn index={0}>
                {error && (
                  <ErrorState
                    message={error}
                    onRetry={onRefresh}
                  />
                )}
                {isLoading && !error ? (
                  <View style={styles.trackList}>
                    {[...Array(5)].map((_, i) => (
                      <TrackCardSkeleton key={`skeleton-${i}`} />
                    ))}
                  </View>
                ) : sortedFavorites.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="heart-outline" size={48} color={palette.slate} />
                    <Text variant="body" color={palette.silver} align="center" style={{ marginTop: spacing.sm }}>
                      No liked tracks yet
                    </Text>
                    <Text variant="bodySmall" color={palette.slate} align="center" style={{ marginTop: spacing.xs }}>
                      Tap the heart on any track to save it here
                    </Text>
                  </View>
                ) : (
                  <View style={styles.trackList}>
                    {sortedFavorites.map((fav, i) => (
                      <ADSRFadeIn key={fav.track.id} index={i} staggerMs={40}>
                        <TrackListItem
                          title={fav.track.title}
                          artist={fav.track.artist}
                          albumArt={fav.track.albumArt}
                          duration={fav.track.duration}
                          source={fav.track.source}
                          metadataSource={fav.track.metadataSource}
                          rightAction={
                            <TouchableOpacity
                              onPress={() => removeFavorite(fav.track.id)}
                              style={styles.removeBtn}
                              activeOpacity={0.6}
                              accessibilityRole="button"
                              accessibilityLabel={`Remove ${fav.track.title} from liked tracks`}
                              accessibilityHint="Double tap to remove this track from your favorites"
                            >
                              <Ionicons name="heart" size={18} color={accent} />
                            </TouchableOpacity>
                          }
                        />
                      </ADSRFadeIn>
                    ))}
                  </View>
                )}
              </ADSRFadeIn>
            )}

            {/* ─── Session History ──────────────────────── */}
            {segment === 'history' && (
              <ADSRFadeIn index={0}>
                {error && (
                  <ErrorState
                    message={error}
                    onRetry={onRefresh}
                  />
                )}
                {isLoading && !error ? (
                  <View style={styles.historyList}>
                    {[...Array(5)].map((_, i) => (
                      <TrackCardSkeleton key={`skeleton-${i}`} />
                    ))}
                  </View>
                ) : sessionHistory.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="time-outline" size={48} color={palette.slate} />
                    <Text variant="body" color={palette.silver} align="center" style={{ marginTop: spacing.sm }}>
                      No session history yet
                    </Text>
                    <Text variant="bodySmall" color={palette.slate} align="center" style={{ marginTop: spacing.xs }}>
                      Sessions you join will appear here
                    </Text>
                  </View>
                ) : (
                  <View style={styles.historyList}>
                    {sessionHistory.map((session, i) => (
                      <ADSRFadeIn key={session.id} index={i} staggerMs={60}>
                        <HistoryCard
                          session={session}
                          onPress={() => setArchivePreview(session.session)}
                        />
                      </ADSRFadeIn>
                    ))}
                  </View>
                )}
              </ADSRFadeIn>
            )}
          </ScrollView>
        )}

        <ArchiveSessionModal
          session={archivePreview}
          onClose={() => setArchivePreview(null)}
        />
      </VoidSurface>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 120, // clear mini-player + tab bar
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: palette.steel,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  trackList: {
    gap: 0,
  },
  localHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  localImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: palette.green,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 2,
  },
  localRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  localRowMeta: {
    flex: 1,
    minWidth: 0,
  },
  localQueueButton: {
    borderWidth: 1,
    borderColor: palette.green,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 2,
  },
  localRemoveButton: {
    padding: 6,
  },
  historyList: {
    gap: 0,
  },
  removeBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default LibraryScreen;
