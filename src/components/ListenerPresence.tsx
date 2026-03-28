/**
 * Listener Presence Components
 *
 * ListenerBar — stacked avatar row (tappable → opens drawer)
 * ListenerDrawer — full modal list of who's in the room
 * JoinLeaveToast — ephemeral notification when someone enters/leaves
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, FlatList, Modal, Pressable, Text as RNText,
  Animated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import type { Listener } from '../types';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

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
        isHost && { borderColor: palette.green },
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
    <TouchableOpacity style={barStyles.container} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${visible.length} listener${visible.length !== 1 ? 's' : ''}${overflow > 0 ? ` plus ${overflow} more` : ''} in room. Tap to see all`}>
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
  const sorted = [...listeners].sort((a, b) => {
    if (a.userId === hostId) return -1;
    if (b.userId === hostId) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={drawerStyles.overlay}>
        <Pressable
          style={drawerStyles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close listeners panel"
        />
        <View style={drawerStyles.sheet}>
          <TacticalGridBackground opacity={0.84} />
          <View style={drawerStyles.content}>
            <View style={drawerStyles.header}>
              <View style={drawerStyles.headerText}>
                <RNText style={drawerStyles.eyebrow}>SYS.FREQ // ROOM BUS</RNText>
                <RNText style={drawerStyles.title}>LISTENERS ONLINE</RNText>
                <RNText style={drawerStyles.subtitle}>
                  {listeners.length} {listeners.length === 1 ? 'PERSON IN ROOM' : 'PEOPLE IN ROOM'}
                </RNText>
              </View>
              <View style={drawerStyles.headerActions}>
                <View style={drawerStyles.countPill}>
                  <RNText style={drawerStyles.countText}>{String(listeners.length).padStart(2, '0')}</RNText>
                </View>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close listeners panel"
                  style={({ pressed }) => [drawerStyles.closeButton, pressed && drawerStyles.closeButtonPressed]}
                >
                  <Ionicons name="close" size={18} color={tacticalTokens.colors.white} />
                </Pressable>
              </View>
            </View>

            <FlatList
              data={sorted}
              keyExtractor={(item) => item.userId}
              renderItem={({ item, index }) => {
                const isHost = item.userId === hostId;
                return (
                  <View style={drawerStyles.row}>
                    <View style={drawerStyles.rowIndex}>
                      <RNText style={drawerStyles.rowIndexText}>{String(index + 1).padStart(2, '0')}</RNText>
                    </View>
                    <Avatar username={item.username} size={34} isHost={isHost} borderColor={isHost ? tacticalTokens.colors.acid : tacticalTokens.colors.border} />
                    <View style={drawerStyles.rowInfo}>
                      <RNText style={drawerStyles.rowName} numberOfLines={1}>
                        {item.username.toUpperCase()}
                      </RNText>
                      <RNText style={drawerStyles.rowMeta}>
                        {isHost ? 'HOST / CONTROL' : 'LISTENER / LIVE'}
                      </RNText>
                    </View>
                    <View style={drawerStyles.rowRight}>
                      {isHost ? (
                        <View style={drawerStyles.hostPill}>
                          <RNText style={drawerStyles.hostPillText}>HOST</RNText>
                        </View>
                      ) : null}
                      <View style={drawerStyles.activityDot} />
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={drawerStyles.list}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const drawerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheet: {
    height: '68%',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(4, 4, 4, 0.9)',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  countPill: {
    minWidth: 42,
    height: 36,
    paddingHorizontal: tacticalTokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#081218',
  },
  countText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.4,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  closeButtonPressed: {
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#141414',
  },
  list: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingVertical: tacticalTokens.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
    minHeight: 64,
    marginBottom: tacticalTokens.spacing.sm,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
  },
  rowIndex: {
    width: 28,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: tacticalTokens.colors.border,
    marginRight: tacticalTokens.spacing.sm,
  },
  rowIndexText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.2,
    transform: [{ rotate: '-90deg' }],
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  rowMeta: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: tacticalTokens.spacing.xs,
  },
  hostPill: {
    paddingHorizontal: tacticalTokens.spacing.xs + 2,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: '#0E1408',
  },
  hostPillText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.acid,
    letterSpacing: 1.2,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tacticalTokens.colors.acid,
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
  const iconColor = latest.type === 'join' ? palette.green
    : latest.type === 'mode' ? palette.orange
    : palette.slate;
  const icon = latest.type === 'join' ? '→'
    : latest.type === 'mode' ? '~'
    : '←';

  return (
    <View style={toastStyles.container} pointerEvents="none">
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
