/**
 * Transient Enter — User Walk-On Animation
 *
 * In audio, a "transient" is the initial sharp attack of a sound —
 * the pick hitting a guitar string, the beater hitting a drum head.
 * It's the moment of arrival.
 *
 * When a user joins a session, a brief notification slides in from
 * the right showing their name with a transient waveform spike.
 * The animation mirrors a transient: sharp attack, fast decay.
 *
 * Research pillar: Presence & Identity — making arrivals feel
 * tangible creates social accountability and belonging.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Text } from './ui/Text';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { tapLight } from '../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TransientEnterProps {
  /** Username of the arriving user */
  username: string;
  /** Optional avatar URL (future: render image) */
  avatarUrl?: string;
  /** Whether this notification is active */
  active: boolean;
  /** Called when animation completes */
  onComplete?: () => void;
}

/**
 * Generates a transient waveform — sharp spike then rapid decay.
 * Like a drum hit's amplitude envelope.
 */
function generateTransientPath(width: number, height: number): string {
  const midY = height / 2;
  const points: string[] = [`M 0 ${midY}`];
  const steps = 40;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Exponential decay envelope with initial spike
    const envelope = Math.exp(-t * 5) * (1 - Math.exp(-t * 30));
    // High-frequency oscillation under envelope
    const osc = Math.sin(t * Math.PI * 14);
    const y = midY + osc * envelope * (height * 0.4);
    const x = t * width;
    points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return points.join(' ');
}

export function TransientEnter({
  username,
  avatarUrl,
  active,
  onComplete,
}: TransientEnterProps) {
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const waveOpacity = useRef(new Animated.Value(0)).current;
  const dotScale = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    tapLight();

    // Reset
    translateX.setValue(SCREEN_WIDTH);
    opacity.setValue(0);
    waveOpacity.setValue(0);
    dotScale.setValue(0);

    Animated.sequence([
      // Attack: slide in from right (200ms) — sharp, like a transient
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]),

      // Waveform flash + presence dot (150ms)
      Animated.parallel([
        Animated.timing(waveOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(dotScale, {
          toValue: 1,
          damping: 10,
          stiffness: 400,
          useNativeDriver: true,
        }),
      ]),

      // Waveform decays (like a real transient)
      Animated.timing(waveOpacity, {
        toValue: 0.2,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),

      // Hold (1500ms)
      Animated.delay(1500),

      // Release: slide out right (250ms)
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH,
          duration: 250,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete?.();
    });
  }, [translateX, opacity, waveOpacity, dotScale, onComplete]);

  useEffect(() => {
    if (active) {
      animate();
    }
  }, [active, animate]);

  if (!active) return null;

  const waveWidth = 80;
  const waveHeight = 24;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateX }],
        },
      ]}
      pointerEvents="none"
    >
      {/* Presence indicator dot */}
      <Animated.View
        style={[
          styles.presenceDot,
          { transform: [{ scale: dotScale }] },
        ]}
      />

      {/* Username */}
      <View style={styles.textContainer}>
        <Text variant="labelSmall" color={colors.text.muted} style={styles.actionLabel}>
          SIGNAL DETECTED
        </Text>
        <Text variant="body" color={colors.text.primary} style={styles.username}>
          {username}
        </Text>
      </View>

      {/* Transient waveform */}
      <Animated.View style={{ opacity: waveOpacity }}>
        <Svg width={waveWidth} height={waveHeight} viewBox={`0 0 ${waveWidth} ${waveHeight}`}>
          <Path
            d={generateTransientPath(waveWidth, waveHeight)}
            stroke={colors.action.primary}
            strokeWidth={1.5}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100, // Below status bar area
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chrome.surface,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    borderRightWidth: 0,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingRight: spacing.lg,
    zIndex: 900,
    // Subtle shadow
    shadowColor: colors.action.primary,
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.session.live,
    marginRight: spacing.sm,
  },
  textContainer: {
    marginRight: spacing.sm,
  },
  actionLabel: {
    fontSize: 7,
    letterSpacing: 2,
    opacity: 0.6,
  },
  username: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default TransientEnter;
