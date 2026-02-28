/**
 * WaveformIcon — Signal-type SVG icons for room modes.
 *
 * Replaces emoji badges with technical waveform shapes:
 *   Campfire  → Sine wave    (warm, rounded)
 *   Spotlight → Square wave  (sharp, defined)
 *   Open Floor → Sawtooth wave (rich, full spectrum)
 */

import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { palette } from '../../design/tokens/materials';
import type { RoomMode } from '../../types';

interface WaveformIconProps {
  mode: RoomMode;
  size?: number;
  color?: string;
}

const waveformPaths: Record<RoomMode, string> = {
  // Sine wave — smooth curves
  campfire:
    'M 0 12 Q 4 0, 8 12 Q 12 24, 16 12 Q 20 0, 24 12',
  // Square wave — sharp right angles
  spotlight:
    'M 0 18 L 0 6 L 8 6 L 8 18 L 16 18 L 16 6 L 24 6 L 24 18',
  // Sawtooth wave — ascending ramps with sharp drops
  openFloor:
    'M 0 18 L 8 6 L 8 18 L 16 6 L 16 18 L 24 6',
};

const modeColors: Record<RoomMode, string> = {
  campfire: palette.signalSine,
  spotlight: palette.signalSquare,
  openFloor: palette.signalSaw,
};

export function WaveformIcon({ mode, size = 20, color }: WaveformIconProps) {
  const pathColor = color || modeColors[mode];
  const viewBoxHeight = 24;
  const viewBoxWidth = 24;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
    >
      <Path
        d={waveformPaths[mode]}
        stroke={pathColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

export default WaveformIcon;
