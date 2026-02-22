/**
 * PatchPoint — Connection node for the signal chain metaphor.
 * ─────────────────────────────────────────────────────────────
 * 3 states:
 *   inactive — dim ring, empty center
 *   active — lit ring, filled center
 *   flowing — pulsing glow, indicates active signal
 *
 * Used on queue items, user avatars, track connections.
 * Signal lines connect between PatchPoints to show relationships.
 *
 * Usage:
 *   <PatchPoint state="inactive" />
 *   <PatchPoint state="active" variant="ice" />
 *   <PatchPoint state="flowing" variant="amber" size={12} />
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { palette, glow } from '../../tokens/materials';

type PatchState = 'inactive' | 'active' | 'flowing';
type PatchVariant = 'ice' | 'amber';

interface PatchPointProps {
  state?: PatchState;
  variant?: PatchVariant;
  /** Diameter in px. Default: 8 */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function PatchPoint({
  state = 'inactive',
  variant = 'ice',
  size = 8,
  style,
}: PatchPointProps) {
  const config = glow[variant];
  const color = variant === 'ice' ? palette.ice : palette.amber;
  const r = size / 2;

  if (state === 'inactive') {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size}>
          <Circle
            cx={r}
            cy={r}
            r={r - 1}
            fill="transparent"
            stroke={palette.textDim}
            strokeWidth={1}
          />
          {/* Center dot — empty */}
          <Circle
            cx={r}
            cy={r}
            r={1}
            fill={palette.textDim}
          />
        </Svg>
      </View>
    );
  }

  // Active and flowing states
  const isFlowing = state === 'flowing';

  return (
    <View
      style={[
        { width: size, height: size },
        // Glow effect for active/flowing
        {
          shadowColor: config.core,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isFlowing ? 0.8 : 0.4,
          shadowRadius: isFlowing ? 8 : 4,
        },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`patchGlow-${variant}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.6" stopColor={color} stopOpacity={0.6} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Outer glow circle */}
        <Circle
          cx={r}
          cy={r}
          r={r}
          fill={`url(#patchGlow-${variant})`}
        />
        {/* Bright center */}
        <Circle
          cx={r}
          cy={r}
          r={r * 0.4}
          fill={color}
        />
      </Svg>
    </View>
  );
}
