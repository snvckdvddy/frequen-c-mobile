import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoomMode } from '../../../types';
import { formatModeLabel } from '../theme/tacticalTokens';
import { theme } from '../../../theme/theme';

interface SignalChainModeSwitchProps {
  mode: RoomMode;
  isHost: boolean;
  onSelectMode: (mode: RoomMode) => void;
}

const MODES: RoomMode[] = ['campfire', 'spotlight', 'openFloor'];

export function SignalChainModeSwitch({
  mode,
  isHost,
  onSelectMode,
}: SignalChainModeSwitchProps) {
  return (
    <View style={styles.container}>
      {MODES.map((segment) => {
        const isSelected = segment === mode;

        return (
          <Pressable
            key={segment}
            onPress={isHost ? () => onSelectMode(segment) : undefined}
            disabled={!isHost}
            style={({ pressed }) => [
              styles.segment,
              isSelected && styles.segmentSelected,
              pressed && isHost && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Set room mode to ${formatModeLabel(segment)}`}
            accessibilityState={{ selected: isSelected, disabled: !isHost }}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {formatModeLabel(segment)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: theme.spacing.xl,
    flexDirection: 'row',
    backgroundColor: theme.colors.borderLight,
    padding: 1,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    backgroundColor: theme.colors.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: theme.colors.textPure,
  },
  label: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
  },
  labelSelected: {
    color: theme.colors.void,
  },
  pressed: {
    opacity: 0.84,
  },
});

export default SignalChainModeSwitch;
