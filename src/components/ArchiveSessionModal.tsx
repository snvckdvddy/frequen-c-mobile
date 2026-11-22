import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChromeButton, LEDReadout } from '../design/components';
import { palette, withAlpha } from '../design/tokens/materials';
import { fontFamily, fontSize, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';
import { buildArchiveSummary } from '../services/archiveSummary';
import type { Session, Track } from '../types';
import { Text, TrackListItem } from './ui';

interface ArchiveSessionModalProps {
  session: Session | null;
  onClose: () => void;
}

/** Share of the screen the scrolling body may take; the label, header and CLOSE sit around it. */
const BODY_MAX_HEIGHT_RATIO = 0.55;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function TrackRows({ tracks }: { tracks: Track[] }) {
  return (
    <>
      {tracks.map((track, index) => (
        <TrackListItem
          key={`${track.id}-${index}`}
          title={track.title}
          artist={track.artist}
          albumArt={track.albumArt}
          duration={track.duration}
          addedBy={track.addedBy?.username}
          source={track.source}
          metadataSource={track.metadataSource}
          showMenu={false}
        />
      ))}
    </>
  );
}

export function ArchiveSessionModal({ session, onClose }: ArchiveSessionModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const summary = useMemo(() => (session ? buildArchiveSummary(session) : null), [session]);

  if (!session || !summary) return null;

  return (
    <Modal
      visible
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop} accessibilityViewIsModal>
        {/* Tapping the dimmed area above the sheet closes it, same as the X and CLOSE. */}
        <Pressable
          style={styles.dismissArea}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss archive detail"
        />

        <View style={styles.sheet}>
          <View style={styles.labelBar}>
            <Text style={styles.label}>ARCHIVE DETAIL</Text>
          </View>

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.sessionName} numberOfLines={2}>{summary.name}</Text>
              <Text style={styles.metaText}>CODE {summary.code} · {summary.modeLabel}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close archive detail"
            >
              <Ionicons name="close" size={18} color={palette.silver} />
            </Pressable>
          </View>

          <ScrollView
            style={[styles.body, { maxHeight: Math.round(windowHeight * BODY_MAX_HEIGHT_RATIO) }]}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.statsRow}>
              <LEDReadout value={String(summary.tracksPlayed)} label="PLAYED" size="md" variant="amber" />
              <LEDReadout value={String(summary.crewCount)} label="CREW" size="md" variant="ice" />
              <LEDReadout value={summary.lengthLabel} label="LENGTH" size="md" variant="ice" />
            </View>

            <View style={styles.block}>
              <View style={styles.detailList}>
                <DetailRow label="HOST" value={summary.host} />
                <DetailRow label="STARTED" value={summary.startedLabel} />
                <DetailRow label="ENDED" value={summary.endedLabel} />
                {summary.genre ? <DetailRow label="GENRE" value={summary.genre} /> : null}
                {summary.crewLine ? <DetailRow label="WITH" value={summary.crewLine} /> : null}
                {summary.description ? <DetailRow label="NOTE" value={summary.description} /> : null}
              </View>
            </View>

            {summary.lastOnAir ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>LAST ON AIR</Text>
                <TrackRows tracks={[summary.lastOnAir]} />
              </View>
            ) : null}

            {summary.leftInQueue.length > 0 ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>LEFT IN QUEUE · {summary.leftInQueue.length}</Text>
                <TrackRows tracks={summary.leftInQueue} />
              </View>
            ) : null}

            {!summary.hasTrackDetail ? (
              <View style={styles.block}>
                <Text style={styles.sectionLabel}>TRACKLIST</Text>
                <View style={styles.emptyState}>
                  <Ionicons name="disc-outline" size={24} color={palette.slate} />
                  <Text style={styles.emptyText}>{summary.trackNote}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
            <ChromeButton onPress={onClose} size="md">
              CLOSE
            </ChromeButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: withAlpha(palette.void, 0.82),
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: palette.matte,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: palette.borderHard,
    overflow: 'hidden',
  },
  labelBar: {
    padding: 12,
    backgroundColor: palette.matteGhost,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  label: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.lg,
    letterSpacing: ls.wide,
    textTransform: 'uppercase',
    color: palette.acid,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
    fontSize: fontSize.sm,
    color: palette.silver,
    letterSpacing: ls.wide,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.matte,
    borderWidth: 1,
    borderColor: palette.borderHard,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  block: {
    borderWidth: 1,
    borderColor: palette.borderHard,
    backgroundColor: palette.matte,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  detailList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.borderSoft,
  },
  detailLabel: {
    width: 76,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.frost,
  },
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
    color: palette.silver,
    letterSpacing: ls.wide,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  emptyText: {
    color: palette.slate,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});

export default ArchiveSessionModal;
