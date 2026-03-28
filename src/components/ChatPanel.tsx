/**
 * ChatPanel — In-session text chat
 *
 * Slides up from the bottom of SessionRoomScreen.
 * Shows messages, system events, and quick reactions.
 * Designed to feel lightweight — not a full chat app.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, TouchableOpacity, Pressable,
  KeyboardAvoidingView, Platform, Animated, Keyboard, PanResponder,
} from 'react-native';
import { Text } from './ui';
import { palette } from '../design/tokens/materials';
import { sendChatMessage, onSessionEvent } from '../services/socket';
import { getGlobalLimiter, validateChatMessage, CHAT_MAX_LENGTH } from '../utils/rateLimiter';
import type { ChatMessage } from '../types';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

// ─── Props ──────────────────────────────────────────────────

interface ChatPanelProps {
  sessionId: string;
  userId: string;
  username: string;
  visible: boolean;
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────

function hashColor(str: string): string {
  let sum = 0;
  for (let i = 0; i < str.length; i++) sum += str.charCodeAt(i);
  const hue = sum % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

// ─── Quick Reactions ────────────────────────────────────────

const QUICK_REACTIONS = ['🔥', '💜', '😂', '🎵', '👏'] as const;

// ─── Message Bubble ─────────────────────────────────────────

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const userColor = hashColor(message.username);

  if (message.type === 'system') {
    return (
      <View style={bubbleStyles.systemRow}>
        <Text variant="labelSmall" color={palette.slate} align="center">
          {message.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[bubbleStyles.row, isOwn && bubbleStyles.rowOwn]}>
      {/* Avatar (left side, other people only) */}
      {!isOwn && (
        <View style={[bubbleStyles.avatar, { backgroundColor: userColor + '30' }]}>
          <Text variant="labelSmall" color={userColor} style={{ fontSize: 10 }}>
            {message.username.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={[bubbleStyles.bubble, isOwn ? bubbleStyles.bubbleOwn : bubbleStyles.bubbleOther]}>
        {!isOwn && (
          <Text variant="labelSmall" color={userColor} style={{ marginBottom: 2 }}>
            {message.username}
          </Text>
        )}
        <Text variant="bodySmall" color={palette.frost}>
          {message.text}
        </Text>
        <Text variant="labelSmall" color={palette.slate} style={bubbleStyles.time}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: tacticalTokens.spacing.sm,
    gap: tacticalTokens.spacing.xs,
  },
  rowOwn: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: tacticalTokens.spacing.sm + 2,
    paddingVertical: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
  },
  bubbleOwn: {
    backgroundColor: '#25160E',
    borderColor: tacticalTokens.colors.orange,
  },
  bubbleOther: {
    backgroundColor: tacticalTokens.colors.matte,
  },
  time: {
    alignSelf: 'flex-end',
    marginTop: 2,
    fontSize: 9,
  },
  systemRow: {
    marginBottom: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.sm,
    paddingHorizontal: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
});

// ─── Main Component ─────────────────────────────────────────

export function ChatPanel({ sessionId, userId, username, visible, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const closePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 12 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 80 || (gestureState.dy > 35 && gestureState.vy > 0.9)) {
          onClose();
        }
      },
    })
  ).current;

  // ─── Slide animation ──────────────────────────────────
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  // ─── Listen for incoming messages ─────────────────────
  useEffect(() => {
    const unsub = onSessionEvent('chat-message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
    return unsub;
  }, []);

  // ─── Seed system message on mount ─────────────────────
  useEffect(() => {
    setMessages([
      {
        id: 'sys_welcome',
        sessionId,
        userId: 'system',
        username: 'system',
        text: 'Chat started. Keep it respectful ✌️',
        type: 'system',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, [sessionId]);

  // ─── Auto-scroll to bottom ────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ─── Send message (validated + rate-limited) ─────────
  const handleSend = useCallback(() => {
    const validated = validateChatMessage(inputText);
    if (!validated) return;
    if (!getGlobalLimiter().canDo('chat')) return;
    sendChatMessage(sessionId, userId, username, validated);
    setInputText('');
  }, [inputText, sessionId, userId, username]);

  // ─── Quick reaction (rate-limited) ────────────────────
  const handleQuickReaction = useCallback((emoji: string) => {
    if (!getGlobalLimiter().canDo('reaction')) return;
    sendChatMessage(sessionId, userId, username, emoji);
  }, [sessionId, userId, username]);

  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });
  const messageCount = messages.filter((m) => m.type === 'message').length;

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close chat overlay" />

      <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
        <TacticalGridBackground opacity={0.88} />
        <View style={styles.content}>
          <View style={styles.header} {...closePanResponder.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerSys}>SYS.FREQ // CHAT BUS</Text>
                <Text style={styles.headerTitle}>ROOM CHAT</Text>
              </View>
              <View style={styles.headerActions}>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{String(messageCount).padStart(2, '0')}</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close chat">
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <KeyboardAvoidingView
            style={styles.body}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={100}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <MessageBubble message={item} isOwn={item.userId === userId} />
              )}
              contentContainerStyle={styles.messageList}
              showsVerticalScrollIndicator={false}
              initialNumToRender={15}
              maxToRenderPerBatch={8}
              windowSize={11}
            />

            <View style={styles.quickRow}>
              {QUICK_REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.quickBtn}
                  onPress={() => handleQuickReaction(emoji)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`Send ${emoji === '🔥' ? 'fire' : emoji === '💜' ? 'heart' : emoji === '😂' ? 'laugh' : emoji === '🎵' ? 'music' : 'clap'} reaction`}
                >
                  <Text style={styles.quickEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputPrefix}>
                <Text style={styles.inputPrefixText}>MSG</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="TYPE MESSAGE"
                placeholderTextColor={tacticalTokens.colors.textDim}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
                maxLength={CHAT_MAX_LENGTH}
                accessibilityLabel="Type a message"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim()}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: !inputText.trim() }}
              >
                <Text style={[styles.sendText, !inputText.trim() && styles.sendTextDisabled]}>SEND</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '62%',
    backgroundColor: tacticalTokens.colors.void,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 1,
    borderColor: tacticalTokens.colors.border,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  header: {
    paddingTop: tacticalTokens.spacing.sm,
    paddingBottom: tacticalTokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(4, 4, 4, 0.92)',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: tacticalTokens.colors.borderSoft,
    alignSelf: 'center',
    marginBottom: tacticalTokens.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: tacticalTokens.spacing.xl,
    gap: tacticalTokens.spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerSys: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.8,
  },
  headerTitle: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.xs,
  },
  countPill: {
    minWidth: 40,
    minHeight: 36,
    paddingHorizontal: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#051419',
  },
  countText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.ice,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  closeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.textMuted,
  },
  body: {
    flex: 1,
  },
  messageList: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.md,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: tacticalTokens.spacing.xs,
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingVertical: tacticalTokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.9)',
  },
  quickBtn: {
    width: 40, height: 40,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center', justifyContent: 'center',
  },
  quickEmoji: {
    fontSize: 18,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.sm,
    paddingBottom: tacticalTokens.spacing.lg,
    gap: tacticalTokens.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(6, 6, 6, 0.94)',
  },
  inputPrefix: {
    width: 44,
    minHeight: 46,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputPrefixText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  input: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.md,
    color: tacticalTokens.colors.white,
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.body,
    letterSpacing: 0.6,
  },
  sendBtn: {
    minWidth: 64,
    minHeight: 46,
    paddingHorizontal: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#25160E',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: {
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  sendText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.1,
  },
  sendTextDisabled: {
    color: tacticalTokens.colors.textSoft,
  },
});

export default ChatPanel;
