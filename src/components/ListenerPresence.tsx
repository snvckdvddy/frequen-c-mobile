/**
 * Listener Presence Components
 *
 * ListenerBar — stacked avatar row (tappable → opens drawer)
 * ListenerDrawer — full modal list of who's in the room
 * JoinLeaveToast — ephemeral notification when someone enters/leaves
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList, Modal,
  Animated, Dimensions,
} from 'react-native';
import { Text } from './ui';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import type { Listener } from '../types';

const { height: SCREEN_H } = Dimensions.get('window');
const MAX_VISIBLE_AVATARS = 5;
const AVATAR_SIZE = 28;
const AVATAR_OVERLAP = 8;

// ─── Avatar (single circle with initials) ──────────────────

function Avatar({
  username, size = AVATAR_SIZE, borderColor, isHost = false,
}: {
  username: string; size?: number; borderColor?: string; isHost?: boolean;
}) {
  // Deterministic color from username
  const hue = username.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const bg = `hsl(${hue}, 50%, 30%)`;
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <View
      style={[
        avatarStyles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderColor: borderColor || palette.steel,
          borderWidth: 2,
        },
        isHost && { borderColor: '#39FF14' },
      ]}
    >
      <Text
        variant="labelSmall"
        color={palette.frost}
        style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}
      >
        {initials}
      </Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── ListenerBar (stacked avatars — header component) ────────

interface ListenerBarProps {
  listeners: Listener[];
  hostId: string;
  onPress: () => void;
}

export function ListenerBar({ listeners, hostId, onPress }: ListenerBarProps) {
  const visible = listeners.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = listeners.length - MAX_VISIBLE_AVATARS;
  const totalWidth = visible.length * (AVATAR_SIZE - AVATAR_OVERLAP) + AVATAR_OVERLAP;

  return (
    <TouchableOpacity style={barStyles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[barStyles.stack, { width: totalWidth }]}>
        {visible.map((l, i) => (
          <View
            key={l.userId}
            style={[barStyles.avatarWrap, { left: i * (AVATAR_SIZE - AVATAR_OVERLAP), zIndex: visible.length - i }]}
          >
            <Avatar username={l.username} isHost={l.userId === hostId} />
          </View>
        ))}
      </View>
      {overflow > 0 && (
        <Text variant="labelSmall" color={palette.slate} style={barStyles.overflowText}>
          +{overflow}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const barStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stack: {
    height: AVATAR_SIZE,
    position: 'relative',
  },
  avatarWrap: {
    position: 'absolute',
    top: 0,
  },
  overflowText: {
    marginLeft: 2,
  },
});

// ─── ListenerDrawer (modal list) ─────────────────────────────

interface ListenerDrawerProps {
  visible: boolean;
  listeners: Listener[];
  hostId: string;
  onClose: () => void;
}

export function ListenerDrawer({ visible, listeners, hostId, onClose }: ListenerDrawerProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  // Sort: host first, then alphabetical
  const sorted = [...listeners].sort((a, b) => {
    if (a.userId === hostId) return -1;
    if (b.userId === hostId) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={drawerStyles.overlay}>
        {/* Backdrop — fills screen, tappable to dismiss */}
        <TouchableOpacity style={drawerStyles.backdrop} activeOpacity={1} onPress={onClose} />

        {/* Sheet — anchored to bottom */}
        <Animated.View
          style={[drawerStyles.sheet, { transform: [{ translateY: slideAnim }] }]}
        >
        {/* Handle */}
        <TouchableOpacity style={drawerStyles.handleArea} onPress={onClose} activeOpacity={0.8}>
          <View style={drawerStyles.handle} />
        </TouchableOpacity>

        <View style={drawerStyles.header}>
          <Text variant="h3" color={palette.frost}>
            Listening Now
          </Text>
          <Text variant="labelSmall" color={palette.slate}>
            {listeners.length} {listeners.length === 1 ? 'person' : 'people'}
          </Text>
        </View>

        <FlatList
          data={sorted}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => {
            const isHost = item.userId === hostId;
            return (
              <View style={drawerStyles.row}>
                <Avatar username={item.username} size={36} isHost={isHost} />
                <View style={drawerStyles.rowInfo}>
                  <Text variant="label" color={palette.frost}>
                    {item.username}
                  </Text>
                  {isHost && (
                    <Text variant="labelSmall" color={'#39FF14'}>HOST</Text>
                  )}
                </View>
                {/* Activity dot — green for "listening" */}
                <View style={drawerStyles.activityDot} />
              </View>
            );
          }}
          contentContainerStyle={drawerStyles.list}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={7}
        />
        </Animated.View>
      </View>
    </Modal>
  );
}

const drawerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: SCREEN_H * 0.55,
    backgroundColor: palette.steel,
    borderTopLeftRadius: spacing.radius.xl,
    borderTopRightRadius: spacing.radius.xl,
    paddingBottom: 40,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.slate,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  rowInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#39FF14',
  },
});

// ─── JoinLeaveToast ─────────────────────────────────────────

interface ToastMessage {
  id: string;
  text: string;
  type: 'join' | 'leave' | 'mode' | 'system';
}

interface JoinLeaveToastProps {
  messages: ToastMessage[];
}

export function JoinLeaveToast({ messages }: JoinLeaveToastProps) {
  if (messages.length === 0) return null;

  // Show only the most recent toast
  const latest = messages[messages.length - 1];
  const iconColor = latest.type === 'join' ? '#39FF14'
    : latest.type === 'mode' ? palette.orange
    : palette.slate;
  const icon = latest.type === 'join' ? '→'
    : latest.type === 'mode' ? '~'
    : '←';

  return (
    <View style={toastStyles.container}>
      <View style={[toastStyles.pill, latest.type === 'mode' && toastStyles.modePill]}>
        <Text variant="labelSmall" color={iconColor}>{icon}</Text>
        <Text variant="labelSmall" color={latest.type === 'mode' ? palette.orange : palette.silver}>
          {latest.text}
        </Text>
      </View>
    </View>
  );
}

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  modePill: {
    borderColor: palette.orange + '30',
    backgroundColor: palette.orange + '08',
  },
});

// Re-export types for consumers
export type { ToastMessage };
