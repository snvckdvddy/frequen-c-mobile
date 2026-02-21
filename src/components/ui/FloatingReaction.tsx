/**
 * FloatingReaction — Animated emoji that floats upward and fades out.
 *
 * Convergence Strategy §7:
 * - Duration: 1500ms
 * - Easing: ease-out + fade
 * - Motion: floats upward 80pt
 * - Scale: 1 → 1.2 → 0
 * - Opacity: 1 → 0
 *
 * Usage: render inside a positioned container. Each instance
 * auto-removes itself after the animation completes.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text as RNText } from 'react-native';

interface FloatingReactionProps {
  /** Emoji character to float */
  emoji: string;
  /** Starting X offset from center (default 0) */
  offsetX?: number;
  /** Called when animation completes — parent should unmount */
  onComplete: () => void;
  /** Size of the emoji (default 36) */
  size?: number;
}

const FLOAT_DISTANCE = 80;  // §7 — 80pt upward
const DURATION = 1500;       // §7 — 1500ms total

export function FloatingReaction({
  emoji,
  offsetX = 0,
  onComplete,
  size = 36,
}: FloatingReactionProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Run all three animations in parallel — §7 spec
    Animated.parallel([
      // Float upward 80pt
      Animated.timing(translateY, {
        toValue: -FLOAT_DISTANCE,
        duration: DURATION,
        useNativeDriver: true,
      }),
      // Scale: 1 → 1.2 (first 30%), then 1.2 → 0 (remaining 70%)
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.2,
          duration: DURATION * 0.3,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0,
          duration: DURATION * 0.7,
          useNativeDriver: true,
        }),
      ]),
      // Fade: hold full opacity for 40%, then fade to 0
      Animated.sequence([
        Animated.delay(DURATION * 0.4),
        Animated.timing(opacity, {
          toValue: 0,
          duration: DURATION * 0.6,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete();
    });
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateX: offsetX },
            { translateY },
            { scale },
          ],
          opacity,
        },
      ]}
      pointerEvents="none"
    >
      <RNText style={[styles.emoji, { fontSize: size }]}>{emoji}</RNText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  emoji: {
    textAlign: 'center',
  },
});

export default FloatingReaction;
