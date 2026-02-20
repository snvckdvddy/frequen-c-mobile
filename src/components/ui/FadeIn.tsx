/**
 * FadeIn — Animated entrance wrapper
 *
 * Wraps children in a fade+slide-up animation on mount.
 * Stagger multiple FadeIn components with increasing `delay` props.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;      // ms before starting (default 0)
  duration?: number;   // ms animation length (default 300)
  slideDistance?: number; // px to slide up from (default 12)
  style?: StyleProp<ViewStyle>;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 300,
  slideDistance = 12,
  style,
}: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [opacity, translateY, delay, duration]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

export default FadeIn;
