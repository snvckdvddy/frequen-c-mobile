/**
 * EmptyState — Zero-data placeholder with optional CTA.
 *
 * Renders a centered message when a list/screen has no content.
 * Consistent brand styling: Ionicon + frost title + silver subtitle + ice CTA.
 *
 * Usage:
 *   <EmptyState
 *     icon="search-outline"
 *     title="No results"
 *     subtitle="Try a different search term"
 *     actionLabel="Clear Search"
 *     onAction={clearSearch}
 *   />
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';

interface EmptyStateProps {
  /** Ionicons icon name (outline variant preferred) */
  icon?: string;
  /** Icon size (default 48) */
  iconSize?: number;
  /** Primary message */
  title: string;
  /** Secondary explanation */
  subtitle?: string;
  /** CTA button label */
  actionLabel?: string;
  /** CTA button callback */
  onAction?: () => void;
}

export function EmptyState({
  icon = 'albums-outline',
  iconSize = 48,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon as any} size={iconSize} color={palette.slate} />
      </View>
      <Text variant="body" color={palette.frost} align="center" style={styles.title}>
        {title}
      </Text>
      {subtitle && (
        <Text variant="labelSmall" color={palette.slate} align="center" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.7}>
          <Text variant="label" color={palette.orange} style={styles.actionText}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    opacity: 0.5,
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
  actionBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: palette.orange,
  },
  actionText: {
    fontSize: 12,
    letterSpacing: 1,
  },
});

export default EmptyState;
