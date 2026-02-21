/**
 * SafeScreen — universal screen wrapper
 *
 * Handles safe area insets, background color, and optional
 * edge-to-edge mode (for screens with custom headers).
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

interface SafeScreenProps {
  children: React.ReactNode;
  /** Use edge-to-edge mode (no top padding — for screens with custom headers) */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  /** Override background color */
  backgroundColor?: string;
  /** Additional styles on the outer container */
  style?: ViewStyle;
}

export function SafeScreen({
  children,
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = colors.bg.primary,
  style,
}: SafeScreenProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeScreen;
