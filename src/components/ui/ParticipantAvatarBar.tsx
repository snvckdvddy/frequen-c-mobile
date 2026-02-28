/**
 * Participant Avatar Bar — Shows live listeners in a session room.
 *
 * Convergence Strategy §3.2:
 * Avatar circles: 28pt, stacked with 8pt overlap
 * Max 4 visible + "+N" counter
 * "N listening" text
 * Invite button (optional)
 */

import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';
import type { Listener } from '../../types';

interface ParticipantAvatarBarProps {
  listeners: Listener[];
  /** Max avatars to show before "+N" */
  maxVisible?: number;
  /** Show the invite button */
  showInvite?: boolean;
  onInvitePress?: () => void;
  onAvatarPress?: (listener: Listener) => void;
}

const AVATAR_SIZE = 28;
const AVATAR_OVERLAP = 8;

export function ParticipantAvatarBar({
  listeners,
  maxVisible = 4,
  showInvite = true,
  onInvitePress,
  onAvatarPress,
}: ParticipantAvatarBarProps) {
  const visible = listeners.slice(0, maxVisible);
  const overflow = listeners.length - maxVisible;
  const totalCount = listeners.length;

  return (
    <View style={styles.container}>
      {/* Avatar stack */}
      <View style={styles.avatarStack}>
        {visible.map((listener, index) => (
          <TouchableOpacity
            key={listener.userId}
            style={[
              styles.avatar,
              { marginLeft: index === 0 ? 0 : -AVATAR_OVERLAP, zIndex: maxVisible - index },
            ]}
            onPress={() => onAvatarPress?.(listener)}
            activeOpacity={0.8}
          >
            {listener.avatarUrl ? (
              <Image source={{ uri: listener.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, styles.avatarPlaceholder]}>
                <Text variant="label" color={palette.frost} style={{ fontSize: 11 }}>
                  {listener.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {overflow > 0 && (
          <View style={[styles.avatar, styles.overflowBadge, { marginLeft: -AVATAR_OVERLAP }]}>
            <Text variant="label" color={palette.frost} style={{ fontSize: 10 }}>
              +{overflow}
            </Text>
          </View>
        )}
      </View>

      {/* Listener count */}
      <Text variant="bodySmall" color={palette.silver}>
        {totalCount} listening
      </Text>

      {/* Spacer */}
      <View style={{ flex: 1 }} />

      {/* Invite button */}
      {showInvite && (
        <TouchableOpacity style={styles.inviteBtn} onPress={onInvitePress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Invite people to session">
          <Ionicons name="person-add-outline" size={14} color={palette.orange} />
          <Text variant="label" color={palette.orange} style={{ fontSize: 12 }}>
            Invite
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    height: 40,
    gap: spacing.sm,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: palette.midnight,
  },
  avatarImage: {
    width: AVATAR_SIZE - 4,
    height: AVATAR_SIZE - 4,
    borderRadius: (AVATAR_SIZE - 4) / 2,
  },
  avatarPlaceholder: {
    backgroundColor: palette.midnight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowBadge: {
    backgroundColor: palette.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    borderColor: palette.orange,
    gap: 4,
  },
});

export default ParticipantAvatarBar;
