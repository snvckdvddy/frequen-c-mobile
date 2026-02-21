/**
 * useADSR — Attack/Decay/Sustain/Release animation hook.
 *
 * Maps audio envelope concepts to UI micro-interactions.
 * Every screen transition, button press, modal, and notification
 * uses this system instead of generic slide/fade.
 */

import { useRef, useCallback } from 'react';
import { Animated, Easing } from 'react-native';

export interface ADSRConfig {
  /** Snap-in duration in ms (fast, 60-150ms) */
  attack: number;
  /** Settle duration in ms (100-200ms) */
  decay: number;
  /** Hold level 0-1 */
  sustain: number;
  /** Fade-out duration in ms (200-400ms) */
  release: number;
  /** Easing curve for attack phase */
  curve?: 'linear' | 'ease' | 'spring';
}

/** Common presets mapped to interaction types */
export const ADSR_PRESETS: Record<string, ADSRConfig> = {
  screenEnter:  { attack: 100, decay: 80,  sustain: 1,    release: 300, curve: 'ease' },
  screenExit:   { attack: 80,  decay: 60,  sustain: 0,    release: 250, curve: 'ease' },
  cardPress:    { attack: 60,  decay: 40,  sustain: 0.95, release: 150, curve: 'spring' },
  modalReveal:  { attack: 120, decay: 100, sustain: 1,    release: 250, curve: 'spring' },
  toastAlert:   { attack: 80,  decay: 60,  sustain: 1,    release: 400, curve: 'ease' },
  pulseGlow:    { attack: 200, decay: 300, sustain: 0.6,  release: 500, curve: 'linear' },
  resonance:    { attack: 60,  decay: 150, sustain: 0.8,  release: 600, curve: 'spring' },
  patchIn:      { attack: 80,  decay: 120, sustain: 1,    release: 200, curve: 'spring' },
} as const;

function getEasing(curve: ADSRConfig['curve']) {
  switch (curve) {
    case 'linear': return Easing.linear;
    case 'spring': return Easing.out(Easing.back(1.2));
    case 'ease':
    default:       return Easing.out(Easing.cubic);
  }
}

export function useADSR(config: ADSRConfig) {
  const value = useRef(new Animated.Value(0)).current;
  const isActive = useRef(false);

  /** Trigger attack → decay → sustain */
  const trigger = useCallback(() => {
    isActive.current = true;
    Animated.sequence([
      // Attack: 0 → 1 (overshoot target slightly for snap)
      Animated.timing(value, {
        toValue: 1,
        duration: config.attack,
        easing: getEasing(config.curve),
        useNativeDriver: true,
      }),
      // Decay: 1 → sustain level
      Animated.timing(value, {
        toValue: config.sustain,
        duration: config.decay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [config.attack, config.decay, config.sustain, config.curve, value]);

  /** Release: sustain → 0 */
  const release = useCallback(() => {
    isActive.current = false;
    Animated.timing(value, {
      toValue: 0,
      duration: config.release,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [config.release, value]);

  /** Full cycle: trigger → hold for duration → release */
  const triggerAndRelease = useCallback((holdMs: number = 0) => {
    trigger();
    setTimeout(() => {
      release();
    }, config.attack + config.decay + holdMs);
  }, [trigger, release, config.attack, config.decay]);

  /** Reset to 0 immediately */
  const reset = useCallback(() => {
    isActive.current = false;
    value.setValue(0);
  }, [value]);

  return {
    value,
    trigger,
    release,
    triggerAndRelease,
    reset,
    isActive: isActive.current,
  };
}

export default useADSR;
