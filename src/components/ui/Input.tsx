/**
 * Themed TextInput
 * Dark-mode native, with focus state glow.
 */

import React, { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text variant="label" color={colors.text.secondary} style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.text.muted}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text variant="bodySmall" color={colors.action.destructive} style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  input: {
    height: 52,
    backgroundColor: colors.bg.input,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.inputPadding,
    color: colors.text.primary,
    fontSize: typography.size.base,
    fontFamily: typography.fontFamily,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  inputFocused: {
    borderColor: colors.action.primary,
    backgroundColor: colors.bg.elevated,
  },
  inputError: {
    borderColor: colors.action.destructive,
  },
  error: {
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
});

export default Input;
