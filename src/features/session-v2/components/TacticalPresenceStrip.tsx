import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Listener } from '../../../types';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalPresenceStripProps {
  listeners: Listener[];
  hostId: string;
  currentUserId?: string;
  currentUsername?: string;
  onPress: () => void;
}

function fallbackColor(seed: string) {
  const hue = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 18%, 20%)`;
}

function AvatarBlock({
  listener,
  isActive,
}: {
  listener: Listener;
  isActive: boolean;
}) {
  const initials = listener.username.slice(0, 2).toUpperCase();
  const backgroundColor = fallbackColor(listener.username);

  return (
    <View
      style={[
        styles.avatarBlock,
        { borderColor: isActive ? tacticalTokens.colors.ice : tacticalTokens.colors.border },
      ]}
    >
      {listener.avatarUrl ? (
        <>
          <Image source={{ uri: listener.avatarUrl }} style={styles.avatarImage} />
          <View style={styles.avatarImageScrim} />
        </>
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor }]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}
      {isActive ? <View style={styles.activeOverlay} /> : null}
    </View>
  );
}

export function TacticalPresenceStrip({
  listeners,
  hostId,
  currentUserId,
  currentUsername,
  onPress,
}: TacticalPresenceStripProps) {
  const activeId = currentUserId || hostId;
  const fallbackListener = !listeners.length && currentUsername
    ? [{ userId: currentUserId || hostId, username: currentUsername }]
    : [];

  const roster = useMemo(() => {
    const unique = new Map<string, Listener>();
    [...listeners, ...fallbackListener].forEach((listener) => {
      if (!unique.has(listener.userId)) {
        unique.set(listener.userId, listener);
      }
    });
    return Array.from(unique.values());
  }, [fallbackListener, listeners]);

  const visible = roster.slice(0, 2);
  const overflowCount = Math.max(0, roster.length - visible.length);

  return (
    <View style={styles.wrap} accessible={false}>
      <View style={styles.container}>
        <View style={styles.avatarRow}>
          {visible.map((listener) => (
            <AvatarBlock
              key={listener.userId}
              listener={listener}
              isActive={listener.userId === activeId}
            />
          ))}
          {overflowCount > 0 ? (
            <View style={styles.overflowBlock}>
              <Text style={styles.overflowText}>{`+${overflowCount}`}</Text>
            </View>
          ) : null}
        </View>

        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open room roster, ${roster.length} listeners in the room`}
          style={({ pressed }) => [styles.countPill, pressed && styles.countPillPressed]}
        >
          <Text style={styles.countNumber}>{roster.length}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: tacticalTokens.spacing.xl,
    marginTop: tacticalTokens.spacing.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.xs,
    minHeight: 38,
    flex: 1,
  },
  avatarBlock: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: tacticalTokens.radius.sharp,
    overflow: 'hidden',
    backgroundColor: tacticalTokens.colors.matte,
  },
  overflowBlock: {
    minWidth: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: tacticalTokens.radius.sharp,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.xs,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    opacity: 0.66,
  },
  avatarImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.white,
    letterSpacing: 1,
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    borderRadius: tacticalTokens.radius.sharp,
  },
  overflowText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1,
  },
  countPill: {
    minWidth: 38,
    height: 38,
    marginLeft: tacticalTokens.spacing.xs,
    paddingHorizontal: tacticalTokens.spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  countPillPressed: {
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#141414',
  },
  countNumber: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.textSoft,
  },
});

export default TacticalPresenceStrip;
