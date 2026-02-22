/**
 * VUMeter — Segmented level meter.
 * ─────────────────────────────────────────────────────────────
 * 20-segment bar with color thresholds:
 *   0-60%: ice cyan (normal)
 *   60-80%: gold (caution)
 *   80-100%: red (clip)
 *
 * Unlit segments are dimly visible (like real hardware).
 * Can be horizontal or vertical.
 *
 * Usage:
 *   <VUMeter level={0.65} />
 *   <VUMeter level={0.85} direction="vertical" height={120} />
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { vuColors, palette } from '../../tokens/materials';

interface VUMeterProps {
  /** Level from 0.0 to 1.0 */
  level: number;
  /** Orientation. Default: 'horizontal' */
  direction?: 'horizontal' | 'vertical';
  /** Total width (horizontal) or height (vertical). Default: 160 */
  size?: number;
  /** Segment height (horizontal) or width (vertical). Default: 8 */
  thickness?: number;
  style?: StyleProp<ViewStyle>;
}

function getSegmentColor(index: number, total: number): string {
  const position = index / total;
  for (const threshold of vuColors.thresholds) {
    if (position <= threshold.upTo) {
      return threshold.color;
    }
  }
  return vuColors.thresholds[vuColors.thresholds.length - 1].color;
}

export function VUMeter({
  level,
  direction = 'horizontal',
  size = 160,
  thickness = 8,
  style,
}: VUMeterProps) {
  const clampedLevel = Math.max(0, Math.min(1, level));
  const litCount = Math.round(clampedLevel * vuColors.segments);

  const segments = useMemo(() => {
    const items = [];
    const segmentSize =
      (size - vuColors.segmentGap * (vuColors.segments - 1)) / vuColors.segments;

    for (let i = 0; i < vuColors.segments; i++) {
      const isLit = i < litCount;
      const color = isLit ? getSegmentColor(i, vuColors.segments) : vuColors.dimColor;

      items.push(
        <View
          key={i}
          style={[
            direction === 'horizontal'
              ? { width: segmentSize, height: thickness }
              : { width: thickness, height: segmentSize },
            {
              backgroundColor: color,
              borderRadius: 1,
              // Glow effect on lit segments near clip
              ...(isLit && i >= vuColors.segments * 0.8
                ? {
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.6,
                    shadowRadius: 3,
                  }
                : {}),
            },
          ]}
        />
      );
    }
    return items;
  }, [litCount, direction, size, thickness]);

  return (
    <View
      style={[
        styles.container,
        direction === 'horizontal' ? styles.horizontal : styles.vertical,
        direction === 'horizontal'
          ? { width: size, height: thickness }
          : { width: thickness, height: size },
        { gap: vuColors.segmentGap },
        style,
      ]}
    >
      {segments}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  horizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vertical: {
    flexDirection: 'column-reverse', // Bottom-to-top fill
    alignItems: 'center',
  },
});
