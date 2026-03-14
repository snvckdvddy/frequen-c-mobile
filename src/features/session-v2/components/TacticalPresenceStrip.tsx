import React from 'react';
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
  const liveListeners = listeners.slice(0, 4);
  const fallbackListener = !liveListeners.length && currentUsername
    ? [{ userId: currentUserId || hostId, username: currentUsername }]
    : [];
  const visible = [...liveListeners, ...fallbackListener].slice(0, 4);
  const fillerCount = Math.max(0, 4 - visible.length);
  const activeId = currentUserId || hostId;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${listeners.length} listeners in the room`}
    >
      <View style={styles.avatarRow}>
        {visible.map((listener) => (
          <AvatarBlock
            key={listener.userId}
            listener={listener}
            isActive={listener.userId === activeId}
          />
        ))}
        {Array.from({ length: fillerCount }, (_, index) => (
          <View key={`ghost-${index}`} style={styles.ghostBlock} />
        ))}
      </View>

      <View style={styles.countBlock}>
        <Text style={styles.countNumber}>{listeners.length}</Text>
        <Text style={styles.countLabel}>USERS</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: tacticalTokens.spacing.xl,
    marginTop: tacticalTokens.spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  pressed: {
    opacity: 0.84,
  },
  avatarRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.xs,
    minHeight: 56,
  },
  avatarBlock: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderRadius: tacticalTokens.radius.sharp,
    overflow: 'hidden',
    backgroundColor: tacticalTokens.colors.matte,
  },
  ghostBlock: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderRadius: tacticalTokens.radius.sharp,
    borderColor: tacticalTokens.colors.borderSoft,
    backgroundColor: 'rgba(17, 17, 17, 0.45)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  avatarImageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
    letterSpacing: 1,
  },
  activeOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: tacticalTokens.colors.ice,
    borderRadius: tacticalTokens.radius.sharp,
  },
  countBlock: {
    width: 52,
    marginLeft: tacticalTokens.spacing.sm,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  countNumber: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  countLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.5,
    color: tacticalTokens.colors.textDim,
  },
});

export default TacticalPresenceStrip;
