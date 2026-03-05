/**
 * PersonResultCard — Search result for a user.
 *
 * Shows avatar (deterministic color), username, stats.
 * Tap to view profile, Add Friend button for quick-add.
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { palette } from '../../design/tokens/materials';
import { fontFamily, letterSpacing as ls } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';
import { friendApi } from '../../services/api';
import type { MockUser } from '../../types';

/** Deterministic color from username hash */
function avatarColor(username: string): string {
  const colors = [
    palette.magenta,
    palette.signalSaw,
    palette.amber,
    palette.green,
    palette.orange,
    palette.red,
    palette.ice,
    palette.silver,
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface PersonResultCardProps {
  user: MockUser;
  onPress?: (userId: string) => void;
}

export function PersonResultCard({ user, onPress }: PersonResultCardProps) {
  const bg = avatarColor(user.username);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'sent'>('none');

  const handleAddFriend = async () => {
    if (friendStatus !== 'none') return;
    try {
      setFriendStatus('pending');
      await friendApi.sendRequest(user.id);
      setFriendStatus('sent');
    } catch {
      setFriendStatus('none');
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(user.id)}
      activeOpacity={0.6}
    >
      {/* Avatar circle */}
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text variant="label" color={palette.frost} style={{ fontSize: 16 }}>
          {user.username.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* User info */}
      <View style={styles.info}>
        <Text variant="label" color={palette.frost}>
          {user.username}
        </Text>
        <Text variant="labelSmall" color={palette.slate}>
          {user.sessionsCount} sessions · {user.tracksAdded} tracks added
        </Text>
      </View>

      {/* Add Friend button */}
      <TouchableOpacity
        style={[
          styles.addBtn,
          friendStatus === 'sent' && styles.addBtnSent,
        ]}
        onPress={handleAddFriend}
        disabled={friendStatus !== 'none'}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={friendStatus === 'sent' ? 'checkmark' : 'person-add-outline'}
          size={14}
          color={friendStatus === 'sent' ? palette.green : palette.silver}
        />
        {friendStatus === 'sent' && (
          <Text style={styles.sentText}>SENT</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  addBtnSent: {
    borderColor: palette.green,
    flexDirection: 'row',
    width: 'auto',
    paddingHorizontal: 10,
    gap: 4,
  },
  sentText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.green,
    letterSpacing: ls.wide,
  },
});

export default PersonResultCard;
