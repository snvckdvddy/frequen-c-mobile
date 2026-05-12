import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../theme/theme';

interface SignalChainAddBlockProps {
  onPress: () => void;
}

export function SignalChainAddBlock({ onPress }: SignalChainAddBlockProps) {
  // Label is intentionally action-clear ("PATCH A TRACK") rather than
  // describing the destination state ("ADD TO SIGNAL CHAIN"). Tapping
  // this button opens the SEARCH HUD — the user isn't adding to a list,
  // they're starting a search. "PATCH A TRACK" matches the brand verb
  // (PATCH is used everywhere else for queue add) and the SEARCH HUD's
  // own header copy ("PATCH TRACK / SEARCHING GLOBAL DATABASES").
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Patch a track into the queue"
    >
      {({ pressed }) => (
        <View style={styles.labelRow}>
          <Text style={[styles.plus, pressed && styles.textPressed]}>+</Text>
          <Text style={[styles.label, pressed && styles.textPressed]}>PATCH A TRACK</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.sm,
    minHeight: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderGhost,
    borderRadius: 0,
    backgroundColor: theme.colors.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  plus: {
    fontFamily: theme.fonts.display,
    fontSize: 14,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  label: {
    fontFamily: theme.fonts.display,
    fontSize: 14,
    color: theme.colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  pressed: {
    backgroundColor: theme.colors.textPure,
    borderStyle: 'solid',
    opacity: 0.96,
  },
  textPressed: {
    color: theme.colors.void,
  },
});

export default SignalChainAddBlock;
