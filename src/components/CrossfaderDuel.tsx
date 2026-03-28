import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { QueueTrack } from '../types';
import TacticalGameShell from '../features/session-v2/components/TacticalGameShell';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface CrossfaderDuelProps {
  trackA: QueueTrack;
  trackB: QueueTrack;
  votes: { a: number; b: number };
  timeRemaining: number;
  totalTime: number;
  onVote: (side: 'a' | 'b') => void;
  userVote: 'a' | 'b' | null;
  onDuelEnd?: () => void;
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function formatTrackTitle(title: string) {
  return title.toUpperCase();
}

function DuelTrackRail({
  track,
  side,
  votes,
  locked,
  winning,
  onLock,
}: {
  track: QueueTrack;
  side: 'a' | 'b';
  votes: number;
  locked: boolean;
  winning: boolean;
  onLock: () => void;
}) {
  const accentColor = side === 'a' ? tacticalTokens.colors.orange : tacticalTokens.colors.ice;
  return (
    <View style={[styles.rail, winning && { borderColor: accentColor }]}>
      <View style={[styles.railStrip, { backgroundColor: `${accentColor}1F`, borderRightColor: accentColor }]}>
        <Text style={[styles.railStripText, { color: accentColor }]}>{side === 'a' ? 'A' : 'B'}</Text>
      </View>

      <View style={styles.railBody}>
        <View style={styles.railHeader}>
          <Text style={[styles.railChannel, { color: accentColor }]}>{side === 'a' ? 'CHANNEL A' : 'CHANNEL B'}</Text>
          <Text style={[styles.voteCount, { color: winning ? accentColor : tacticalTokens.colors.textSoft }]}>
            {votes}
          </Text>
        </View>

        <View style={styles.trackRow}>
          <View style={styles.artFrame}>
            {track.albumArt ? <Image source={{ uri: track.albumArt }} style={styles.art} /> : null}
          </View>

          <View style={styles.trackMeta}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {formatTrackTitle(track.title)}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {track.artist}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={onLock}
          disabled={locked}
          style={({ pressed }) => [
            styles.lockButton,
            { borderColor: accentColor },
            locked && { backgroundColor: `${accentColor}16` },
            pressed && !locked && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={locked ? `Locked ${side.toUpperCase()}` : `Lock ${side.toUpperCase()}`}
        >
          <Text style={[styles.lockButtonText, { color: accentColor }]}>
            {locked ? `LOCKED ${side.toUpperCase()}` : `LOCK ${side.toUpperCase()}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export function CrossfaderDuel({
  trackA,
  trackB,
  votes,
  timeRemaining,
  totalTime,
  onVote,
  userVote,
  onDuelEnd,
}: CrossfaderDuelProps) {
  const totalVotes = votes.a + votes.b;
  const aRatio = totalVotes > 0 ? votes.a / totalVotes : 0.5;
  const bRatio = 1 - aRatio;
  const countdown = formatCountdown(timeRemaining);
  const finished = timeRemaining <= 0;
  const { width, height } = useWindowDimensions();
  const compact = width <= 420 || height <= 780;
  const winner = votes.b > votes.a ? 'b' : 'a';
  const resultLabel = winner === 'a' ? 'CHANNEL A WON' : 'CHANNEL B WON';
  const leadTrack = winner === 'a' ? trackA : trackB;
  const progress = totalTime > 0 ? Math.max(0, timeRemaining / totalTime) : 0;

  const lockHint = useMemo(() => {
    if (finished) return `${resultLabel} // ${leadTrack.title.toUpperCase()}`;
    if (userVote === 'a') return 'SIGNAL LOCKED TO CHANNEL A';
    if (userVote === 'b') return 'SIGNAL LOCKED TO CHANNEL B';
    return 'LOCK A SIDE BEFORE THE FADER CLOSES';
  }, [finished, leadTrack.title, resultLabel, userVote]);

  return (
    <TacticalGameShell
      eyebrow="SYS.FREQ // GAME BUS"
      title="CROSSFADER DUEL"
      status={finished ? 'RESULT' : countdown}
      accentColor={tacticalTokens.colors.orange}
      onClose={onDuelEnd}
      footer={
        <View style={[styles.footerBar, compact && styles.footerBarCompact]}>
          <View style={[styles.footerFill, { width: `${progress * 100}%` }]} />
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.systemHint, compact && styles.systemHintCompact]}>{lockHint}</Text>

        <View style={[styles.meterFrame, compact && styles.meterFrameCompact]}>
          <View style={[styles.meterTrack, compact && styles.meterTrackCompact]}>
            <View style={[styles.meterHalf, { backgroundColor: `${tacticalTokens.colors.orange}14` }]} />
            <View style={[styles.meterHalf, { backgroundColor: `${tacticalTokens.colors.ice}14` }]} />
            <View style={styles.meterCenterLine} />
            <View style={[styles.meterKnob, compact && styles.meterKnobCompact, { left: `${aRatio * 100}%` }]} />
          </View>

          <View style={styles.meterLegend}>
            <Text style={[styles.meterLabel, compact && styles.meterLabelCompact, { color: tacticalTokens.colors.orange }]}>
              A {Math.round(aRatio * 100)}%
            </Text>
            <Text style={[styles.meterLabel, compact && styles.meterLabelCompact, { color: tacticalTokens.colors.ice }]}>
              B {Math.round(bRatio * 100)}%
            </Text>
          </View>
        </View>

        <View style={[styles.rails, compact && styles.railsCompact]}>
          <DuelTrackRail
            track={trackA}
            side="a"
            votes={votes.a}
            winning={winner === 'a'}
            locked={!!userVote}
            onLock={() => onVote('a')}
          />
          <DuelTrackRail
            track={trackB}
            side="b"
            votes={votes.b}
            winning={winner === 'b'}
            locked={!!userVote}
            onLock={() => onVote('b')}
          />
        </View>

        {finished ? (
          <View style={styles.resultBlock}>
            <Text style={styles.resultEyebrow}>RESULT</Text>
            <Text style={styles.resultTitle}>{resultLabel}</Text>
            <Text style={styles.resultMeta} numberOfLines={1}>
              {leadTrack.title.toUpperCase()} // {leadTrack.artist.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </TacticalGameShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: tacticalTokens.spacing.xs,
  },
  systemHint: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
    marginBottom: tacticalTokens.spacing.md,
  },
  systemHintCompact: {
    fontSize: tacticalTokens.fontSize.sys,
    lineHeight: 18,
    marginBottom: tacticalTokens.spacing.sm,
  },
  meterFrame: {
    marginBottom: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  meterFrameCompact: {
    marginBottom: tacticalTokens.spacing.sm,
    paddingHorizontal: tacticalTokens.spacing.xs + 2,
    paddingVertical: tacticalTokens.spacing.xs + 2,
  },
  meterTrack: {
    position: 'relative',
    flexDirection: 'row',
    height: 34,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  meterTrackCompact: {
    height: 28,
  },
  meterHalf: {
    flex: 1,
  },
  meterCenterLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    marginLeft: -0.5,
    backgroundColor: tacticalTokens.colors.border,
  },
  meterKnob: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: 34,
    marginLeft: -17,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: tacticalTokens.colors.void,
  },
  meterKnobCompact: {
    top: 3,
    bottom: 3,
    width: 24,
    marginLeft: -12,
  },
  meterLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: tacticalTokens.spacing.sm,
  },
  meterLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    letterSpacing: 1.2,
  },
  meterLabelCompact: {
    fontSize: tacticalTokens.fontSize.sys,
  },
  rails: {
    gap: tacticalTokens.spacing.sm,
  },
  railsCompact: {
    gap: tacticalTokens.spacing.xs + 2,
  },
  rail: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  railStrip: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  railStripText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    letterSpacing: 1.5,
  },
  railBody: {
    flex: 1,
    padding: tacticalTokens.spacing.sm,
    gap: tacticalTokens.spacing.xs + 2,
  },
  railHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  railChannel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    letterSpacing: 1.4,
  },
  voteCount: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label + 2,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  artFrame: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  art: {
    width: '100%',
    height: '100%',
  },
  trackMeta: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.body + 1,
    color: tacticalTokens.colors.white,
  },
  trackArtist: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
  },
  lockButton: {
    alignSelf: 'flex-start',
    minWidth: 88,
    minHeight: 34,
    paddingHorizontal: tacticalTokens.spacing.sm,
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockButtonText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1,
  },
  resultBlock: {
    marginTop: tacticalTokens.spacing.md,
    paddingTop: tacticalTokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderGhost,
    gap: tacticalTokens.spacing.xs,
  },
  resultEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.6,
  },
  resultTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.orange,
  },
  resultMeta: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  footerBar: {
    height: 4,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  footerBarCompact: {
    height: 3,
  },
  footerFill: {
    height: '100%',
    backgroundColor: tacticalTokens.colors.orange,
  },
  pressed: {
    opacity: 0.84,
  },
});
