/**
 * StepSequencer — Queue visualization as a hardware step sequencer.
 *
 * Each track in the queue is a "step" cell. The currently-playing track
 * has a glowing active indicator (like an illuminated step button).
 * Upcoming tracks show as dim cells with contributor color coding.
 *
 * Visual reference: Roland TR-808 / Korg Volca step grid.
 *
 * Props:
 *   queue — array of QueueTrack
 *   currentTrackId — id of the now-playing track
 *   maxSteps — how many steps to show (default 16, like a 4/4 bar)
 *   onStepPress — tap a step to preview/select
 *   roomMode — affects step coloring (sine=warm, square=hot, saw=chrome)
 */

import React, { useRef, useEffect } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { QueueTrack, RoomMode } from '../../types';

interface StepSequencerProps {
  queue: QueueTrack[];
  currentTrackId?: string;
  maxSteps?: number;
  onStepPress?: (track: QueueTrack, index: number) => void;
  roomMode: RoomMode;
  /** Compact mode for mini display */
  compact?: boolean;
}

// Step color per room mode
const modeStepColor: Record<RoomMode, string> = {
  campfire: colors.signal.sine,
  spotlight: colors.signal.square,
  openFloor: colors.signal.saw,
};

const modeStepGlow: Record<RoomMode, string> = {
  campfire: 'rgba(255, 107, 53, 0.25)',
  spotlight: 'rgba(255, 45, 85, 0.25)',
  openFloor: 'rgba(192, 223, 255, 0.25)',
};

// Active step pulse animation
function ActivePulse({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        stepStyles.pulse,
        {
          backgroundColor: color,
          opacity: pulse,
          transform: [{
            scale: pulse.interpolate({
              inputRange: [0.6, 1],
              outputRange: [0.9, 1.15],
            }),
          }],
        },
      ]}
    />
  );
}

export function StepSequencer({
  queue,
  currentTrackId,
  maxSteps = 16,
  onStepPress,
  roomMode,
  compact = false,
}: StepSequencerProps) {
  const stepColor = modeStepColor[roomMode];
  const glowColor = modeStepGlow[roomMode];
  const stepSize = compact ? 28 : 38;
  const gap = compact ? 4 : 6;

  // Build step array — fill empty slots to reach maxSteps
  const steps: (QueueTrack | null)[] = [];
  for (let i = 0; i < maxSteps; i++) {
    steps.push(queue[i] || null);
  }

  return (
    <View style={seqStyles.container}>
      {/* Sequencer label */}
      {!compact && (
        <View style={seqStyles.labelRow}>
          <Text variant="labelSmall" color={colors.chrome.text} style={seqStyles.label}>
            STEP SEQUENCER
          </Text>
          <Text variant="labelSmall" color={colors.text.muted} style={seqStyles.counter}>
            {queue.length}/{maxSteps}
          </Text>
        </View>
      )}

      {/* Step grid — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          seqStyles.grid,
          { gap },
        ]}
      >
        {steps.map((track, i) => {
          const isActive = track?.id === currentTrackId;
          const isFilled = track !== null;
          const hasVotes = (track?.votes ?? 0) > 0;

          return (
            <TouchableOpacity
              key={track?.id ?? `empty-${i}`}
              style={[
                stepStyles.step,
                {
                  width: stepSize,
                  height: stepSize,
                  borderRadius: compact ? 4 : 6,
                },
                isFilled && {
                  backgroundColor: isActive ? glowColor : colors.bg.elevated,
                  borderColor: isActive ? stepColor : colors.chrome.border,
                },
                !isFilled && stepStyles.emptyStep,
              ]}
              onPress={() => track && onStepPress?.(track, i)}
              activeOpacity={isFilled ? 0.7 : 1}
              disabled={!isFilled}
            >
              {/* Active pulse indicator */}
              {isActive && <ActivePulse color={stepColor} />}

              {/* Step number */}
              {!isActive && isFilled && (
                <Text
                  variant="labelSmall"
                  color={colors.text.muted}
                  style={stepStyles.stepNum}
                >
                  {i + 1}
                </Text>
              )}

              {/* Vote indicator — small dot above step */}
              {hasVotes && !compact && (
                <View
                  style={[
                    stepStyles.voteDot,
                    { backgroundColor: stepColor },
                  ]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Track position indicator bar */}
      {!compact && queue.length > 0 && (
        <View style={seqStyles.positionBar}>
          <View
            style={[
              seqStyles.positionFill,
              {
                width: `${Math.min(100, (queue.length / maxSteps) * 100)}%`,
                backgroundColor: stepColor,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const seqStyles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1.5,
  },
  counter: {
    fontSize: 9,
    letterSpacing: 1,
  },
  grid: {
    paddingHorizontal: spacing.screenPadding,
    alignItems: 'center',
  },
  positionBar: {
    height: 2,
    backgroundColor: colors.chrome.surface,
    marginHorizontal: spacing.screenPadding,
    marginTop: spacing.sm,
    borderRadius: 1,
    overflow: 'hidden',
  },
  positionFill: {
    height: '100%',
    borderRadius: 1,
    opacity: 0.6,
  },
});

const stepStyles = StyleSheet.create({
  step: {
    borderWidth: 1,
    borderColor: colors.chrome.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyStep: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(192, 223, 255, 0.06)',
    borderStyle: 'dashed',
  },
  pulse: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: 4,
  },
  stepNum: {
    fontSize: 8,
    letterSpacing: 0,
  },
  voteDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

export default StepSequencer;
