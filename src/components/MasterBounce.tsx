/**
 * Master Bounce — Session Receipt / Summary Card
 *
 * In audio production, "bouncing" is the final export — rendering
 * all tracks, effects, and automation into a single stereo file.
 * It's the session's permanent artifact.
 *
 * When a session ends (host ends it or everyone leaves), a Master
 * Bounce receipt is generated. It shows:
 *   - Session metadata (name, mode, duration, host)
 *   - Track count + total listening time
 *   - Top 3 tracks by votes
 *   - Participant count
 *   - CV earned during the session
 *   - A visual "waveform" fingerprint of the session
 *
 * This receipt can be shared or saved. It creates a tangible
 * artifact from an ephemeral experience.
 *
 * Research pillar: Shared Experience Architecture — receipts turn
 * temporary sessions into memorable shared history.
 */

import React, { useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, Animated, Easing, TouchableOpacity, Share,
} from 'react-native';
import Svg, { Path, Rect, Line } from 'react-native-svg';
import { Text } from './ui/Text';
import { Button } from './ui/Button';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import { notifySuccess, tapLight } from '../utils/haptics';
import type { QueueTrack, RoomMode, RoomBehaviors } from '../types';

interface MasterBounceProps {
  /** Session name */
  sessionName: string;
  /** Room mode used (preset label) */
  roomMode: RoomMode;
  /** Behavioral toggles active during session */
  behaviors?: RoomBehaviors;
  /** Host username */
  hostUsername: string;
  /** Session duration in seconds */
  durationSeconds: number;
  /** All tracks played during the session */
  tracksPlayed: QueueTrack[];
  /** Number of participants */
  participantCount: number;
  /** CV earned by current user */
  cvEarned: number;
  /** Timestamp when session ended */
  endedAt: string;
  /** Whether the receipt is visible */
  visible?: boolean;
  /** Called when user dismisses */
  onDismiss?: () => void;
}

const MODE_LABELS: Record<RoomMode, string> = {
  campfire: 'CAMPFIRE',
  spotlight: 'SPOTLIGHT',
  openFloor: 'OPEN FLOOR',
};

const MODE_COLORS: Record<RoomMode, string> = {
  campfire: palette.orange,
  spotlight: palette.magenta,
  openFloor: palette.signalSaw,
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Generate a unique "waveform fingerprint" from the track list.
 * Each track contributes amplitude based on its vote count,
 * creating a visual signature unique to this session.
 */
function generateSessionFingerprint(
  tracks: QueueTrack[],
  width: number,
  height: number,
): string {
  if (tracks.length === 0) {
    const midY = height / 2;
    return `M 0 ${midY} L ${width} ${midY}`;
  }

  const midY = height / 2;
  const points: string[] = [];
  const segmentWidth = width / Math.max(tracks.length, 1);

  tracks.forEach((track, i) => {
    const votes = track.votedBy?.length ?? 0;
    const amplitude = Math.min(midY * 0.8, (votes + 1) * 4);
    const x1 = i * segmentWidth;
    const x2 = (i + 0.5) * segmentWidth;
    const x3 = (i + 1) * segmentWidth;

    // Each track creates a peak-valley pair
    const seed = track.title.length + (track.artist?.length ?? 0);
    const direction = seed % 2 === 0 ? 1 : -1;

    if (i === 0) {
      points.push(`M ${x1} ${midY}`);
    }
    points.push(`L ${x2.toFixed(1)} ${(midY + direction * amplitude).toFixed(1)}`);
    points.push(`L ${x3.toFixed(1)} ${midY}`);
  });

  return points.join(' ');
}

/** Stat row component */
function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={statStyles.row}>
      <Text variant="labelSmall" color={palette.slate} style={statStyles.label}>
        {label}
      </Text>
      <Text variant="body" color={color || palette.frost} style={statStyles.value}>
        {value}
      </Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  label: {
    fontSize: 9,
    letterSpacing: 2,
  },
  value: {
    fontSize: 13,
    fontWeight: '500',
  },
});

/** Top track item */
function TopTrackRow({
  track,
  rank,
}: {
  track: QueueTrack;
  rank: number;
}) {
  const votes = track.votedBy?.length ?? 0;
  return (
    <View style={topTrackStyles.row}>
      <Text variant="labelSmall" color={palette.slate} style={topTrackStyles.rank}>
        {rank}
      </Text>
      <View style={topTrackStyles.info}>
        <Text variant="body" color={palette.frost} style={topTrackStyles.title} numberOfLines={1}>
          {track.title}
        </Text>
        <Text variant="labelSmall" color={palette.silver} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <Text variant="labelSmall" color={palette.green} style={topTrackStyles.votes}>
        {votes} {votes === 1 ? 'vote' : 'votes'}
      </Text>
    </View>
  );
}

const topTrackStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rank: {
    width: 20,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: 13,
    fontWeight: '500',
  },
  votes: {
    fontSize: 10,
    letterSpacing: 1,
  },
});

export function MasterBounce({
  sessionName,
  roomMode,
  behaviors,
  hostUsername,
  durationSeconds,
  tracksPlayed,
  participantCount,
  cvEarned,
  endedAt,
  visible = true,
  onDismiss,
}: MasterBounceProps) {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      // Satisfying haptic on receipt reveal
      notifySuccess();
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slideUp, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.05)),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeIn, slideUp]);

  const handleShare = () => {
    tapLight();
    const topSignals = topTracks.length > 0
      ? `\nTop signals: ${topTracks.map((t, i) => `${i + 1}. ${t.title}`).join(', ')}`
      : '';
    Share.share({
      message: `Master Bounce: "${sessionName}"\n${tracksPlayed.length} tracks / ${formatDuration(durationSeconds)} / ${participantCount} listeners${topSignals}\n\nFrequen-C`,
    });
  };

  // Sort tracks by votes for top 3
  const topTracks = [...tracksPlayed]
    .sort((a, b) => (b.votedBy?.length ?? 0) - (a.votedBy?.length ?? 0))
    .slice(0, 3);

  const totalListenMinutes = Math.round(durationSeconds / 60);
  const modeColor = MODE_COLORS[roomMode];
  const fingerprintWidth = 280;
  const fingerprintHeight = 40;

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeIn,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateY: slideUp }],
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text variant="labelSmall" color={palette.slate} style={styles.bounceLabel}>
              MASTER BOUNCE
            </Text>
            <Text variant="h1" color={palette.frost} style={styles.sessionName}>
              {sessionName}
            </Text>
            <View style={styles.modeRow}>
              <View style={[styles.modeDot, { backgroundColor: modeColor }]} />
              <Text variant="labelSmall" color={modeColor} style={styles.modeLabel}>
                {MODE_LABELS[roomMode]}
              </Text>
              {behaviors && (
                <Text variant="labelSmall" color={palette.slate} style={styles.behaviorHint}>
                  {[
                    behaviors.voteReordersQueue && 'Vote reorder',
                    behaviors.requiresApproval && 'Approval gate',
                    behaviors.skipAccess === 'hostOnly' && 'Host skip',
                    behaviors.allowOverdrive && 'Overdrive',
                  ].filter(Boolean).join(' · ') || 'Default behaviors'}
                </Text>
              )}
            </View>
          </View>

          {/* Session waveform fingerprint */}
          <View style={styles.fingerprintContainer}>
            <Svg
              width={fingerprintWidth}
              height={fingerprintHeight}
              viewBox={`0 0 ${fingerprintWidth} ${fingerprintHeight}`}
            >
              <Path
                d={generateSessionFingerprint(tracksPlayed, fingerprintWidth, fingerprintHeight)}
                stroke={modeColor}
                strokeWidth={1.5}
                fill="none"
                opacity={0.6}
              />
              {/* Baseline */}
              <Line
                x1={0}
                y1={fingerprintHeight / 2}
                x2={fingerprintWidth}
                y2={fingerprintHeight / 2}
                stroke={palette.chromeBorder}
                strokeWidth={0.5}
              />
            </Svg>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Stats */}
          <View style={styles.statsSection}>
            <StatRow label="HOST" value={hostUsername} />
            <StatRow label="DURATION" value={formatDuration(durationSeconds)} />
            <StatRow label="TRACKS PLAYED" value={`${tracksPlayed.length}`} />
            <StatRow label="PARTICIPANTS" value={`${participantCount}`} />
            <StatRow label="CV EARNED" value={`+${cvEarned}`} color={palette.green} />
            <StatRow label="ENDED" value={formatDate(endedAt)} />
          </View>

          {/* Top tracks */}
          {topTracks.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.topTracksSection}>
                <Text variant="labelSmall" color={palette.slate} style={styles.sectionLabel}>
                  TOP SIGNALS
                </Text>
                {topTracks.map((track, i) => (
                  <TopTrackRow key={track.id} track={track} rank={i + 1} />
                ))}
              </View>
            </>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.7}>
              <Text variant="labelSmall" color={palette.slate} style={{ fontSize: 9, letterSpacing: 1.5 }}>
                SHARE BOUNCE
              </Text>
            </TouchableOpacity>
            <Button
              title="Done"
              onPress={() => { tapLight(); onDismiss?.(); }}
              variant="primary"
              size="md"
              style={{ flex: 1 }}
            />
          </View>

          {/* Footer / build tag */}
          <View style={styles.footer}>
            <Text variant="labelSmall" color={palette.slate} style={styles.buildTag}>
              FREQUEN-C // MASTER BOUNCE
            </Text>
            <Text variant="labelSmall" color={palette.slate} style={styles.buildTag}>
              DESN 374-040
            </Text>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1100,
    padding: spacing.screenPadding,
  },
  card: {
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderRadius: 12,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 380,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  bounceLabel: {
    fontSize: 9,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  sessionName: {
    fontSize: 22,
    lineHeight: 28,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  modeLabel: {
    fontSize: 9,
    letterSpacing: 2,
  },
  behaviorHint: {
    fontSize: 8,
    letterSpacing: 1,
    marginLeft: spacing.sm,
    opacity: 0.6,
  },
  fingerprintContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderRadius: 6,
    backgroundColor: palette.steel,
    marginBottom: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: palette.chromeBorder,
    marginVertical: spacing.sm,
  },
  statsSection: {
    marginVertical: spacing.sm,
  },
  topTracksSection: {
    marginVertical: spacing.sm,
  },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  shareBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    backgroundColor: palette.steel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: palette.chromeBorder,
  },
  buildTag: {
    fontSize: 8,
    letterSpacing: 2,
    opacity: 0.3,
    marginVertical: 1,
  },
});

export default MasterBounce;
