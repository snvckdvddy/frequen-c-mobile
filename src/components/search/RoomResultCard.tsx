/**
 * RoomResultCard — Search result for a room/session.
 *
 * Reuses Discover card visual patterns:
 * live dot, listener count, mode badge, genre.
 * Tap navigates to SessionRoomScreen.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';
import type { Session } from '../../types';

const modeLabel: Record<string, string> = {
  campfire: 'Campfire',
  spotlight: 'Spotlight',
  openFloor: 'Open Floor',
};

interface RoomResultCardProps {
  session: Session;
  onPress: (sessionId: string) => void;
}

export function RoomResultCard({ session, onPress }: RoomResultCardProps) {
  const mode = modeLabel[session.roomMode] || 'Campfire';
  const listenerCount = session.listeners?.length || 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(session.id)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {session.isLive && <View style={styles.liveDot} />}
          <Text variant="label" color={palette.frost} numberOfLines={1} style={{ flex: 1 }}>
            {session.name}
          </Text>
        </View>
        <Text variant="labelSmall" color={palette.slate}>
          {mode}
        </Text>
      </View>

      <View style={styles.meta}>
        <Text variant="bodySmall" color={palette.silver}>
          {session.hostUsername}
        </Text>
        {session.genre ? (
          <Text variant="labelSmall" color={palette.slate}>
            · {session.genre}
          </Text>
        ) : null}
        <Text variant="labelSmall" color={palette.slate}>
          · {listenerCount} listening
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.red,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export default RoomResultCard;
