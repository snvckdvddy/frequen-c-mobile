/**
 * NowPlayingXYPad — Gesture-controlled XY Pad overlay for now-playing.
 *
 * Maps finger position to two axes:
 *   X axis → Seek position (scrub through track)
 *   Y axis → Reaction intensity (visual feedback only for now)
 *
 * Visual: Translucent overlay with crosshair cursor and coordinate
 * readout. Think Korg Kaoss Pad — touch to interact with the signal.
 *
 * Future: X could control filter cutoff, Y could control resonance
 * when audio processing is added.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, PanResponder, Animated, Dimensions, LayoutChangeEvent,
} from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { Text } from './ui/Text';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import { tapLight } from '../utils/haptics';

interface XYPadProps {
  /** Current playback position 0-1 */
  currentPosition: number;
  /** Track duration in seconds */
  duration: number;
  /** Called when user seeks via X axis */
  onSeek?: (position: number) => void;
  /** Called with normalized Y value 0-1 */
  onYChange?: (value: number) => void;
  /** Whether pad is active/visible */
  active?: boolean;
}

interface XYCoord {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function NowPlayingXYPad({
  currentPosition,
  duration,
  onSeek,
  onYChange,
  active = true,
}: XYPadProps) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [touching, setTouching] = useState(false);
  const [coord, setCoord] = useState<XYCoord>({ x: 0, y: 0.5 });
  const cursorOpacity = useRef(new Animated.Value(0)).current;

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setDimensions({
      width: e.nativeEvent.layout.width,
      height: e.nativeEvent.layout.height,
    });
  }, []);

  const normalize = useCallback(
    (pageX: number, pageY: number, layoutX: number, layoutY: number): XYCoord => {
      const x = Math.max(0, Math.min(1, (pageX - layoutX) / dimensions.width));
      const y = Math.max(0, Math.min(1, (pageY - layoutY) / dimensions.height));
      return { x, y };
    },
    [dimensions]
  );

  // Store layout position for coordinate normalization
  const layoutRef = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => active,
      onMoveShouldSetPanResponder: () => active,

      onPanResponderGrant: (evt) => {
        setTouching(true);
        tapLight();
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }).start();

        const { pageX, pageY, locationX, locationY } = evt.nativeEvent;
        const lx = pageX - locationX;
        const ly = pageY - locationY;
        layoutRef.current = { x: lx, y: ly };

        if (dimensions.width > 0) {
          const c = {
            x: Math.max(0, Math.min(1, locationX / dimensions.width)),
            y: Math.max(0, Math.min(1, locationY / dimensions.height)),
          };
          setCoord(c);
        }
      },

      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        if (dimensions.width > 0) {
          const c = normalize(pageX, pageY, layoutRef.current.x, layoutRef.current.y);
          setCoord(c);
          onYChange?.(1 - c.y); // Invert Y so top = 1
        }
      },

      onPanResponderRelease: () => {
        setTouching(false);
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();

        // Commit seek on release
        if (onSeek && dimensions.width > 0) {
          onSeek(coord.x);
        }
      },
    })
  ).current;

  const cursorX = coord.x * dimensions.width;
  const cursorY = coord.y * dimensions.height;
  const seekTime = coord.x * duration;

  if (!active) return null;

  return (
    <View
      style={styles.container}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {/* Grid lines — subtle reference grid */}
      <Svg
        width={dimensions.width || 1}
        height={dimensions.height || 1}
        style={StyleSheet.absoluteFill}
      >
        {/* Vertical grid (4 divisions) */}
        {[0.25, 0.5, 0.75].map((pos) => (
          <Line
            key={`v-${pos}`}
            x1={pos * (dimensions.width || 1)}
            y1={0}
            x2={pos * (dimensions.width || 1)}
            y2={dimensions.height || 1}
            stroke={palette.chromeBorder}
            strokeWidth={0.5}
          />
        ))}
        {/* Horizontal grid (4 divisions) */}
        {[0.25, 0.5, 0.75].map((pos) => (
          <Line
            key={`h-${pos}`}
            x1={0}
            y1={pos * (dimensions.height || 1)}
            x2={dimensions.width || 1}
            y2={pos * (dimensions.height || 1)}
            stroke={palette.chromeBorder}
            strokeWidth={0.5}
          />
        ))}

        {/* Cursor crosshair */}
        {touching && (
          <>
            <Line
              x1={cursorX}
              y1={0}
              x2={cursorX}
              y2={dimensions.height}
              stroke={palette.orange}
              strokeWidth={0.8}
              opacity={0.5}
            />
            <Line
              x1={0}
              y1={cursorY}
              x2={dimensions.width}
              y2={cursorY}
              stroke={palette.orange}
              strokeWidth={0.8}
              opacity={0.5}
            />
            <Circle
              cx={cursorX}
              cy={cursorY}
              r={6}
              fill={palette.orange}
              opacity={0.8}
            />
            <Circle
              cx={cursorX}
              cy={cursorY}
              r={16}
              stroke={palette.orange}
              strokeWidth={1}
              fill="none"
              opacity={0.3}
            />
          </>
        )}
      </Svg>

      {/* Coordinate readout */}
      <Animated.View style={[styles.readout, { opacity: cursorOpacity }]}>
        <Text variant="labelSmall" color={palette.frost} style={styles.readoutText}>
          {formatTime(seekTime)} / {formatTime(duration)}
        </Text>
      </Animated.View>

      {/* Axis labels */}
      <View style={styles.xLabel}>
        <Text variant="labelSmall" color={palette.slate} style={styles.axisText}>
          SEEK
        </Text>
      </View>
      <View style={styles.yLabel}>
        <Text variant="labelSmall" color={palette.slate} style={styles.axisText}>
          INTENSITY
        </Text>
      </View>

      {/* Current position indicator (when not touching) */}
      {!touching && dimensions.width > 0 && (
        <View
          style={[
            styles.positionMarker,
            { left: currentPosition * dimensions.width - 1 },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 120,
    backgroundColor: palette.steel,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  readout: {
    position: 'absolute',
    top: 6,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(6, 8, 15, 0.7)',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  readoutText: {
    fontSize: 9,
    letterSpacing: 1,
  },
  xLabel: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  yLabel: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  axisText: {
    fontSize: 7,
    letterSpacing: 1.5,
    opacity: 0.4,
  },
  positionMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: palette.orange,
    opacity: 0.4,
  },
});

export default NowPlayingXYPad;
