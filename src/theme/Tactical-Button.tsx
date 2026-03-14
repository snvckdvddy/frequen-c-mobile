// src/components/TacticalButton.tsx
import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme/theme';

interface Props {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
}

export const TacticalButton = ({ title, onPress, style }: Props) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        style
      ]}
    >
      {({ pressed }) => (
        <Text style={[styles.text, pressed && styles.textPressed]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.colors.matteGrey,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: theme.colors.textPure,
    borderColor: theme.colors.textPure,
  },
  text: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.textDim,
    textTransform: 'uppercase',
  },
  textPressed: {
    color: theme.colors.void,
  }
});