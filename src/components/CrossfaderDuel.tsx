/**
 * Crossfader Duel — Head-to-Head Track Battle
 *
 * Two tracks are loaded onto channels A and B. Users "crossfade"
 * by voting for one side. The crossfader position reflects
 * the vote ratio in real time. When the timer ends, the winning
 * track stays in the queue and the loser gets dropped.
 *
 * Visual: DJ mixer crossfader — horizontal slider showing
 * vote balance between two tracks.
 *
 * Research pillar: Social Choice Architecture —
 * binary choice reduces decision fatigue, increases engagement.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, Image, Animated, Easing,
  PanResponder, Dimensions,
} from 'react-native';
import { Text } from './ui/Text';
import { AnimatedPressable } from './ui/AnimatedPressable';
import { WaveformIcon } from './ui/WaveformIcon';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import { tapMedium, tapLight } from '../utils/haptics';
import type { QueueTrack } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FADER_WIDTH = SCREEN_WIDTH - spacing.screenPadding * 2;
const KNOB_WIDTH = 48;
const FADER_TRAVEL = FADER_WIDTH - KNOB_WIDTH;

interface CrossfaderDuelProps {
  trackA: QueueTrack;
  trackB: QueueTrack;
  /** Vote counts: { a: number, b: number } */
  votes: { a: number; b: number };
  /** Remaining time in seconds */
  timeRemaining: number;
  /** Total duel duration in seconds */
  totalTime: number;
  /** Called when user votes for a side */
  onVote: (side: 'a' | 'b') => void;
  /** Which side the current user voted for (null = hasn't voted) */
  userVote: 'a' | 'b' | null;
  /** Called when duel ends */
  onDuelEnd?: (winner: 'a' | 'b') => void;
}

// Track channel display (A or B)
function ChannelTrack({
  track,
  side,
  votes,
  isWinning,
}: {
  track: QueueTrack;
  side: 'a' | 'b';
  votes: number;
  isWinning: boolean;
}) {
  return (
    <View style={[channelStyles.container, side === 'b' && channelStyles.containerB]}>
      {/* Album art */}
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={channelStyles.art} />
      ) : (
        <View style={[channelStyles.art, channelStyles.artPlaceholder]}>
          <WaveformIcon mode="campfire" size={16} />
        </View>
      )}

      {/* Track info */}
      <View style={channelStyles.info}>
        <Text
          variant="labelSmall"
          color={isWinning ? palette.orange : palette.slate}
          style={channelStyles.sideLabel}
        >
          {side === 'a' ? 'CH A' : 'CH B'}
        </Text>
        <Text
          variant="body"
          color={palette.frost}
          numberOfLines={1}
          style={channelStyles.title}
        >
          {track.title}
        </Text>
        <Text variant="bodySmall" color={palette.silver} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      {/* Vote count */}
      <View style={[channelStyles.voteCount, isWinning && channelStyles.voteCountWinning]}>
        <Text variant="h2" color={isWinning ? palette.orange : palette.slate}>
          {votes}
        </Text>
      </View>
    </View>
  );
}

const channelStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  containerB: {
    flexDirection: 'row-reverse',
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: palette.midnight,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  sideLabel: {
    fontSize: 8,
    letterSpacing: 2,
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
  },
  voteCount: {
    width: 40,
    alignItems: 'center',
  },
  voteCountWinning: {
    // glow effect handled by text color
  },
});

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
  const total = votes.a + votes.b;
  const ratio = total > 0 ? votes.a / total : 0.5; // 0 = all B, 1 = all A
  const faderPosition = useRef(new Animated.Value(ratio * FADER_TRAVEL)).current;
  const pulseAnim = useRef(new Animated.Value(0.5)).current;

  // Animate fader to vote ratio
  useEffect(() => {
    Animated.timing(faderPosition, {
      toValue: ratio * FADER_TRAVEL,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ratio, faderPosition]);

  // Pulse animation for active duel
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  const isAWinning = votes.a >= votes.b;
  const timerPercent = totalTime > 0 ? timeRemaining / totalTime : 0;

  return (
    <View style={styles.container}>
      {/* Duel header */}
      <View style={styles.header}>
        <Animated.View style={{ opacity: pulseAnim }}>
          <Text variant="labelSmall" color={palette.red} style={styles.duelLabel}>
            CROSSFADER DUEL
          </Text>
        </Animated.View>
        <Text variant="labelSmall" color={palette.slate} style={styles.timer}>
          {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
        </Text>
      </View>

      {/* Timer bar */}
      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${timerPercent * 100}%` }]} />
      </View>

      {/* Channel A */}
      <ChannelTrack
        track={trackA}
        side="a"
        votes={votes.a}
        isWinning={isAWinning}
      />

      {/* Crossfader track */}
      <View style={styles.faderTrack}>
        {/* A-side zone */}
        <View style={[styles.faderZone, { backgroundColor: 'rgba(255, 107, 53, 0.08)' }]}>
          <Text variant="labelSmall" color={palette.orange} style={styles.zoneLabel}>A</Text>
        </View>
        {/* B-side zone */}
        <View style={[styles.faderZone, { backgroundColor: 'rgba(192, 223, 255, 0.08)' }]}>
          <Text variant="labelSmall" color={palette.signalSaw} style={styles.zoneLabel}>B</Text>
        </View>

        {/* Center line */}
        <View style={styles.centerLine} />

        {/* Fader knob — animated to vote ratio */}
        <Animated.View style={[styles.faderKnob, { left: faderPosition }]}>
          <View style={styles.knobGrip}>
            <View style={styles.knobLine} />
            <View style={styles.knobLine} />
            <View style={styles.knobLine} />
          </View>
        </Animated.View>
      </View>

      {/* Channel B */}
      <ChannelTrack
        track={trackB}
        side="b"
        votes={votes.b}
        isWinning={!isAWinning}
      />

      {/* Vote buttons */}
      <View style={styles.voteRow}>
        <AnimatedPressable
          style={[
            styles.voteBtn,
            styles.voteBtnA,
            userVote === 'a' && styles.voteBtnActive,
          ]}
          onPress={() => {
            tapMedium();
            onVote('a');
          }}
          disabled={userVote !== null}
          scaleDown={0.93}
          accessibilityRole="button"
          accessibilityLabel={`Vote for Channel A, ${trackA.title} by ${trackA.artist}, ${votes.a} votes`}
          accessibilityState={{ disabled: userVote !== null, selected: userVote === 'a' }}
        >
          <Text
            variant="labelLarge"
            color={userVote === 'a' ? palette.void : palette.orange}
          >
            CHANNEL A
          </Text>
        </AnimatedPressable>

        <AnimatedPressable
          style={[
            styles.voteBtn,
            styles.voteBtnB,
            userVote === 'b' && styles.voteBtnActive,
          ]}
          onPress={() => {
            tapMedium();
            onVote('b');
          }}
          disabled={userVote !== null}
          scaleDown={0.93}
          accessibilityRole="button"
          accessibilityLabel={`Vote for Channel B, ${trackB.title} by ${trackB.artist}, ${votes.b} votes`}
          accessibilityState={{ disabled: userVote !== null, selected: userVote === 'b' }}
        >
          <Text
            variant="labelLarge"
            color={userVote === 'b' ? palette.void : palette.signalSaw}
          >
            CHANNEL B
          </Text>
        </AnimatedPressable>
      </View>

      {userVote && (
        <Text variant="labelSmall" color={palette.slate} style={styles.votedLabel}>
          SIGNAL LOCKED — {userVote === 'a' ? 'CH A' : 'CH B'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.screenPadding,
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  duelLabel: {
    fontSize: 9,
    letterSpacing: 2,
  },
  timer: {
    fontSize: 11,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  timerBar: {
    height: 2,
    backgroundColor: palette.steel,
    borderRadius: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    backgroundColor: palette.red,
    borderRadius: 1,
  },
  // Crossfader track
  faderTrack: {
    height: 36,
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    position: 'relative',
    marginVertical: spacing.sm,
  },
  faderZone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneLabel: {
    fontSize: 8,
    letterSpacing: 2,
    opacity: 0.6,
  },
  centerLine: {
    position: 'absolute',
    left: '50%',
    top: 4,
    bottom: 4,
    width: 1,
    backgroundColor: palette.chromeBorder,
  },
  faderKnob: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    width: KNOB_WIDTH,
    backgroundColor: palette.steel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.ice,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: palette.void,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  knobGrip: {
    flexDirection: 'row',
    gap: 3,
  },
  knobLine: {
    width: 1,
    height: 16,
    backgroundColor: palette.ice,
    borderRadius: 0.5,
  },
  // Vote buttons
  voteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  voteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBtnA: {
    borderColor: palette.orange,
    backgroundColor: 'rgba(255, 107, 53, 0.06)',
  },
  voteBtnB: {
    borderColor: palette.signalSaw,
    backgroundColor: 'rgba(192, 223, 255, 0.06)',
  },
  voteBtnActive: {
    backgroundColor: palette.orange,
    borderColor: palette.orange,
  },
  votedLabel: {
    textAlign: 'center',
    marginTop: spacing.xs,
    fontSize: 8,
    letterSpacing: 2,
    opacity: 0.6,
  },
});

export default CrossfaderDuel;
