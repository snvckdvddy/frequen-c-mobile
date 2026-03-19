/**
 * FriendsScreen — Social hub with tabs.
 *
 * Tabs: ONLINE | ALL | REQUESTS
 * Shows friends, online status, and pending requests with accept/reject.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import {
  friendApi, FriendUser, FriendRequest, OnlineFriend,
} from '../services/api';
import { VoidSurface } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';

type Tab = 'online' | 'all' | 'requests';

interface FriendsScreenProps {
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenRoom?: (sessionId: string) => void;
}

export function FriendsScreen({ onBack, onOpenProfile, onOpenRoom }: FriendsScreenProps) {
  const { accent } = useTheme();

  const [tab, setTab] = useState<Tab>('online');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [friendsRes, onlineRes, pendingRes] = await Promise.all([
        friendApi.list(),
        friendApi.online(),
        friendApi.pending(),
      ]);
      setFriends(friendsRes.friends);
      setOnlineFriends(onlineRes.online);
      setPendingRequests(pendingRes.requests);
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAccept = async (userId: string) => {
    try {
      await friendApi.accept(userId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== userId));
      // Re-fetch friends list
      const res = await friendApi.list();
      setFriends(res.friends);
    } catch (err) {
      console.error('Accept failed:', err);
    }
  };

  const handleReject = async (userId: string) => {
    try {
      await friendApi.reject(userId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== userId));
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const handleRemove = (userId: string, username: string) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            await friendApi.remove(userId);
            setFriends((prev) => prev.filter((f) => f.id !== userId));
            setOnlineFriends((prev) => prev.filter((f) => f.id !== userId));
          },
        },
      ],
    );
  };

  // ─── Render Items ──────────────────────────────────────────

  const renderFriend = ({ item }: { item: FriendUser }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpenProfile(item.id)}
      onLongPress={() => handleRemove(item.id, item.username)}
      activeOpacity={0.6}
    >
      <View style={styles.rowAvatar}>
        <Ionicons name="person" size={18} color={palette.silver} />
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowName}>{item.username}</Text>
        <Text style={styles.rowSub}>
          {item.sessionsHosted ?? 0} rooms · {item.tracksAdded ?? 0} tracks
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.slate} />
    </TouchableOpacity>
  );

  const renderOnline = ({ item }: { item: OnlineFriend }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpenRoom?.(item.sessionId)}
      activeOpacity={0.6}
    >
      <View style={[styles.rowAvatar, { borderColor: palette.green }]}>
        <Ionicons name="person" size={18} color={palette.green} />
      </View>
      <View style={styles.rowMeta}>
        <Text style={styles.rowName}>{item.username}</Text>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>{item.sessionName}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.joinBtn, { borderColor: palette.green }]}
        onPress={() => onOpenRoom?.(item.sessionId)}
      >
        <Text style={styles.joinText}>JOIN</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowAvatar}
        onPress={() => onOpenProfile(item.id)}
      >
        <Ionicons name="person" size={18} color={palette.silver} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.rowMeta} onPress={() => onOpenProfile(item.id)}>
        <Text style={styles.rowName}>{item.username}</Text>
        <Text style={styles.rowSub}>Wants to connect</Text>
      </TouchableOpacity>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: palette.green }]}
          onPress={() => handleAccept(item.id)}
        >
          <Ionicons name="checkmark" size={16} color={palette.green} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: palette.red }]}
          onPress={() => handleReject(item.id)}
        >
          <Ionicons name="close" size={16} color={palette.red} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const getListData = () => {
    switch (tab) {
      case 'online': return onlineFriends;
      case 'all': return friends;
      case 'requests': return pendingRequests;
    }
  };

  const getEmptyMessage = () => {
    switch (tab) {
      case 'online': return 'No friends in live sessions right now';
      case 'all': return 'No friends yet. Search for users to connect!';
      case 'requests': return 'No pending friend requests';
    }
  };

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        {/* ─── Header ────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={palette.silver} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PATCH BAY</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* ─── Tabs ──────────────────────────────────── */}
        <View style={styles.tabRow}>
          {(['online', 'all', 'requests'] as Tab[]).map((t) => {
            const isActive = tab === t;
            const count = t === 'online' ? onlineFriends.length
              : t === 'all' ? friends.length
              : pendingRequests.length;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tab, isActive && { borderBottomColor: accent }]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, isActive && { color: accent }]}>
                  {t.toUpperCase()}{count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── List ──────────────────────────────────── */}
        <FlatList
          data={getListData() as any[]}
          keyExtractor={(item: any) => item.id}
          renderItem={tab === 'online' ? renderOnline as any : tab === 'requests' ? renderRequest as any : renderFriend as any}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name={tab === 'online' ? 'radio-outline' : tab === 'requests' ? 'mail-outline' : 'people-outline'}
                size={40}
                color={palette.slate}
              />
              <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
            </View>
          }
        />
      </VoidSurface>
    </SafeScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  // List
  listContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rowAvatar: {
    width: 40, height: 40, borderRadius: 0,
    borderWidth: 1, borderColor: palette.chromeBorder,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center', justifyContent: 'center',
  },
  rowMeta: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.md,
    color: palette.frost,
  },
  rowSub: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  // Online specific
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 5, height: 5, borderRadius: 0,
    backgroundColor: palette.green,
  },
  liveLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.green,
    letterSpacing: ls.wide,
  },
  joinBtn: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  joinText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.green,
    letterSpacing: ls.wide,
    fontWeight: '700',
  },
  // Requests
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 32, height: 32, borderRadius: 0,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    color: palette.slate,
    textAlign: 'center',
    maxWidth: 240,
  },
});

export default FriendsScreen;
