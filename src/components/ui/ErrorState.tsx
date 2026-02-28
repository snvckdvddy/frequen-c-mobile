/**
 * ErrorState — Network/API failure display with retry.
 *
 * Two variants:
 *   - full (default): Centered card with icon + message + retry. For screen-level errors.
 *   - banner: Slim top banner with message + retry. For inline/partial errors.
 *
 * Usage:
 *   <ErrorState message="Couldn't load rooms" onRetry={refetch} />
 *   <ErrorState variant="banner" message="Connection lost" onRetry={reconnect} />
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';

interface ErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Retry callback — if omitted, no retry button shown */
  onRetry?: () => void;
  /** Display variant */
  variant?: 'full' | 'banner';
}

export function ErrorState({
  message = 'Something went wrong',
  onRetry,
  variant = 'full',
}: ErrorStateProps) {
  if (variant === 'banner') {
    return (
      <View style={bannerStyles.container}>
        <Ionicons name="alert-circle" size={16} color={palette.red} />
        <Text variant="labelSmall" color={palette.silver} style={bannerStyles.msg} numberOfLines={1}>
          {message}
        </Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text variant="labelSmall" color={palette.orange} style={bannerStyles.retry}>
              RETRY
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Full variant
  return (
    <View style={fullStyles.container}>
      <View style={fullStyles.iconWrap}>
        <Ionicons name="warning-outline" size={40} color={palette.red} />
      </View>
      <Text variant="body" color={palette.frost} align="center" style={fullStyles.title}>
        {message}
      </Text>
      <Text variant="labelSmall" color={palette.slate} align="center" style={fullStyles.subtitle}>
        Check your connection and try again
      </Text>
      {onRetry && (
        <TouchableOpacity style={fullStyles.retryBtn} onPress={onRetry} activeOpacity={0.7}>
          <Ionicons name="refresh" size={16} color={palette.orange} />
          <Text variant="label" color={palette.orange} style={fullStyles.retryText}>
            Retry
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const fullStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenPadding * 2,
    paddingVertical: spacing['2xl'],
    minHeight: 200,
  },
  iconWrap: {
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  title: {
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: spacing.lg,
    textTransform: 'none',
    letterSpacing: 0,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: palette.orange,
  },
  retryText: {
    fontSize: 12,
    letterSpacing: 1,
  },
});

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.midnight,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  msg: {
    flex: 1,
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0,
  },
  retry: {
    fontSize: 10,
    letterSpacing: 1.2,
  },
});

export default ErrorState;
