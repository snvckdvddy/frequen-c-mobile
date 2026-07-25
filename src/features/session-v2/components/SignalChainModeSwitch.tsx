import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RoomMode } from '../../../types';
import { formatModeLabel } from '../theme/tacticalTokens';
import { theme } from '../../../theme/theme';
import { isRoomModeLocked } from '../../../services/config';

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
  // Non-hosts cannot change the room mode, and previously the disabled
  // buttons created visual noise that read as "queue sub-tabs you can't
  // use." Hide the switch entirely for non-hosts so the queue sheet stays
  // about the queue. Hosts still see + interact with it, but with a
  // clear "ROOM MODE" label so it's not mistaken for queue filtering.
  // Long-term: this control belongs in System Preferences, not the queue
  // sheet. See known_debt.md "Queue sheet hosts room-mode control".
  if (!isHost) return null;

  return (
    <View style={styles.outer}>
      <Text style={styles.sectionLabel}>ROOM MODE</Text>
      <View style={styles.container}>
        {MODES.map((segment) => {
          const isSelected = segment === mode;
          // Locked modes stay visible so hosts can see what's coming,
          // but cannot fire onSelectMode until the beta lock lifts.
          const isLocked = isRoomModeLocked(segment);

          return (
            <Pressable
              key={segment}
              disabled={isLocked}
              onPress={() => onSelectMode(segment)}
              style={({ pressed }) => [
                styles.segment,
                isSelected && styles.segmentSelected,
                isLocked && styles.segmentLocked,
                pressed && !isLocked && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isLocked
                  ? `${formatModeLabel(segment)} coming in V2`
                  : `Set room mode to ${formatModeLabel(segment)}`
              }
              accessibilityState={{ selected: isSelected, disabled: isLocked }}
            >
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {formatModeLabel(segment)}
              </Text>
              {isLocked ? <Text style={styles.lockTag}>V2</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xs,
  },
  sectionLabel: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: theme.colors.textMuted,
    paddingTop: theme.spacing.sm,
    paddingBottom: 4,
  },
  container: {
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
  segmentLocked: {
    opacity: 0.42,
  },
  lockTag: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
});

export default SignalChainModeSwitch;
