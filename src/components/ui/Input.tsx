/**
 * Themed TextInput
 * Tactical Brutalism — sharp solid boxes, glowing borders.
 */

import React, { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';
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
        <Text variant="label" color={palette.silver} style={styles.label}>
          {label}
        </Text>
      )}
      <TextInput
        accessibilityLabel={label || props.placeholder}
        accessibilityHint={error ? `Error: ${error}` : undefined}
        accessibilityState={{ disabled: props.editable === false }}
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={palette.slate}
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
        <Text variant="bodySmall" style={styles.error}>
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
    height: 48,
    backgroundColor: '#111111',
    borderRadius: 0,
    paddingHorizontal: spacing.inputPadding,
    color: '#ffffff',
    fontSize: typography.size.base,
    fontFamily: typography.fontFamily,
    borderWidth: 1,
    borderColor: '#333333',
  },
  inputFocused: {
    borderColor: '#39FF14',
    backgroundColor: '#0A0A0A',
  },
  inputError: {
    borderColor: '#FF4500',
  },
  error: {
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    color: '#FF4500',
  },
});

export default Input;
