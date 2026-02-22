/**
 * ModuleFaceplate — A hardware module that mounts into the rack.
 * ─────────────────────────────────────────────────────────────
 * The primary container component. Everything in Frequen-C
 * is a "module" mounted in the rack. This replaces generic Card/View.
 *
 * Features:
 *   - Brushed steel surface (default) or chrome
 *   - Optional mounting screws at top corners
 *   - Hardware-specific border radius (flat top, slight bottom curve)
 *   - Top-edge specular highlight
 *   - Engraved module label
 *
 * Usage:
 *   <ModuleFaceplate label="NOW PLAYING" screws>
 *     <TrackInfo />
 *   </ModuleFaceplate>
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { BrushedSteelSurface } from '../materials/BrushedSteelSurface';
import { ChromeSurface } from '../materials/ChromeSurface';
import { rackHardware } from '../../tokens/elevation';
import { primaryShadow } from '../../tokens/elevation';
import { fontFamily, fontSize, letterSpacing } from '../../tokens/typography';
import { palette } from '../../tokens/materials';

type FaceplateMaterial = 'steel' | 'chrome';

interface ModuleFaceplateProps {
  children: React.ReactNode;
  /** Engraved label text (uppercase). Omit for unlabeled module. */
  label?: string;
  /** Surface material. Default: 'steel' */
  material?: FaceplateMaterial;
  /** Show mounting screws. Default: false */
  screws?: boolean;
  style?: StyleProp<ViewStyle>;
}

function MountingScrew() {
  const size = rackHardware.screwSize * 2.5; // Visual size larger than token
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="screwGrad" cx="40%" cy="40%" r="50%">
          <Stop offset="0" stopColor={rackHardware.screwHighlight} />
          <Stop offset="0.5" stopColor={rackHardware.screwColor} />
          <Stop offset="1" stopColor="rgba(0, 0, 0, 0.3)" />
        </RadialGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={size / 2 - 0.5}
        fill="url(#screwGrad)"
        stroke="rgba(0, 0, 0, 0.4)"
        strokeWidth={0.5}
      />
      {/* Phillips cross slot */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={1}
        fill="rgba(0, 0, 0, 0.5)"
      />
    </Svg>
  );
}

export function ModuleFaceplate({
  children,
  label,
  material = 'steel',
  screws = false,
  style,
}: ModuleFaceplateProps) {
  const { faceplateRadius } = rackHardware;
  const borderRadius = {
    borderTopLeftRadius: faceplateRadius.topLeft,
    borderTopRightRadius: faceplateRadius.topRight,
    borderBottomLeftRadius: faceplateRadius.bottomLeft,
    borderBottomRightRadius: faceplateRadius.bottomRight,
  };

  const Surface = material === 'chrome' ? ChromeSurface : BrushedSteelSurface;

  return (
    <Surface style={[styles.faceplate, borderRadius, primaryShadow('flush'), style]}>
      {/* Mounting screws */}
      {screws && (
        <View style={styles.screwRow}>
          <MountingScrew />
          <MountingScrew />
        </View>
      )}

      {/* Engraved label */}
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
        </View>
      )}

      {/* Module content */}
      <View style={styles.content}>{children}</View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  faceplate: {
    overflow: 'hidden',
  },
  screwRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 6,
  },
  labelContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  label: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.xs,
    letterSpacing: letterSpacing.widest,
    textTransform: 'uppercase',
    color: palette.textDim,
    fontWeight: '700',
    // Engraved effect: we can't do inset text-shadow in RN,
    // but the dim color on steel surface creates a recessed look.
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
