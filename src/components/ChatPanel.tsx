/**
 * ChatPanel — In-session text chat
 *
 * Slides up from the bottom of SessionRoomScreen.
 * Shows messages, system events, and quick reactions.
 * Designed to feel lightweight — not a full chat app.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Animated, Keyboard,
} from 'react-native';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { sendChatMessage, onSessionEvent } from '../services/socket';
import type { ChatMessage } from '../types';

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

const QUICK_REACTIONS = ['\uD83D\uDD25', '\uD83D\uDC9C', '\uD83D\uDE02', '\uD83C\uDFB5', '\uD83D\uDC4F'] as const;

// ─── Message Bubble ─────────────────────────────────────────

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const userColor = hashColor(message.username);

  if (message.type === 'system') {
    return (
      <View style={bubbleStyles.systemRow}>
        <Text variant="labelSmall" color={colors.text.muted} align="center">
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
        <Text variant="bodySmall" color={colors.text.primary}>
          {message.text}
        </Text>
        <Text variant="labelSmall" color={colors.text.muted} style={bubbleStyles.time}>
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
    marginBottom: 6,
    paddingHorizontal: spacing.sm,
    gap: 6,
  },
  rowOwn: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleOwn: {
    backgroundColor: colors.action.primary + '25',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.bg.input,
    borderBottomLeftRadius: 4,
  },
  time: {
    alignSelf: 'flex-end',
    marginTop: 2,
    fontSize: 9,
  },
  systemRow: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
});

// ─── Main Component ─────────────────────────────────────────

export function ChatPanel({ sessionId, userId, username, visible, onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

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
        text: 'Chat started. Keep it respectful \u270C\uFE0F',
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

  // ─── Send message ─────────────────────────────────────
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    sendChatMessage(sessionId, userId, username, text);
    setInputText('');
  }, [inputText, sessionId, userId, username]);

  // ─── Quick reaction ───────────────────────────────────
  const handleQuickReaction = useCallback((emoji: string) => {
    sendChatMessage(sessionId, userId, username, emoji);
  }, [sessionId, userId, username]);

  if (!visible) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text variant="labelLarge" color={colors.text.primary}>Chat</Text>
          <Text variant="labelSmall" color={colors.text.muted}>
            {messages.filter((m) => m.type === 'message').length} messages
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text variant="label" color={colors.text.muted}>\u2715</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
        />

        {/* Quick Reactions */}
        <View style={styles.quickRow}>
          {QUICK_REACTIONS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.quickBtn}
              onPress={() => handleQuickReaction(emoji)}
              activeOpacity={0.6}
            >
              <Text style={{ fontSize: 20 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Say something..."
            placeholderTextColor={colors.text.muted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            activeOpacity={0.7}
          >
            <Text variant="label" color={inputText.trim() ? colors.action.primary : colors.text.muted}>
              \u2191
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: colors.bg.primary,
    borderTopLeftRadius: spacing.radius.xl,
    borderTopRightRadius: spacing.radius.xl,
    borderTopWidth: 1,
    borderColor: colors.border.subtle,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 8,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.subtle,
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
  },
  closeBtn: {
    padding: 4,
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  quickBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.bg.input,
    alignItems: 'center', justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.md,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: colors.bg.input,
    borderRadius: 20,
    paddingHorizontal: 16,
    color: colors.text.primary,
    fontSize: 14,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.action.primary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.bg.input,
  },
});

export default ChatPanel;
