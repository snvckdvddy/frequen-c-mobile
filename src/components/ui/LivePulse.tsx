/**
 * LivePulse — Animated "LIVE" indicator with pulsing glow.
 *
 * Convergence Strategy §7:
 * Live indicator pulse: 2000ms ease-in-out loop
 * neonGreen dot opacity cycles 0.4 → 1.0 → 0.4
 *
 * Renders a pulsing dot + optional "LIVE" label.
 * Used on RoomCard, ParticipantAvatarBar, session headers.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { DURATION } from '../../theme/motion';

interface LivePulseProps {
  /** Dot size in px (default 8) */
  size?: number;
  /** Show "LIVE" text label (default true) */
  showLabel?: boolean;
  /** Color override (default neonGreen) */
  color?: string;
  /** Pause the animation (e.g., when off-screen) */
  paused?: boolean;
}

export function LivePulse({
  size = 8,
  showLabel = true,
  color = colors.raw.neonGreen,
  paused = false,
}: LivePulseProps) {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (paused) {
      loopRef.current?.stop();
      return;
    }

    // §7: 2000ms ease-in-out loop, opacity 0.4 → 1.0 → 0.4
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: DURATION.livePulse / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: DURATION.livePulse / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    loopRef.current = animation;
    animation.start();

    return () => animation.stop();
  }, [paused, pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            opacity: pulseAnim,
            // Glow ring via shadow
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: pulseAnim as any,
            shadowRadius: size,
          },
        ]}
      />
      {showLabel && (
        <Animated.Text
          style={[
            styles.label,
            { color, opacity: pulseAnim },
          ]}
        >
          LIVE
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    elevation: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
});

export default LivePulse;
