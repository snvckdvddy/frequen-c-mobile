/**
 * Reverb Tail — Ghost Presence After Departure
 *
 * In audio, reverb tail is the sound that lingers after the source
 * stops. A room's character is defined by how long the reverb takes
 * to decay — a cathedral vs. a closet.
 *
 * When a user leaves a session, they don't vanish instantly. Their
 * avatar/name fades out gradually over a configurable duration
 * (default 30s), creating a "ghost" presence. This mirrors how
 * in physical spaces, you feel someone's absence gradually.
 *
 * Visual: Semi-transparent card that slowly decays in opacity,
 * with a subtle noise/grain texture suggesting signal degradation.
 *
 * Research pillar: Presence & Identity — departures should feel
 * organic, not abrupt. The reverb tail creates continuity.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Animated, Easing,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from './ui/Text';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';

interface ReverbTailProps {
  /** Username of the departed user */
  username: string;
  /** How long the ghost persists in ms (default 30000) */
  duration?: number;
  /** Whether this ghost is active */
  active: boolean;
  /** Called when the ghost fully decays */
  onDecayed?: () => void;
}

/** Decaying sine wave — signal fading out */
function generateDecayPath(width: number, height: number): string {
  const midY = height / 2;
  const points: string[] = [];
  const steps = 50;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Exponential decay
    const envelope = Math.exp(-t * 3);
    const osc = Math.sin(t * Math.PI * 8);
    const y = midY + osc * envelope * (height * 0.35);
    const x = t * width;
    points.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return points.join(' ');
}

export function ReverbTail({
  username,
  duration = 30000,
  active,
  onDecayed,
}: ReverbTailProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const innerOpacity = useRef(new Animated.Value(1)).current;
  const noiseOffset = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    // Reset
    opacity.setValue(0);
    innerOpacity.setValue(1);
    noiseOffset.setValue(0);

    Animated.sequence([
      // Appear (the ghost materializes)
      Animated.timing(opacity, {
        toValue: 0.6,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),

      // Long slow decay — the reverb tail
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: duration - 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Inner content fades faster than container
        Animated.timing(innerOpacity, {
          toValue: 0,
          duration: duration * 0.6,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        // Noise/degradation increases over time
        Animated.timing(noiseOffset, {
          toValue: 1,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ]),
    ]).start(() => {
      onDecayed?.();
    });
  }, [opacity, innerOpacity, noiseOffset, duration, onDecayed]);

  useEffect(() => {
    if (active) {
      animate();
    }
  }, [active, animate]);

  if (!active) return null;

  const waveWidth = 100;
  const waveHeight = 16;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {/* Ghost border — dashed to suggest impermanence */}
      <View style={styles.ghostBorder}>
        <Animated.View style={[styles.content, { opacity: innerOpacity }]}>
          {/* Decay waveform */}
          <Svg
            width={waveWidth}
            height={waveHeight}
            viewBox={`0 0 ${waveWidth} ${waveHeight}`}
            style={styles.wave}
          >
            <Path
              d={generateDecayPath(waveWidth, waveHeight)}
              stroke={palette.slate}
              strokeWidth={1}
              fill="none"
              opacity={0.5}
            />
          </Svg>

          {/* Ghost info */}
          <View style={styles.infoRow}>
            <View style={styles.ghostDot} />
            <Text variant="labelSmall" color={palette.slate} style={styles.username}>
              {username}
            </Text>
            <Text variant="labelSmall" color={palette.slate} style={styles.statusLabel}>
              REVERB TAIL
            </Text>
          </View>
        </Animated.View>

        {/* Signal degradation overlay — grows more "noisy" over time */}
        <Animated.View
          style={[
            styles.degradationOverlay,
            {
              opacity: noiseOffset.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.4],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    marginHorizontal: spacing.screenPadding,
  },
  ghostBorder: {
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderStyle: 'dashed',
    borderRadius: 8,
    overflow: 'hidden',
  },
  content: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  wave: {
    marginBottom: spacing.xs,
    opacity: 0.4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ghostDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.slate,
    opacity: 0.4,
    marginRight: spacing.xs,
  },
  username: {
    fontSize: 11,
    opacity: 0.6,
    marginRight: spacing.sm,
  },
  statusLabel: {
    fontSize: 8,
    letterSpacing: 2,
    opacity: 0.3,
  },
  degradationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.midnight,
  },
});

export default ReverbTail;
