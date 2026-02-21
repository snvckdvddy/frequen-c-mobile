/**
 * ADSRTransition — Screen-level enter/exit animation wrapper.
 *
 * Replaces generic React Navigation slide/fade with ADSR envelope
 * behavior. Attack = snap in. Decay = settle. Sustain = hold.
 * Release = fade out on unmount.
 *
 * Usage:
 *   <ADSRTransition preset="screenEnter">
 *     <YourScreen />
 *   </ADSRTransition>
 *
 * Or with custom config:
 *   <ADSRTransition config={{ attack: 120, decay: 80, sustain: 1, release: 300 }}>
 *     ...
 *   </ADSRTransition>
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, Easing, ViewStyle, StyleProp } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ADSR_PRESETS, type ADSRConfig } from '../../hooks/useADSR';

interface ADSRTransitionProps {
  children: React.ReactNode;
  /** Named preset from useADSR */
  preset?: keyof typeof ADSR_PRESETS;
  /** Custom ADSR config (overrides preset) */
  config?: ADSRConfig;
  /** Extra style on the animated wrapper */
  style?: StyleProp<ViewStyle>;
  /** Slide direction for attack phase */
  slideFrom?: 'bottom' | 'right' | 'none';
  /** Slide distance in px (default 20) */
  slideDistance?: number;
  /** Scale overshoot on attack (default 1.02) */
  scaleOvershoot?: number;
}

function getEasing(curve: ADSRConfig['curve']) {
  switch (curve) {
    case 'linear': return Easing.linear;
    case 'spring': return Easing.out(Easing.back(1.2));
    case 'ease':
    default:       return Easing.out(Easing.cubic);
  }
}

export function ADSRTransition({
  children,
  preset = 'screenEnter',
  config,
  style,
  slideFrom = 'bottom',
  slideDistance = 20,
  scaleOvershoot = 1.02,
}: ADSRTransitionProps) {
  const adsr = config || ADSR_PRESETS[preset] || ADSR_PRESETS.screenEnter;
  const isFocused = useIsFocused();

  // Animation values
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(slideFrom === 'bottom' ? slideDistance : 0)).current;
  const translateX = useRef(new Animated.Value(slideFrom === 'right' ? slideDistance : 0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  const hasEntered = useRef(false);

  // Attack → Decay → Sustain
  const triggerEnter = useCallback(() => {
    if (hasEntered.current) return;
    hasEntered.current = true;

    const easing = getEasing(adsr.curve);

    // Attack: snap in (0 → 1, translate → 0, scale → overshoot)
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: adsr.attack,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: slideFrom === 'bottom' ? -2 : 0, // slight overshoot
        duration: adsr.attack,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: slideFrom === 'right' ? -2 : 0,
        duration: adsr.attack,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: scaleOvershoot,
        duration: adsr.attack,
        easing,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Decay: settle to sustain level
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: adsr.sustain,
          duration: adsr.decay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: adsr.decay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: adsr.decay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: adsr.decay,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [adsr, opacity, translateY, translateX, scale, slideFrom, scaleOvershoot]);

  // Release: fade out
  const triggerExit = useCallback(() => {
    hasEntered.current = false;

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: adsr.release,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.97,
        duration: adsr.release,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [adsr.release, opacity, scale]);

  // React to focus changes
  useEffect(() => {
    if (isFocused) {
      triggerEnter();
    } else {
      triggerExit();
    }
  }, [isFocused, triggerEnter, triggerExit]);

  return (
    <Animated.View
      style={[
        { flex: 1 },
        {
          opacity,
          transform: [
            { translateY },
            { translateX },
            { scale },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export default ADSRTransition;
