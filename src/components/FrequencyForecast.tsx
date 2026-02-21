/**
 * Frequency Forecast — Prediction Game
 *
 * "Tune your antenna" — predict which track will get the most
 * votes in the next round. Correct predictions earn CV bonus.
 *
 * Visual: Radio dial / frequency tuner UI. Users select from
 * upcoming tracks and lock in their prediction.
 *
 * Research pillar: Gamification × Social Dynamics —
 * prediction markets increase engagement and investment in outcomes.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Text } from './ui/Text';
import { AnimatedPressable } from './ui/AnimatedPressable';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { tapLight, notifySuccess } from '../utils/haptics';
import type { QueueTrack } from '../types';

interface FrequencyForecastProps {
  /** Upcoming tracks to predict from */
  candidates: QueueTrack[];
  /** How many CV points this forecast is worth */
  reward: number;
  /** Time remaining to make prediction (seconds) */
  timeRemaining: number;
  /** Called when user locks in a prediction */
  onPredict: (trackId: string) => void;
  /** Result of the last forecast (null = pending) */
  lastResult?: {
    predicted: string;
    actual: string;
    correct: boolean;
    earned: number;
  } | null;
}

/** Animated radio dial indicator */
function TunerDial({ selectedIndex, total }: { selectedIndex: number; total: number }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Rotate needle to selected position
    const targetAngle = total > 1
      ? -60 + (selectedIndex / (total - 1)) * 120
      : 0;

    Animated.spring(rotation, {
      toValue: targetAngle,
      useNativeDriver: true,
      speed: 12,
      bounciness: 8,
    }).start();

    // Glow pulse when moving
    Animated.sequence([
      Animated.timing(glow, {
        toValue: 0.8,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 0.3,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selectedIndex, total, rotation, glow]);

  return (
    <View style={dialStyles.container}>
      <Svg width={160} height={80} viewBox="0 0 160 80">
        {/* Dial arc */}
        <Path
          d="M 20 70 A 60 60 0 0 1 140 70"
          stroke={colors.chrome.border}
          strokeWidth={1.5}
          fill="none"
        />
        {/* Tick marks */}
        {Array.from({ length: total }).map((_, i) => {
          const angle = -60 + (i / Math.max(1, total - 1)) * 120;
          const rad = (angle - 90) * (Math.PI / 180);
          const cx = 80 + 55 * Math.cos(rad);
          const cy = 70 + 55 * Math.sin(rad);
          const isSelected = i === selectedIndex;
          return (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={isSelected ? 4 : 2.5}
              fill={isSelected ? colors.action.primary : colors.chrome.border}
            />
          );
        })}
        {/* Center dot */}
        <Circle cx={80} cy={70} r={4} fill={colors.chrome.highlight} />
      </Svg>

      {/* Needle — rotates via Animated */}
      <Animated.View
        style={[
          dialStyles.needle,
          {
            transform: [
              { rotate: rotation.interpolate({
                inputRange: [-60, 60],
                outputRange: ['-60deg', '60deg'],
              })},
            ],
          },
        ]}
      >
        <View style={dialStyles.needleLine} />
        <Animated.View style={[dialStyles.needleTip, { opacity: glow }]} />
      </Animated.View>
    </View>
  );
}

const dialStyles = StyleSheet.create({
  container: {
    width: 160,
    height: 80,
    alignSelf: 'center',
    position: 'relative',
  },
  needle: {
    position: 'absolute',
    bottom: 10,
    left: 80 - 1, // center
    width: 2,
    height: 50,
    transformOrigin: 'bottom',
  },
  needleLine: {
    flex: 1,
    width: 2,
    backgroundColor: colors.action.primary,
    borderRadius: 1,
  },
  needleTip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.action.primary,
    alignSelf: 'center',
    marginTop: -3,
  },
});

export function FrequencyForecast({
  candidates,
  reward,
  timeRemaining,
  onPredict,
  lastResult,
}: FrequencyForecastProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [locked, setLocked] = useState(false);
  const resultAnim = useRef(new Animated.Value(0)).current;

  // Animate result reveal
  useEffect(() => {
    if (lastResult) {
      Animated.spring(resultAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
        bounciness: 10,
      }).start();
      if (lastResult.correct) notifySuccess();
    } else {
      resultAnim.setValue(0);
    }
  }, [lastResult, resultAnim]);

  const handleLock = () => {
    if (locked || candidates.length === 0) return;
    setLocked(true);
    tapLight();
    onPredict(candidates[selectedIndex].id);
  };

  const handleSelect = (index: number) => {
    if (locked) return;
    setSelectedIndex(index);
    tapLight();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="labelSmall" color={colors.chrome.text} style={styles.label}>
          FREQUENCY FORECAST
        </Text>
        <View style={styles.rewardBadge}>
          <Text variant="labelSmall" color={colors.cv.positive} style={styles.rewardText}>
            +{reward} CV
          </Text>
        </View>
      </View>

      <Text variant="bodySmall" color={colors.text.muted} style={styles.subtitle}>
        Tune your antenna — predict which track gets the most votes
      </Text>

      {/* Timer */}
      <View style={styles.timerRow}>
        <View style={styles.timerBar}>
          <View
            style={[
              styles.timerFill,
              { width: `${Math.min(100, (timeRemaining / 30) * 100)}%` },
            ]}
          />
        </View>
        <Text variant="labelSmall" color={colors.text.muted} style={styles.timerText}>
          {timeRemaining}s
        </Text>
      </View>

      {/* Tuner dial */}
      {candidates.length > 0 && (
        <TunerDial selectedIndex={selectedIndex} total={candidates.length} />
      )}

      {/* Candidate list */}
      <View style={styles.candidateList}>
        {candidates.map((track, i) => (
          <AnimatedPressable
            key={track.id}
            style={[
              styles.candidate,
              i === selectedIndex && styles.candidateActive,
              locked && i === selectedIndex && styles.candidateLocked,
            ]}
            onPress={() => handleSelect(i)}
            scaleDown={0.97}
            disabled={locked}
            accessibilityRole="button"
            accessibilityLabel={`Predict ${track.title} by ${track.artist}${i === selectedIndex ? ', selected' : ''}`}
            accessibilityState={{ selected: i === selectedIndex, disabled: locked }}
          >
            <Text
              variant="labelSmall"
              color={i === selectedIndex ? colors.action.primary : colors.text.muted}
              style={styles.candidateIndex}
            >
              {i + 1}
            </Text>
            <View style={styles.candidateInfo}>
              <Text
                variant="body"
                color={i === selectedIndex ? colors.text.primary : colors.text.secondary}
                numberOfLines={1}
                style={styles.candidateTitle}
              >
                {track.title}
              </Text>
              <Text variant="bodySmall" color={colors.text.muted} numberOfLines={1}>
                {track.artist}
              </Text>
            </View>
          </AnimatedPressable>
        ))}
      </View>

      {/* Lock button */}
      {!locked ? (
        <AnimatedPressable
          style={styles.lockBtn}
          onPress={handleLock}
          scaleDown={0.95}
          disabled={candidates.length === 0}
          accessibilityRole="button"
          accessibilityLabel={`Lock signal on ${candidates[selectedIndex]?.title || 'selected track'}`}
          accessibilityState={{ disabled: candidates.length === 0 }}
        >
          <Text variant="labelLarge" color={colors.action.primaryText}>
            LOCK SIGNAL
          </Text>
        </AnimatedPressable>
      ) : (
        <Text variant="labelSmall" color={colors.text.muted} style={styles.lockedText}>
          ANTENNA LOCKED — AWAITING RESULTS
        </Text>
      )}

      {/* Result overlay */}
      {lastResult && (
        <Animated.View
          style={[
            styles.resultOverlay,
            {
              opacity: resultAnim,
              transform: [{ scale: resultAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              })}],
            },
          ]}
        >
          <Text
            variant="h2"
            color={lastResult.correct ? colors.cv.positive : colors.action.destructive}
          >
            {lastResult.correct ? 'SIGNAL MATCHED' : 'OFF FREQUENCY'}
          </Text>
          {lastResult.correct && (
            <Text variant="labelLarge" color={colors.cv.positive} style={{ marginTop: 4 }}>
              +{lastResult.earned} CV
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.screenPadding,
    marginVertical: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 9,
    letterSpacing: 2,
  },
  rewardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(57, 255, 20, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.2)',
  },
  rewardText: {
    fontSize: 9,
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  timerBar: {
    flex: 1,
    height: 2,
    backgroundColor: colors.chrome.surface,
    borderRadius: 1,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    backgroundColor: colors.action.primary,
    borderRadius: 1,
  },
  timerText: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  candidateList: {
    gap: 6,
    marginBottom: spacing.sm,
  },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  candidateActive: {
    borderColor: colors.chrome.border,
    backgroundColor: colors.chrome.surface,
  },
  candidateLocked: {
    borderColor: colors.action.primary,
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
  },
  candidateIndex: {
    width: 16,
    textAlign: 'center',
    fontSize: 10,
    letterSpacing: 1,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateTitle: {
    fontSize: 14,
  },
  lockBtn: {
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedText: {
    textAlign: 'center',
    fontSize: 8,
    letterSpacing: 2,
    opacity: 0.6,
    paddingVertical: 12,
  },
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 15, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
});

export default FrequencyForecast;
