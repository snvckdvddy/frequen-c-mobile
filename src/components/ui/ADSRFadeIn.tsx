/**
 * ADSRFadeIn — Section-level staggered reveal with ADSR timing.
 *
 * Like FadeIn but uses Attack/Decay phases instead of linear fade.
 * The Attack phase snaps the element in (with slight overshoot),
 * then Decay settles to the sustain opacity.
 *
 * Usage:
 *   <ADSRFadeIn index={0}>Header</ADSRFadeIn>
 *   <ADSRFadeIn index={1}>Content</ADSRFadeIn>
 *   <ADSRFadeIn index={2}>Footer</ADSRFadeIn>
 *
 * Each index adds 60ms stagger delay.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle, StyleProp } from 'react-native';

interface ADSRFadeInProps {
  children: React.ReactNode;
  /** Stagger index — each adds staggerMs delay */
  index?: number;
  /** Stagger interval in ms (default 60) */
  staggerMs?: number;
  /** Attack duration (snap-in) in ms (default 100) */
  attack?: number;
  /** Decay duration (settle) in ms (default 80) */
  decay?: number;
  /** Sustain opacity 0-1 (default 1) */
  sustain?: number;
  /** Slide distance in px (default 16) */
  slideDistance?: number;
  /** Slide direction */
  slideFrom?: 'bottom' | 'right' | 'left';
  /** Extra style */
  style?: StyleProp<ViewStyle>;
}

export function ADSRFadeIn({
  children,
  index = 0,
  staggerMs = 60,
  attack = 100,
  decay = 80,
  sustain = 1,
  slideDistance = 16,
  slideFrom = 'bottom',
  style,
}: ADSRFadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(slideDistance)).current;
  const scale = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    const delay = index * staggerMs;

    const timer = setTimeout(() => {
      // Attack: snap in with overshoot
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1.05, // slight overshoot
          duration: attack,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(translate, {
          toValue: -2, // slight overshoot past target
          duration: attack,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1.01,
          duration: attack,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Decay: settle to sustain
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: sustain,
            duration: decay,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translate, {
            toValue: 0,
            duration: decay,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: decay,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [index, staggerMs, attack, decay, sustain, opacity, translate, scale]);

  const transformProp =
    slideFrom === 'right'
      ? { translateX: translate }
      : slideFrom === 'left'
      ? {
          translateX: translate.interpolate({
            inputRange: [-2, 0, slideDistance],
            outputRange: [2, 0, -slideDistance],
          }),
        }
      : { translateY: translate };

  return (
    <Animated.View
      style={[
        {
          opacity: opacity.interpolate({
            inputRange: [0, 1, 1.05],
            outputRange: [0, 1, 1],
            extrapolate: 'clamp',
          }),
          transform: [transformProp, { scale }],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default ADSRFadeIn;
