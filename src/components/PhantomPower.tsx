/**
 * Phantom Power — +48V Track Boost Visual
 *
 * When a user spends 5 CV to "Phantom Power" a track, this component
 * renders a surge animation on the boosted track card.
 *
 * Visual metaphor: On real audio gear, +48V phantom power is a
 * voltage boost sent through the signal cable. Here it's a bright
 * voltage arc that wraps the track card momentarily.
 *
 * Research pillar: CV Economy — tangible cost for tangible impact.
 * Phantom Power doubles the current vote weight of a track for one
 * round, giving underdogs a shot.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Animated, Easing, Dimensions,
} from 'react-native';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Text } from './ui/Text';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { tapHeavy, notifySuccess } from '../utils/haptics';

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

interface PhantomPowerProps {
  /** Whether the boost animation is active */
  active: boolean;
  /** Username of the booster */
  username?: string;
  /** Track name being boosted */
  trackName?: string;
  /** Called when animation completes */
  onComplete?: () => void;
}

/** Lightning bolt path for the +48V icon */
const BOLT_PATH = 'M 12 2 L 5 14 L 11 14 L 9 22 L 19 10 L 13 10 L 15 2 Z';

export function PhantomPower({
  active,
  username,
  trackName,
  onComplete,
}: PhantomPowerProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const voltageGlow = useRef(new Animated.Value(0)).current;
  const boltScale = useRef(new Animated.Value(0)).current;
  const surgeWidth = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const animate = useCallback(() => {
    tapHeavy();

    // Reset all values
    opacity.setValue(0);
    voltageGlow.setValue(0);
    boltScale.setValue(0);
    surgeWidth.setValue(0);
    textOpacity.setValue(0);

    Animated.sequence([
      // Phase 1: Container fades in + bolt snaps in (150ms)
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(boltScale, {
          toValue: 1,
          damping: 8,
          stiffness: 300,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: Voltage surge line sweeps across (300ms)
      Animated.timing(surgeWidth, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // width animation
      }),

      // Phase 3: Glow pulse + text reveal (200ms)
      Animated.parallel([
        Animated.timing(voltageGlow, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),

      // Hold (800ms)
      Animated.delay(800),

      // Phase 4: Everything fades out (400ms)
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(voltageGlow, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      notifySuccess();
      onComplete?.();
    });
  }, [opacity, voltageGlow, boltScale, surgeWidth, textOpacity, onComplete]);

  useEffect(() => {
    if (active) {
      animate();
    }
  }, [active, animate]);

  if (!active) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      {/* Voltage glow background */}
      <Animated.View
        style={[
          styles.glowBg,
          {
            opacity: voltageGlow.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.15],
            }),
          },
        ]}
      />

      {/* Surge line — sweeps left to right */}
      <Animated.View
        style={[
          styles.surgeLine,
          {
            width: surgeWidth.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />

      {/* Bolt icon + label */}
      <Animated.View
        style={[
          styles.boltContainer,
          {
            transform: [{ scale: boltScale }],
          },
        ]}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path
            d={BOLT_PATH}
            fill={colors.cv.positive}
            stroke={colors.cv.positive}
            strokeWidth={0.5}
          />
        </Svg>
      </Animated.View>

      {/* +48V label */}
      <Animated.View style={[styles.labelRow, { opacity: textOpacity }]}>
        <Text variant="labelSmall" color={colors.cv.positive} style={styles.voltageLabel}>
          +48V PHANTOM POWER
        </Text>
        {username && (
          <Text variant="labelSmall" color={colors.text.muted} style={styles.attribution}>
            {username} boosted {trackName || 'this track'}
          </Text>
        )}
      </Animated.View>

      {/* Top/bottom voltage rails */}
      <View style={styles.railTop} />
      <View style={styles.railBottom} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: colors.cv.positive,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  glowBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.cv.positive,
  },
  surgeLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2,
    backgroundColor: colors.cv.positive,
  },
  boltContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(57, 255, 20, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(57, 255, 20, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  labelRow: {
    alignItems: 'center',
  },
  voltageLabel: {
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: '700',
  },
  attribution: {
    fontSize: 9,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  railTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.cv.positive,
    opacity: 0.6,
  },
  railBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.cv.positive,
    opacity: 0.6,
  },
});

export default PhantomPower;
