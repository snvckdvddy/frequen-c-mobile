import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notificationApi, type Notification } from '../services/api';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface NotificationDrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpenUserProfile?: (userId: string) => void;
  onOpenRoom?: (sessionId: string) => void;
}

const NOTIF_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  friend_request: 'person-add-outline',
  friend_accepted: 'people-outline',
  room_invite: 'radio-outline',
  cv_earned: 'flash-outline',
  track_played: 'musical-notes-outline',
  reaction: 'heart-outline',
  system: 'information-circle-outline',
};

function MonoText(props: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  return <Text {...props} />;
}

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'NOW';
  if (mins < 60) return `${mins}M`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H`;
  const days = Math.floor(hrs / 24);
  return `${days}D`;
}

function parseNotifData(notif: Notification) {
  if (typeof notif.data === 'string') {
    try {
      return JSON.parse(notif.data || '{}');
    } catch {
      return {};
    }
  }
  return notif.data || {};
}

export function NotificationDrawer({
  visible,
  onClose,
  onOpenUserProfile,
  onOpenRoom,
}: NotificationDrawerProps) {
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
      setError(err instanceof Error ? err.message.toUpperCase() : 'SIGNAL LOG OFFLINE');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      void fetchNotifications();
    }
  }, [visible, fetchNotifications]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    } catch {}
  }, []);

  const handleNotifPress = useCallback((notif: Notification) => {
    if (!notif.read) {
      notificationApi.markRead([notif.id]).catch(() => {});
      setNotifications((prev) =>
        prev.map((item) => (item.id === notif.id ? { ...item, read: true } : item)),
      );
    }

    const data = parseNotifData(notif);
    if (data.userId && onOpenUserProfile) {
      onClose();
      onOpenUserProfile(data.userId);
      return;
    }
    if (data.sessionId && onOpenRoom) {
      onClose();
      onOpenRoom(data.sessionId);
    }
  }, [onClose, onOpenRoom, onOpenUserProfile]);

  const unreadCount = useMemo(
    () => notifications.filter((notif) => !notif.read).length,
    [notifications],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close notification drawer"
        />

        <View style={styles.sheet}>
          <TacticalGridBackground opacity={0.84} />
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <MonoText style={[styles.mono, styles.eyebrow]}>SYS.FREQ // SIGNAL LOG</MonoText>
                <MonoText style={[styles.display, styles.title]}>NOTIFICATIONS</MonoText>
              </View>

              <View style={styles.headerActions}>
                <View style={styles.countChip}>
                  <MonoText style={[styles.monoBold, styles.countText]}>
                    {String(unreadCount).padStart(2, '0')}
                  </MonoText>
                </View>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Close notifications"
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={18} color={tacticalTokens.colors.white} />
                </Pressable>
              </View>
            </View>

            {unreadCount > 0 ? (
              <Pressable
                onPress={() => void handleMarkAllRead()}
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <MonoText style={[styles.monoBold, styles.clearButtonText]}>CLEAR ALL</MonoText>
              </Pressable>
            ) : null}

            {loading ? (
              <View style={styles.centerState}>
                <ActivityIndicator size="large" color={tacticalTokens.colors.ice} />
              </View>
            ) : error ? (
              <View style={styles.emptyState}>
                <Ionicons name="warning-outline" size={42} color={tacticalTokens.colors.orange} />
                <MonoText style={[styles.display, styles.emptyTitle]}>CONNECTION LOST</MonoText>
                <MonoText style={[styles.mono, styles.emptyCopy]}>{error}</MonoText>
                <Pressable
                  onPress={handleRefresh}
                  accessibilityRole="button"
                  accessibilityLabel="Retry notification load"
                  style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
                >
                  <MonoText style={[styles.monoBold, styles.retryButtonText]}>RETRY</MonoText>
                </Pressable>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="notifications-off-outline" size={42} color={tacticalTokens.colors.textMuted} />
                <MonoText style={[styles.display, styles.emptyTitle]}>NO SIGNALS</MonoText>
                <MonoText style={[styles.mono, styles.emptyCopy]}>
                  Friend requests, room events, and CV alerts will route here.
                </MonoText>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={tacticalTokens.colors.ice}
                  />
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) => {
                  const iconName = NOTIF_ICONS[item.type] || NOTIF_ICONS.system;
                  return (
                    <Pressable
                      onPress={() => handleNotifPress(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.read ? '' : 'Unread '}${item.title}`}
                      style={({ pressed }) => [
                        styles.notificationRow,
                        !item.read && styles.notificationUnread,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.notificationIcon, !item.read && styles.notificationIconUnread]}>
                        <Ionicons
                          name={iconName}
                          size={16}
                          color={item.read ? tacticalTokens.colors.textMuted : tacticalTokens.colors.ice}
                        />
                      </View>

                      <View style={styles.notificationCopy}>
                        <MonoText style={[styles.display, styles.notificationTitle]} numberOfLines={1}>
                          {item.title.toUpperCase()}
                        </MonoText>
                        <MonoText style={[styles.mono, styles.notificationBody]} numberOfLines={2}>
                          {item.body}
                        </MonoText>
                      </View>

                      <MonoText style={[styles.mono, styles.notificationTime]}>
                        {formatTimeAgo(item.createdAt)}
                      </MonoText>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheet: {
    flex: 1,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  pressed: {
    opacity: 0.82,
  },
  mono: {
    fontFamily: tacticalTokens.fonts.mono,
  },
  monoBold: {
    fontFamily: tacticalTokens.fonts.monoBold,
  },
  display: {
    fontFamily: tacticalTokens.fonts.display,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontSize: 28,
    color: tacticalTokens.colors.white,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countChip: {
    minWidth: 40,
    height: 40,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#04161A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    fontSize: 12,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 10,
    color: tacticalTokens.colors.void,
    letterSpacing: 1.6,
  },
  listContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  separator: {
    height: 8,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  notificationUnread: {
    borderColor: tacticalTokens.colors.ice,
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIconUnread: {
    borderColor: tacticalTokens.colors.ice,
  },
  notificationCopy: {
    flex: 1,
    minWidth: 0,
  },
  notificationTitle: {
    fontSize: 16,
    color: tacticalTokens.colors.white,
  },
  notificationBody: {
    marginTop: 2,
    fontSize: 10,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 24,
    color: tacticalTokens.colors.white,
  },
  emptyCopy: {
    marginTop: 4,
    fontSize: 12,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#04161A',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.5,
  },
});

export default NotificationDrawer;
