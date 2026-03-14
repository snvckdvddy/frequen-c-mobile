import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalGridBackgroundProps {
  cellSize?: number;
  lineColor?: string;
  opacity?: number;
}

export function TacticalGridBackground({
  cellSize = tacticalTokens.grid.cell,
  lineColor = tacticalTokens.colors.gridLine,
  opacity = 1,
}: TacticalGridBackgroundProps) {
  const patternId = `tactical-grid-${cellSize}-${lineColor.replace('#', '')}`;

  return (
    <Svg pointerEvents="none" style={styles.fill}>
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={cellSize}
          height={cellSize}
        >
          <Line x1="0" y1="0" x2={cellSize} y2="0" stroke={lineColor} strokeWidth="1" opacity={opacity} />
          <Line x1="0" y1="0" x2="0" y2={cellSize} stroke={lineColor} strokeWidth="1" opacity={opacity} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default TacticalGridBackground;
