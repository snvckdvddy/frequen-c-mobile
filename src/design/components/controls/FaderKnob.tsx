/**
 * FaderKnob — Physical crossfader control.
 * ─────────────────────────────────────────────────────────────
 * Recessed track with draggable chrome knob.
 * Matches Gemini V7 prototype crossfader.
 *
 * Track: Recessed slot with inset shadow
 * Knob: 5-stop chrome gradient with center line indicator
 * Draggable via PanResponder
 *
 * Usage:
 *   <FaderKnob value={50} onValueChange={setMix} />
 */

import React, { useRef } from 'react';
import {
  View,
  PanResponder,
  StyleSheet,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../../tokens/materials';
import { elevation } from '../../tokens/elevation';

interface FaderKnobProps {
  /** Value from 0 to 100 */
  value: number;
  /** Called when user drags knob */
  onValueChange: (value: number) => void;
  /** Override container style */
  style?: StyleProp<ViewStyle>;
}

const KNOB_SIZE = 24;
const TRACK_WIDTH = 120;
const TRACK_HEIGHT = 6;

// Knob chrome gradient (5-stop)
const knobGradient = [
  palette.gunmetal,
  palette.steel,
  palette.slate,
  palette.steel,
  palette.gunmetal,
] as unknown as [string, string, ...string[]];
const knobLocations = [0, 0.25, 0.5, 0.75, 1] as unknown as [
  number,
  number,
  ...number[],
];

export function FaderKnob({ value, onValueChange, style }: FaderKnobProps) {
  const trackWidth = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const newValue = Math.max(
          0,
          Math.min(100, (gestureState.moveX / trackWidth.current) * 100),
        );
        onValueChange(newValue);
      },
    }),
  ).current;

  const knobPosition = (value / 100) * (trackWidth.current - KNOB_SIZE);

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Track */}
      <View
        style={[styles.track]}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Recessed slot background */}
        <View style={styles.trackSlot} />

        {/* Inset shadow for recessed effect */}
        <View style={styles.trackInsetShadow} />

        {/* Draggable knob */}
        <View
          style={[
            styles.knobWrapper,
            {
              transform: [{ translateX: knobPosition }],
            },
          ]}
        >
          <LinearGradient
            colors={knobGradient}
            locations={knobLocations}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.knob}
          >
            {/* Center line indicator */}
            <View style={styles.knobIndicator} />
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  track: {
    width: TRACK_WIDTH,
    height: KNOB_SIZE,
    justifyContent: 'center',
    position: 'relative',
  },
  trackSlot: {
    position: 'absolute',
    left: KNOB_SIZE / 2,
    right: KNOB_SIZE / 2,
    height: TRACK_HEIGHT,
    backgroundColor: palette.gunmetal,
    borderRadius: 2,
  },
  trackInsetShadow: {
    position: 'absolute',
    left: KNOB_SIZE / 2,
    right: KNOB_SIZE / 2,
    top: 2,
    height: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 1,
  },
  knobWrapper: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.raised.shadows[0],
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  knobIndicator: {
    position: 'absolute',
    top: 2,
    left: '50%',
    marginLeft: -0.5,
    width: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 0.5,
  },
});
