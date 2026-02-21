/**
 * PersonResultCard — Search result for a user.
 *
 * Non-interactive stub. Shows avatar (deterministic color), username, stats.
 * No navigation, no follow button — deferred per YAGNI.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { MockUser } from '../../types';

/** Deterministic color from username hash */
function avatarColor(username: string): string {
  const palette = [
    '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
    '#3B82F6', '#EF4444', '#06B6D4', '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

interface PersonResultCardProps {
  user: MockUser;
}

export function PersonResultCard({ user }: PersonResultCardProps) {
  const bg = avatarColor(user.username);

  return (
    <View style={styles.card}>
      {/* Avatar circle */}
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text variant="label" color="#FFFFFF" style={{ fontSize: 16 }}>
          {user.username.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* User info */}
      <View style={styles.info}>
        <Text variant="label" color={colors.text.primary}>
          {user.username}
        </Text>
        <Text variant="labelSmall" color={colors.text.muted}>
          {user.sessionsCount} sessions · {user.tracksAdded} tracks added
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
});

export default PersonResultCard;
