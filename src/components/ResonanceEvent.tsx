/**
 * Resonance Event — Synchronized Session Event Overlay
 *
 * When natural moments of high engagement are detected (everyone
 * voting at once, reaction clusters, etc.), the server emits a
 * "resonance" event. This triggers a full-screen overlay with
 * a shared visual moment — everyone sees it simultaneously.
 *
 * Visual: Full-screen waveform pulse that builds, peaks, and
 * decays. Like a room-wide bass drop moment.
 *
 * Types:
 *   - harmonic: Everyone vibing (high reaction density)
 *   - octave: Unanimous vote (all votes same direction)
 *   - feedback: Session milestone (100 tracks, 1hr, etc.)
 *
 * Research pillar: Shared Experience Architecture —
 * synchronized events create collective memory and bonding.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from './ui/Text';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import { tapHeavy, notifySuccess } from '../utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ResonanceType = 'harmonic' | 'octave' | 'feedback';

interface ResonanceEventProps {
  /** Type of resonance event */
  type: ResonanceType;
  /** Display message */
  message: string;
  /** CV bonus awarded */
  cvBonus?: number;
  /** Whether the event is currently active */
  active: boolean;
  /** Duration of the event in ms (default 4000) */
  duration?: number;
  /** Called when event animation completes */
  onComplete?: () => void;
}

const RESONANCE_CONFIG: Record<ResonanceType, {
  color: string;
  glow: string;
  label: string;
  waveIntensity: number;
}> = {
  harmonic: {
    color: palette.orange,
    glow: 'rgba(90, 200, 200, 0.3)',
    label: 'HARMONIC RESONANCE',
    waveIntensity: 1,
  },
  octave: {
    color: palette.green,
    glow: 'rgba(52, 211, 153, 0.3)',
    label: 'OCTAVE LOCK',
    waveIntensity: 1.5,
  },
  feedback: {
    color: palette.ice,
    glow: 'rgba(192, 223, 255, 0.3)',
    label: 'FEEDBACK LOOP',
    waveIntensity: 0.8,
  },
};

/** Generates a sine wave path with variable amplitude */
function generateWavePath(
  width: number,
  height: number,
  amplitude: number,
  frequency: number,
  phase: number,
): string {
  const points: string[] = [];
  const midY = height / 2;
  const steps = 80;

  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = midY + Math.sin((i / steps) * Math.PI * 2 * frequency + phase) * amplitude;
    points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
  }

  return points.join(' ');
}

export function ResonanceEvent({
  type,
  message,
  cvBonus,
  active,
  duration = 4000,
  onComplete,
}: ResonanceEventProps) {
  const config = RESONANCE_CONFIG[type];
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const wavePhase = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(0.5)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    tapHeavy();

    // ADSR-style envelope for the whole event
    Animated.sequence([
      // Attack: snap in (200ms)
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 200,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),

      // Decay → Sustain: settle and hold (most of the duration)
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),

      // Hold
      Animated.delay(duration - 1200),

      // Release: fade out (500ms)
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete?.();
    });

    // Continuous wave animation
    Animated.loop(
      Animated.timing(wavePhase, {
        toValue: Math.PI * 2,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    // Pulsing rings
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.out(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseScale, {
          toValue: 0.5,
          duration: 800,
          easing: Easing.in(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [opacity, scale, wavePhase, pulseScale, textOpacity, duration, onComplete]);

  useEffect(() => {
    if (active) {
      animate();
    } else {
      // Reset
      opacity.setValue(0);
      scale.setValue(0.8);
      wavePhase.setValue(0);
      textOpacity.setValue(0);
    }
  }, [active, animate, opacity, scale, wavePhase, textOpacity]);

  if (!active) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }],
        },
      ]}
      pointerEvents="none"
    >
      {/* Background radial glow */}
      <Animated.View
        style={[
          styles.radialGlow,
          {
            backgroundColor: config.glow,
            transform: [{ scale: pulseScale }],
          },
        ]}
      />

      {/* Waveform visualization */}
      <Svg
        width={SCREEN_WIDTH}
        height={120}
        viewBox={`0 0 ${SCREEN_WIDTH} 120`}
        style={styles.wave}
      >
        {/* Primary wave */}
        <Path
          d={generateWavePath(
            SCREEN_WIDTH,
            120,
            30 * config.waveIntensity,
            3,
            0
          )}
          stroke={config.color}
          strokeWidth={2}
          fill="none"
          opacity={0.8}
        />
        {/* Secondary wave (phase offset) */}
        <Path
          d={generateWavePath(
            SCREEN_WIDTH,
            120,
            20 * config.waveIntensity,
            4,
            Math.PI / 3
          )}
          stroke={config.color}
          strokeWidth={1}
          fill="none"
          opacity={0.4}
        />
        {/* Tertiary wave */}
        <Path
          d={generateWavePath(
            SCREEN_WIDTH,
            120,
            12 * config.waveIntensity,
            6,
            Math.PI / 1.5
          )}
          stroke={config.color}
          strokeWidth={0.5}
          fill="none"
          opacity={0.2}
        />
      </Svg>

      {/* Label + message */}
      <Animated.View style={[styles.textContent, { opacity: textOpacity }]}>
        <Text variant="labelSmall" color={config.color} style={styles.typeLabel}>
          {config.label}
        </Text>
        <Text variant="h1" color={palette.frost} style={styles.message}>
          {message}
        </Text>
        {cvBonus != null && cvBonus > 0 && (
          <Text variant="labelLarge" color={palette.green} style={styles.cvLabel}>
            +{cvBonus} CV
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 16, 18, 0.94)',
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.5,
  },
  wave: {
    position: 'absolute',
    top: '35%',
  },
  textContent: {
    alignItems: 'center',
    zIndex: 1,
    paddingHorizontal: spacing.screenPadding,
  },
  typeLabel: {
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  message: {
    textAlign: 'center',
    lineHeight: 36,
  },
  cvLabel: {
    marginTop: spacing.sm,
    fontSize: 16,
    letterSpacing: 2,
  },
});

export default ResonanceEvent;
