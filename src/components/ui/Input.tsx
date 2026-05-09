/**
 * Themed TextInput
 * Tactical Brutalism — sharp solid boxes, glowing borders.
 *
 * When `secureTextEntry` is set, an eye toggle button is automatically
 * rendered on the right edge of the field. Tapping it flips between
 * obscured and revealed text. This is opt-in via the existing prop —
 * callers don't need to do anything new beyond what they already pass.
 *
 * For password autofill on real devices, callers should ALSO pass:
 *   - login fields:    autoComplete="current-password" textContentType="password"
 *   - register fields: autoComplete="new-password"     textContentType="newPassword"
 * The primitive doesn't set these because the right value depends on
 * whether the field is for an existing or new credential.
 */

import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  secureTextEntry,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);

  // Reveal state is tracked separately from the `secureTextEntry` prop so
  // the prop can stay declarative ("this field is a password") while the
  // user gets imperative control over visibility. Default: obscured.
  const [revealed, setRevealed] = useState(false);
  const isSecure = !!secureTextEntry;
  const effectiveSecure = isSecure && !revealed;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text variant="label" color={palette.silver} style={styles.label}>
          {label}
        </Text>
      )}
      <View>
        <TextInput
          accessibilityLabel={label || props.placeholder}
          accessibilityHint={error ? `Error: ${error}` : undefined}
          accessibilityState={{ disabled: props.editable === false }}
          style={[
            styles.input,
            // Reserve space on the right so the text doesn't run under
            // the eye toggle. Only applied when the toggle is rendered.
            isSecure && styles.inputWithSuffix,
            focused && styles.inputFocused,
            error && styles.inputError,
            style,
          ]}
          placeholderTextColor={palette.slate}
          secureTextEntry={effectiveSecure}
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
        {isSecure && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            // hitSlop pushes the touch target out to ~44pt without
            // visually enlarging the icon — meets WCAG 2.5.5 target size.
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityState={{ expanded: revealed }}
            style={({ pressed }) => [
              styles.suffixButton,
              pressed && styles.suffixButtonPressed,
            ]}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={palette.silver}
            />
          </Pressable>
        )}
      </View>
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
  inputWithSuffix: {
    // Reserve room on the right for the eye toggle (44pt touch + 4pt slack).
    paddingRight: 48,
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
  suffixButton: {
    // Absolute over the right edge of the TextInput. The TextInput's
    // own height is 48 (see `input` above), so matching here keeps the
    // tap target vertically centered against the field.
    position: 'absolute',
    right: 0,
    top: 0,
    height: 48,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suffixButtonPressed: {
    // Subtle pressed feedback — no color shift to avoid token churn.
    opacity: 0.6,
  },
});

export default Input;
