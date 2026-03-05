/**
 * NotificationDrawer — Slide-over notification panel.
 *
 * Shows recent notifications (friend requests, room invites, CV earned, etc.)
 * with mark-all-read and per-item read tracking.
 * Presented as a Modal from the HomeScreen header bell icon.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, StyleSheet, Modal, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen } from './ui';
import { notificationApi, type Notification } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { VoidSurface, ModuleFaceplate, ChromeButton } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';

interface NotificationDrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenRoom?: (sessionId: string) => void;
}

// Notification type → icon mapping
const NOTIF_ICONS: Record<string, string> = {
  friend_request: 'person-add-outline',
  friend_accepted: 'people-outline',
  room_invite: 'radio-outline',
  cv_earned: 'flash-outline',
  track_played: 'musical-notes-outline',
  reaction: 'heart-outline',
  system: 'information-circle-outline',
};

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// Extracted separator to avoid inline re-creation
const NotifSeparator = () => <View style={styles.separator} />;

export function NotificationDrawer({
  visible, onClose, onOpenUserProfile, onOpenRoom,
}: NotificationDrawerProps) {
  const { accent } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await notificationApi.list();
      setNotifications(res.notifications ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchNotifications();
    }
  }, [visible, fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* swallow */ }
  }, []);

  const handleNotifPress = useCallback((notif: Notification) => {
    // Mark as read
    if (!notif.read) {
      notificationApi.markRead([notif.id]).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => n.id === notif.id ? { ...n, read: true } : n)
      );
    }

    // Route based on notification data
    const data = typeof notif.data === 'string' ? JSON.parse(notif.data || '{}') : (notif.data || {});
    if (data.userId && onOpenUserProfile) {
      onClose();
      onOpenUserProfile(data.userId);
    } else if (data.sessionId && onOpenRoom) {
      onClose();
      onOpenRoom(data.sessionId);
    }
  }, [onClose, onOpenUserProfile, onOpenRoom]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconName = NOTIF_ICONS[item.type] || NOTIF_ICONS.system;
    return (
      <TouchableOpacity
        style={[styles.notifItem, !item.read && styles.notifUnread]}
        onPress={() => handleNotifPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.read ? '' : 'Unread: '}${item.title}. ${item.body}`}
      >
        <View style={[styles.notifIcon, !item.read && { borderColor: accent }]}>
          <Ionicons name={iconName as any} size={16} color={item.read ? palette.slate : accent} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && { color: palette.frost }]}>{item.title}</Text>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
        </View>
        <Text style={styles.notifTime}>{formatTimeAgo(item.createdAt)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeScreen>
        <VoidSurface style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close notifications">
              <Ionicons name="chevron-down" size={24} color={palette.frost} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SIGNAL LOG</Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.markReadBtn} accessibilityRole="button" accessibilityLabel="Mark all as read">
                <Text style={[styles.markReadText, { color: accent }]}>CLEAR ALL</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={accent} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="warning-outline" size={48} color={palette.orange} />
              <Text style={styles.emptyText}>Connection lost</Text>
              <Text style={styles.emptySubtext}>{error}</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn} accessibilityRole="button" accessibilityLabel="Retry loading">
                <Text style={[styles.retryText, { color: accent }]}>TAP TO RETRY</Text>
              </TouchableOpacity>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="notifications-off-outline" size={48} color={palette.steel} />
              <Text style={styles.emptyText}>No signals received yet.</Text>
              <Text style={styles.emptySubtext}>
                Friend requests, room activity, and CV alerts will appear here.
              </Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderNotification}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />
              }
              ItemSeparatorComponent={NotifSeparator}
              initialNumToRender={15}
              windowSize={5}
            />
          )}
        </VoidSurface>
      </SafeScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fontFamily.mono,
    fontSize: 13,
    color: palette.frost,
    letterSpacing: ls.wider,
  },
  markReadBtn: {
    padding: 4,
  },
  markReadText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: ls.normal,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  notifUnread: {
    backgroundColor: 'rgba(255, 179, 71, 0.04)',
  },
  notifIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
    marginRight: 8,
  },
  notifTitle: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: palette.slate,
    marginBottom: 2,
  },
  notifBody: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: palette.slate,
    lineHeight: 17,
    opacity: 0.7,
  },
  notifTime: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.normal,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: palette.chromeBorder,
    marginHorizontal: spacing.screenPadding,
    opacity: 0.5,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontFamily: fontFamily.display,
    fontSize: 16,
    color: palette.silver,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: palette.slate,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  retryText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    letterSpacing: ls.wider,
  },
});
