import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChromeButton, LEDReadout, ModuleFaceplate } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';
import type { Session, Track } from '../types';
import { Text, TrackListItem } from './ui';

interface ArchiveSessionModalProps {
  session: Session | null;
  onClose: () => void;
}

function getArchiveTrackCount(session: Session): number {
  return session.queue.length + (session.currentTrack ? 1 : 0);
}

function getPlayedCount(session: Session): number {
  return session.tracksPlayedCount ?? 0;
}

function formatArchiveDate(dateStr?: string): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toISOString().slice(0, 10);
}

function formatArchiveDuration(session: Session): string {
  if (!session.endedAt) return 'LIVE';

  const start = new Date(session.createdAt).getTime();
  const end = new Date(session.endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 'Unknown';

  const totalMinutes = Math.max(1, Math.round((end - start) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getModeLabel(session: Session): string {
  if (session.roomMode === 'campfire') return 'CAMPFIRE';
  if (session.roomMode === 'spotlight') return 'SPOTLIGHT';
  return 'OPEN FLOOR';
}

function getArchiveTracks(session: Session): Track[] {
  return [session.currentTrack, ...session.queue].filter(Boolean) as Track[];
}

export function ArchiveSessionModal({ session, onClose }: ArchiveSessionModalProps) {
  if (!session) return null;

  const tracks = getArchiveTracks(session);
  const trackCount = getArchiveTrackCount(session);
  const playedCount = getPlayedCount(session);
  const listenerCount = session.listeners.length;
  const lastTrack = session.currentTrack || session.queue[0];

  return (
    <Modal
      visible={!!session}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ModuleFaceplate label="ARCHIVE DETAIL" screws>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.sessionName}>{session.name}</Text>
                <Text style={styles.metaText}>
                  HOST: {session.hostUsername || 'Unknown'} · SAVED: {formatArchiveDate(session.createdAt)}
                </Text>
                <Text style={styles.metaText}>
                  LENGTH: {formatArchiveDuration(session)} · PLAYED: {playedCount}
                </Text>
                {!!session.genre && (
                  <Text style={styles.metaText}>GENRE: {session.genre}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close archive detail"
              >
                <Ionicons name="close" size={18} color={palette.silver} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <LEDReadout value={String(playedCount)} label="PLAYED" size="md" variant="amber" />
              <LEDReadout value={String(listenerCount)} label="CREW" size="md" variant="ice" />
              <LEDReadout value={getModeLabel(session)} label="MODE" size="sm" variant="ice" />
            </View>

            {lastTrack ? (
              <View style={styles.nowPlayingBlock}>
                <Text style={styles.sectionLabel}>LAST NOW PLAYING</Text>
                <TrackListItem
                  title={lastTrack.title}
                  artist={lastTrack.artist}
                  albumArt={lastTrack.albumArt}
                  duration={lastTrack.duration}
                  showMenu={false}
                />
              </View>
            ) : null}

            <View style={styles.trackBlock}>
              <Text style={styles.sectionLabel}>ARCHIVE TRACKLIST · {trackCount} CAPTURED</Text>
              {tracks.length > 0 ? (
                <ScrollView style={styles.trackScroll} contentContainerStyle={styles.trackScrollContent}>
                  {tracks.map((track) => (
                    <TrackListItem
                      key={track.id}
                      title={track.title}
                      artist={track.artist}
                      albumArt={track.albumArt}
                      duration={track.duration}
                      addedBy={track.addedBy?.username}
                      showMenu={false}
                    />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="disc-outline" size={24} color={palette.slate} />
                  <Text style={styles.emptyText}>No archived tracks were captured for this room.</Text>
                </View>
              )}
            </View>

            <ChromeButton onPress={onClose} size="md" style={styles.closeCta}>
              CLOSE
            </ChromeButton>
          </ModuleFaceplate>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 14, 0.82)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  sessionName: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['2xl'],
    color: palette.frost,
    letterSpacing: ls.wide,
    marginBottom: spacing.xs,
  },
  metaText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.silver,
    letterSpacing: ls.wide,
    marginBottom: 4,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  nowPlayingBlock: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 0,
    backgroundColor: '#111111',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  trackBlock: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 0,
    backgroundColor: '#111111',
    overflow: 'hidden',
  },
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.silver,
    letterSpacing: ls.wide,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  trackScroll: {
    maxHeight: 320,
  },
  trackScrollContent: {
    paddingBottom: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    color: palette.slate,
    textAlign: 'center',
  },
  closeCta: {
    marginTop: spacing.lg,
    alignSelf: 'center',
  },
});

export default ArchiveSessionModal;
