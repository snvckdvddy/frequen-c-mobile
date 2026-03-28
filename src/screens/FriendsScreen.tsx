import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, showToast } from '../components/ui';
import { VoidSurface } from '../design/components';
import {
  friendApi,
  type FriendRequest,
  type FriendUser,
  type OnlineFriend,
} from '../services/api';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { TacticalActionPrompt } from '../features/session-v2/components/TacticalActionPrompt';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { notifyError, tapLight, tapMedium } from '../utils/haptics';

type Tab = 'online' | 'all' | 'requests';

interface FriendsScreenProps {
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenRoom?: (sessionId: string) => void;
}

function MonoText({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: any;
  numberOfLines?: number;
}) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

function AvatarTile({
  username,
  avatarUrl,
  accent,
}: {
  username: string;
  avatarUrl?: string | null;
  accent?: string;
}) {
  if (avatarUrl) {
    return (
      <View style={[styles.avatarFrame, accent ? { borderColor: accent } : null]}>
        <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
      </View>
    );
  }

  return (
    <View style={[styles.avatarFrame, accent ? { borderColor: accent } : null]}>
      <MonoText style={styles.avatarFallback}>{username.slice(0, 2).toUpperCase()}</MonoText>
    </View>
  );
}

function SummaryChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <View style={styles.summaryChip}>
      <MonoText style={[styles.summaryValue, { color: accent }]}>
        {String(value).padStart(2, '0')}
      </MonoText>
      <MonoText style={styles.summaryLabel}>{label}</MonoText>
    </View>
  );
}

export function FriendsScreen({ onBack, onOpenProfile, onOpenRoom }: FriendsScreenProps) {
  const [tab, setTab] = useState<Tab>('online');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [onlineFriends, setOnlineFriends] = useState<OnlineFriend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [removePrompt, setRemovePrompt] = useState<FriendUser | null>(null);

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
      setInlineError(null);
    } catch (err: any) {
      setInlineError((err?.message || 'FRIEND ROUTING OFFLINE').toUpperCase());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const handleAccept = useCallback(async (userId: string) => {
    tapMedium();
    try {
      await friendApi.accept(userId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== userId));
      const res = await friendApi.list();
      setFriends(res.friends);
    } catch {
      notifyError();
      showToast('Unable to accept request.', 'error', '!');
    }
  }, []);

  const handleReject = useCallback(async (userId: string) => {
    tapLight();
    try {
      await friendApi.reject(userId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== userId));
    } catch {
      notifyError();
      showToast('Unable to reject request.', 'error', '!');
    }
  }, []);

  const confirmRemove = useCallback(async () => {
    if (!removePrompt) return;
    try {
      await friendApi.remove(removePrompt.id);
      setFriends((prev) => prev.filter((f) => f.id !== removePrompt.id));
      setOnlineFriends((prev) => prev.filter((f) => f.id !== removePrompt.id));
      setRemovePrompt(null);
      showToast('Friend removed from patch bay.', 'success', '!');
    } catch {
      notifyError();
      showToast('Unable to remove friend.', 'error', '!');
    }
  }, [removePrompt]);

  const listData = useMemo(() => {
    switch (tab) {
      case 'online':
        return onlineFriends;
      case 'requests':
        return pendingRequests;
      default:
        return friends;
    }
  }, [friends, onlineFriends, pendingRequests, tab]);

  const emptyMessage = useMemo(() => {
    switch (tab) {
      case 'online':
        return 'NO FRIENDS ARE PATCHED INTO LIVE ROOMS RIGHT NOW.';
      case 'requests':
        return 'NO PENDING HANDSHAKES IN THE QUEUE.';
      default:
        return 'NO SOCIAL LINKS ACTIVE YET.';
    }
  }, [tab]);

  function renderOnlineItem({ item }: { item: OnlineFriend }) {
    return (
      <Pressable
        onPress={() => onOpenRoom?.(item.sessionId)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.username}'s live room`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <AvatarTile username={item.username} avatarUrl={item.avatarUrl} accent={tacticalTokens.colors.acid} />
        <View style={styles.rowMeta}>
          <MonoText style={styles.rowTitle}>{item.username.toUpperCase()}</MonoText>
          <MonoText style={styles.rowSub}>{item.sessionName.toUpperCase()}</MonoText>
        </View>
        <View style={styles.statusRail}>
          <MonoText style={[styles.liveBadge, { color: tacticalTokens.colors.acid }]}>LIVE</MonoText>
          <Pressable
            onPress={() => onOpenRoom?.(item.sessionId)}
            accessibilityRole="button"
            accessibilityLabel={`Join ${item.sessionName}`}
            style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}
          >
            <MonoText style={[styles.inlineActionText, { color: tacticalTokens.colors.acid }]}>JOIN</MonoText>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function renderFriendItem({ item }: { item: FriendUser }) {
    return (
      <Pressable
        onPress={() => onOpenProfile(item.id)}
        onLongPress={() => {
          tapLight();
          setRemovePrompt(item);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Open ${item.username}'s profile`}
        accessibilityHint="Long press for connection actions"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <AvatarTile username={item.username} avatarUrl={item.avatarUrl} />
        <View style={styles.rowMeta}>
          <MonoText style={styles.rowTitle}>{item.username.toUpperCase()}</MonoText>
          <MonoText style={styles.rowSub}>
            {String(item.sessionsHosted ?? 0).padStart(2, '0')} HOSTED // {String(item.tracksAdded ?? 0).padStart(2, '0')} TRACKS
          </MonoText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tacticalTokens.colors.textMuted} />
      </Pressable>
    );
  }

  function renderRequestItem({ item }: { item: FriendRequest }) {
    return (
      <View style={styles.row}>
        <AvatarTile username={item.username} avatarUrl={item.avatarUrl} accent={tacticalTokens.colors.orange} />
        <Pressable
          onPress={() => onOpenProfile(item.id)}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.username}'s profile`}
          style={({ pressed }) => [styles.rowMeta, pressed && styles.pressed]}
        >
          <MonoText style={styles.rowTitle}>{item.username.toUpperCase()}</MonoText>
          <MonoText style={styles.rowSub}>REQUESTED CONNECTION</MonoText>
        </Pressable>
        <View style={styles.requestActions}>
          <Pressable
            onPress={() => void handleAccept(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Accept ${item.username}`}
            style={({ pressed }) => [styles.iconAction, styles.acceptAction, pressed && styles.pressed]}
          >
            <Ionicons name="checkmark" size={16} color={tacticalTokens.colors.acid} />
          </Pressable>
          <Pressable
            onPress={() => void handleReject(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Reject ${item.username}`}
            style={({ pressed }) => [styles.iconAction, styles.rejectAction, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={16} color={tacticalTokens.colors.orange} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.58} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              >
                <Ionicons name="chevron-back" size={20} color={tacticalTokens.colors.white} />
              </Pressable>
              <View style={styles.headerTextWrap}>
                <MonoText style={styles.eyebrow}>SYS.FREQ // PATCH BAY</MonoText>
                <MonoText style={styles.title}>FRIEND BUS</MonoText>
                <MonoText style={styles.subtitle}>Monitor live listeners, profile links, and pending handshakes.</MonoText>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <SummaryChip label="ONLINE" value={onlineFriends.length} accent={tacticalTokens.colors.acid} />
              <SummaryChip label="ALL" value={friends.length} accent={tacticalTokens.colors.ice} />
              <SummaryChip label="REQUESTS" value={pendingRequests.length} accent={tacticalTokens.colors.orange} />
            </View>

            <View style={styles.tabRow}>
              {(['online', 'all', 'requests'] as Tab[]).map((item) => {
                const active = tab === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => {
                      tapLight();
                      setTab(item);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${item} tab`}
                    style={({ pressed }) => [
                      styles.tab,
                      active && styles.tabActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MonoText style={[styles.tabText, active && styles.tabTextActive]}>
                      {item.toUpperCase()}
                    </MonoText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={tacticalTokens.colors.acid} />
            </View>
          ) : (
            <FlatList
              data={listData as any[]}
              key={tab}
              keyExtractor={(item: FriendUser) => item.id}
              renderItem={
                tab === 'online'
                  ? (renderOnlineItem as any)
                  : tab === 'requests'
                    ? (renderRequestItem as any)
                    : (renderFriendItem as any)
              }
              contentContainerStyle={styles.listContent}
              refreshControl={(
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={tacticalTokens.colors.acid}
                />
              )}
              ListHeaderComponent={inlineError ? (
                <View style={styles.errorRail}>
                  <Ionicons name="warning-outline" size={16} color={tacticalTokens.colors.orange} />
                  <MonoText style={styles.errorText}>{inlineError}</MonoText>
                </View>
              ) : null}
              ListEmptyComponent={(
                <View style={styles.emptyState}>
                  <Ionicons
                    name={tab === 'online' ? 'radio-outline' : tab === 'requests' ? 'mail-outline' : 'people-outline'}
                    size={42}
                    color={tacticalTokens.colors.textMuted}
                  />
                  <MonoText style={styles.emptyTitle}>NO ACTIVE ROUTE</MonoText>
                  <MonoText style={styles.emptyText}>{emptyMessage}</MonoText>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </VoidSurface>

      <TacticalActionPrompt
        visible={Boolean(removePrompt)}
        eyebrow="SYS.FREQ // CONNECTION CONTROL"
        title="REMOVE LINK"
        description={removePrompt ? `Drop ${removePrompt.username.toUpperCase()} from your friend bus?` : ''}
        onClose={() => setRemovePrompt(null)}
        actions={[
          {
            label: 'KEEP LINK',
            description: 'Leave this connection active in your patch bay.',
            icon: 'return-up-back-outline',
            onPress: () => setRemovePrompt(null),
          },
          {
            label: 'REMOVE FRIEND',
            description: 'Delete the friend connection from your roster.',
            icon: 'trash-outline',
            tone: 'danger',
            onPress: () => {
              void confirmRemove();
            },
          },
        ]}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tacticalTokens.spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.hero,
    color: tacticalTokens.colors.white,
  },
  subtitle: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.lg,
  },
  summaryChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  summaryValue: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
  },
  summaryLabel: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.lg,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tacticalTokens.spacing.sm,
  },
  tabActive: {
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.white,
  },
  tabText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.8,
  },
  tabTextActive: {
    color: tacticalTokens.colors.void,
  },
  listContent: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xxxl,
  },
  errorRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.92)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  avatarFrame: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  rowSub: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  statusRail: {
    alignItems: 'flex-end',
    gap: tacticalTokens.spacing.xs,
  },
  liveBadge: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.5,
  },
  inlineAction: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.acid,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: 4,
  },
  inlineActionText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.4,
  },
  requestActions: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
  },
  iconAction: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  acceptAction: {
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: '#071207',
  },
  rejectAction: {
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
  },
  separator: {
    height: tacticalTokens.spacing.sm,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(7, 7, 7, 0.84)',
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingVertical: tacticalTokens.spacing.xxxl,
    marginTop: tacticalTokens.spacing.sm,
  },
  emptyTitle: {
    marginTop: tacticalTokens.spacing.md,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  emptyText: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 22,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});

export default FriendsScreen;
