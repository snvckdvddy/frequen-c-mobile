import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tacticalTokens } from '../theme/tacticalTokens';

type ReactionType = 'fire' | 'vibe' | 'skip';

interface TacticalReactionMatrixProps {
  counts?: Partial<Record<ReactionType, number>>;
  disabled?: boolean;
  onReact: (type: ReactionType) => void;
}

const CELLS: Array<{
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  reaction?: ReactionType;
}> = [
  { id: 'fire', label: 'FIRE', icon: 'flame-outline', reaction: 'fire' },
  { id: 'vibe', label: 'VIBE', icon: 'pulse-outline', reaction: 'vibe' },
  { id: 'skip', label: 'SKIP', icon: 'play-skip-forward-outline', reaction: 'skip' },
  { id: 'hold', label: 'HOLD', icon: 'radio-outline' },
  { id: 'echo', label: 'ECHO', icon: 'flash-outline' },
];

export function TacticalReactionMatrix({
  counts,
  disabled = false,
  onReact,
}: TacticalReactionMatrixProps) {
  return (
    <View style={styles.container}>
      {CELLS.map((cell) => {
        const isActive = !!cell.reaction && !disabled;
        const count = cell.reaction ? counts?.[cell.reaction] ?? 0 : 0;

        return (
          <Pressable
            key={cell.id}
            onPress={cell.reaction ? () => onReact(cell.reaction as ReactionType) : undefined}
            disabled={!isActive}
            style={({ pressed }) => [
              styles.cell,
              !isActive && styles.cellDisabled,
              pressed && isActive && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isActive ? `${cell.label} reaction` : `${cell.label} telemetry`}
            accessibilityState={{ disabled: !isActive }}
          >
            <Ionicons
              name={cell.icon}
              size={18}
              color={isActive ? tacticalTokens.colors.white : tacticalTokens.colors.textDim}
            />
            <Text style={[styles.count, !isActive && styles.countDisabled]}>
              {String(count).padStart(2, '0')}
            </Text>
            <Text style={[styles.label, !isActive && styles.labelDisabled]}>{cell.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
    marginHorizontal: tacticalTokens.spacing.xl,
    flexDirection: 'row',
    gap: tacticalTokens.spacing.xs,
  },
  cell: {
    flex: 1,
    minHeight: 58,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellDisabled: {
    borderColor: '#2A2A2A',
    backgroundColor: '#141414',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  count: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.acid,
  },
  countDisabled: {
    color: '#4F4F4F',
  },
  label: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.1,
  },
  labelDisabled: {
    color: '#6A6A6A',
  },
});

export default TacticalReactionMatrix;
