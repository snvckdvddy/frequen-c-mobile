/**
 * RackRails — Vertical rail strips along screen edges.
 * ─────────────────────────────────────────────────────────────
 * The defining visual element of the rack metaphor.
 * Thin vertical strips with tick marks at regular intervals,
 * simulating the mounting rails of a modular synth rack.
 *
 * Render behind all other content using absolute positioning.
 * Tick marks align with mountingInterval from elevation tokens.
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle, StyleProp } from 'react-native';
import Svg, { Line, Circle, Rect } from 'react-native-svg';
import { rackHardware } from '../../tokens/elevation';

interface RackRailsProps {
  /** Height of the rail area. Defaults to screen height. */
  height?: number;
  /** Show mounting screw holes. Default: true */
  screws?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const RAIL_WIDTH = 6; // Visual width of each rail strip

export function RackRails({
  height = SCREEN_HEIGHT,
  screws = true,
  style,
}: RackRailsProps) {
  const tickCount = Math.floor(height / rackHardware.mountingInterval);

  const ticks = useMemo(() => {
    const items = [];
    for (let i = 0; i <= tickCount; i++) {
      items.push(i * rackHardware.mountingInterval);
    }
    return items;
  }, [tickCount]);

  return (
    <View style={[styles.container, { height }, style]} pointerEvents="none">
      {/* Left rail */}
      <View style={styles.leftRail}>
        <Svg width={RAIL_WIDTH} height={height}>
          {/* Rail background */}
          <Rect
            x={0}
            y={0}
            width={RAIL_WIDTH}
            height={height}
            fill="rgba(255, 255, 255, 0.02)"
          />
          {/* Edge highlight */}
          <Line
            x1={RAIL_WIDTH}
            y1={0}
            x2={RAIL_WIDTH}
            y2={height}
            stroke={rackHardware.railColor}
            strokeWidth={rackHardware.railWidth}
          />
          {/* Tick marks and screw holes */}
          {ticks.map((y) => (
            <React.Fragment key={`l-${y}`}>
              {/* Tick mark */}
              <Line
                x1={RAIL_WIDTH - 2}
                y1={y}
                x2={RAIL_WIDTH}
                y2={y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth={1}
              />
              {/* Screw hole */}
              {screws && (
                <Circle
                  cx={RAIL_WIDTH / 2}
                  cy={y + rackHardware.mountingInterval / 2}
                  r={rackHardware.screwSize / 2}
                  fill="rgba(0, 0, 0, 0.3)"
                  stroke={rackHardware.screwColor}
                  strokeWidth={0.5}
                />
              )}
            </React.Fragment>
          ))}
        </Svg>
      </View>

      {/* Right rail */}
      <View style={styles.rightRail}>
        <Svg width={RAIL_WIDTH} height={height}>
          <Rect
            x={0}
            y={0}
            width={RAIL_WIDTH}
            height={height}
            fill="rgba(255, 255, 255, 0.02)"
          />
          <Line
            x1={0}
            y1={0}
            x2={0}
            y2={height}
            stroke={rackHardware.railColor}
            strokeWidth={rackHardware.railWidth}
          />
          {ticks.map((y) => (
            <React.Fragment key={`r-${y}`}>
              <Line
                x1={0}
                y1={y}
                x2={2}
                y2={y}
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth={1}
              />
              {screws && (
                <Circle
                  cx={RAIL_WIDTH / 2}
                  cy={y + rackHardware.mountingInterval / 2}
                  r={rackHardware.screwSize / 2}
                  fill="rgba(0, 0, 0, 0.3)"
                  stroke={rackHardware.screwColor}
                  strokeWidth={0.5}
                />
              )}
            </React.Fragment>
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftRail: {
    width: RAIL_WIDTH,
  },
  rightRail: {
    width: RAIL_WIDTH,
  },
});
