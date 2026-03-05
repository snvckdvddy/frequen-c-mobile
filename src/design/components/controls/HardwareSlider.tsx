/**
 * HardwareSlider — Physical slider control.
 * ─────────────────────────────────────────────────────────────
 * Recessed track with chrome gradient thumb.
 * Matches Gemini V7 prototype `.hardware-slider` class.
 *
 * Track: Dark recessed groove with inset shadow
 * Thumb: 3-stop metallic chrome gradient circle
 * Active fill: Primary ice cyan by default
 *
 * Usage:
 *   <HardwareSlider value={0.5} onValueChange={setValue} />
 *   <HardwareSlider value={mix} minimumTrackTintColor={palette.amber} />
 */

import React, { useRef } from 'react';
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  ViewStyle,
  StyleProp,
  LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../../tokens/materials';
import { elevation } from '../../tokens/elevation';

interface HardwareSliderProps {
  /** Value from 0 to 1 */
  value: number;
  /** Called when user drags slider */
  onValueChange: (value: number) => void;
  /** Track fill color. Default: ice */
  minimumTrackTintColor?: string;
  /** Override thumb style */
  thumbStyle?: StyleProp<ViewStyle>;
  /** Override container style */
  style?: StyleProp<ViewStyle>;
}

const THUMB_SIZE = 18;
const TRACK_HEIGHT = 4;

// Chrome thumb gradient (3-stop)
const thumbGradient = [
  palette.gunmetal,
  palette.slate,
  palette.gunmetal,
] as unknown as [string, string, ...string[]];
const thumbLocations = [0, 0.5, 1] as unknown as [number, number, ...number[]];

export function HardwareSlider({
  value,
  onValueChange,
  minimumTrackTintColor = palette.ice,
  thumbStyle,
  style,
}: HardwareSliderProps) {
  const trackWidth = useRef(0);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const newValue = Math.max(
          0,
          Math.min(1, gestureState.moveX / trackWidth.current),
        );
        onValueChange(newValue);
      },
    }),
  ).current;

  const thumbPosition = value * (trackWidth.current - THUMB_SIZE);

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={[styles.container, style]}>
      {/* Track container */}
      <View
        style={styles.trackContainer}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Recessed track background with inset shadow */}
        <View style={[styles.track, { backgroundColor: palette.gunmetal }]}>
          {/* Inset shadow effect */}
          <View style={styles.trackInsetShadow} />
        </View>

        {/* Active fill (grows as value increases) */}
        <View
          style={[
            styles.activeFill,
            {
              width: `${value * 100}%`,
              backgroundColor: minimumTrackTintColor,
            },
          ]}
        />

        {/* Chrome thumb */}
        <View
          style={[
            styles.thumbWrapper,
            {
              transform: [{ translateX: thumbPosition }],
            },
            thumbStyle,
          ]}
        >
          <LinearGradient
            colors={thumbGradient}
            locations={thumbLocations}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.thumb}
          />

          {/* Thumb highlight */}
          <View style={styles.thumbHighlight} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  trackContainer: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: TRACK_HEIGHT,
    borderRadius: 1,
    overflow: 'hidden',
  },
  trackInsetShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    height: 2,
  },
  activeFill: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    top: '50%',
    height: TRACK_HEIGHT,
    marginTop: -TRACK_HEIGHT / 2,
    borderRadius: 1,
    opacity: 0.8,
  },
  thumbWrapper: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.raised.shadows[0],
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  thumbHighlight: {
    position: 'absolute',
    top: 1,
    left: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.20)',
  },
});
