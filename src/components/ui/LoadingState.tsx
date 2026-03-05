/**
 * LoadingState — Screen-level loading indicator.
 *
 * Two variants:
 *   - skeleton (default): Shows skeleton placeholders. Pass children for custom skeletons.
 *   - spinner: Centered activity indicator with optional message.
 *
 * Usage:
 *   <LoadingState />
 *   <LoadingState variant="spinner" message="Loading your rooms..." />
 *   <LoadingState>
 *     <SessionCardSkeleton />
 *     <SessionCardSkeleton />
 *   </LoadingState>
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from './Text';
import { Skeleton } from './Skeleton';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';

interface LoadingStateProps {
  /** Display variant */
  variant?: 'skeleton' | 'spinner';
  /** Optional message below spinner */
  message?: string;
  /** Custom skeleton content — if omitted, renders 3 generic skeleton bars */
  children?: React.ReactNode;
}

export function LoadingState({
  variant = 'skeleton',
  message,
  children,
}: LoadingStateProps) {
  if (variant === 'spinner') {
    return (
      <View style={styles.spinnerContainer}>
        <ActivityIndicator size="large" color={palette.orange} />
        {message && (
          <Text variant="labelSmall" color={palette.silver} style={styles.spinnerMessage}>
            {message}
          </Text>
        )}
      </View>
    );
  }

  // Skeleton variant
  return (
    <View style={styles.skeletonContainer}>
      {children || (
        <>
          <Skeleton width={200} height={20} style={styles.skeletonItem} />
          <Skeleton fill height={80} style={styles.skeletonItem} />
          <Skeleton width={140} height={14} style={styles.skeletonItem} />
          <Skeleton fill height={80} style={styles.skeletonItem} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  spinnerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    minHeight: 200,
  },
  spinnerMessage: {
    marginTop: spacing.md,
    fontSize: 12,
    textTransform: 'none',
    letterSpacing: 0,
  },
  skeletonContainer: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  skeletonItem: {
    borderRadius: spacing.radius.sm,
  },
});

export default LoadingState;
