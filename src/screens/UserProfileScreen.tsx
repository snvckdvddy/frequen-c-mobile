import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, showToast } from '../components/ui';
import { VoidSurface } from '../design/components';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { TacticalActionPrompt } from '../features/session-v2/components/TacticalActionPrompt';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { friendApi, userApi, type ActivityEvent, type FriendshipStatus, type UserProfile } from '../services/api';
import { notifyError, notifySuccess, tapLight, tapMedium } from '../utils/haptics';

interface UserProfileScreenProps {
  userId: string;
  onBack: () => void;
  onOpenRoom?: (sessionId: string) => void;
}

type PromptState = null | 'remove' | 'block';

function MonoText(props: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  return <Text {...props} />;
}

function formatListeningTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  return hours < 1 ? `${Math.floor(seconds / 60)}M` : `${hours}H`;
}

function formatTimeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'NOW';
  if (minutes < 60) return `${minutes}M`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H`;
  return `${Math.floor(hours / 24)}D`;
}

function describeEvent(event: ActivityEvent) {
  switch (event.eventType) {
    case 'session_created':
      return `CREATED ROOM${event.metadata.sessionName ? ` // ${String(event.metadata.sessionName).toUpperCase()}` : ''}`;
    case 'track_added':
      return `ADDED ${event.track?.title?.toUpperCase() || 'TRACK'}${event.track?.artist ? ` // ${event.track.artist.toUpperCase()}` : ''}`;
    case 'friend_accepted':
      return `CONNECTED WITH ${event.targetUser?.username?.toUpperCase() || 'USER'}`;
    case 'duel_won':
      return 'WON CROSSFADE DUEL';
    case 'power_move':
      return `EXEC ${String(event.metadata.moveType || 'POWER MOVE').toUpperCase()}`;
    default:
      return event.eventType.replace(/_/g, ' ').toUpperCase();
  }
}

function friendLabel(status: FriendshipStatus) {
  switch (status) {
    case 'friends': return 'FRIENDS ✓';
    case 'pending_sent': return 'PENDING';
    case 'pending_received': return 'ACCEPT';
    case 'blocked': return 'BLOCKED';
    default: return 'ADD FRIEND';
  }
}

export function UserProfileScreen({ userId, onBack, onOpenRoom }: UserProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);

  const load = useCallback(async (toastOnFail = false) => {
    try {
      const [profileRes, activityRes] = await Promise.all([
        userApi.getProfile(userId),
        userApi.getActivity(userId, 10),
      ]);
      setProfile(profileRes.user);
      setActivity(activityRes.events);
      setLoadError(null);
    } catch {
      setLoadError('PROFILE BUS OFFLINE');
      if (toastOnFail) {
        notifyError();
        showToast('Unable to route profile signal.', 'error', '!');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleFriendAction = useCallback(async () => {
    if (!profile || actionLoading) return;
    setActionLoading(true);
    try {
      switch (profile.friendshipStatus) {
        case 'none':
          tapMedium();
          await friendApi.sendRequest(userId);
          setProfile({ ...profile, friendshipStatus: 'pending_sent' });
          notifySuccess();
          showToast('Connection request sent.', 'success', '!');
          break;
        case 'pending_received':
          tapMedium();
          await friendApi.accept(userId);
          setProfile({ ...profile, friendshipStatus: 'friends', friendCount: profile.friendCount + 1 });
          notifySuccess();
          showToast('Friend link accepted.', 'success', '!');
          break;
        case 'pending_sent':
          tapLight();
          showToast('Request still pending.', 'info', '!');
          break;
        case 'friends':
          tapLight();
          setPrompt('remove');
          break;
      }
    } catch {
      notifyError();
      showToast('Friend action failed.', 'error', '!');
    } finally {
      setActionLoading(false);
    }
  }, [actionLoading, profile, userId]);

  const confirmRemove = useCallback(async () => {
    if (!profile) return;
    try {
      await friendApi.remove(userId);
      setProfile({ ...profile, friendshipStatus: 'none', friendCount: Math.max(0, profile.friendCount - 1) });
      setPrompt(null);
      notifySuccess();
      showToast('Friend removed from patch bay.', 'success', '!');
    } catch {
      notifyError();
      showToast('Unable to remove friend.', 'error', '!');
    }
  }, [profile, userId]);

  const confirmBlock = useCallback(async () => {
    if (!profile) return;
    try {
      await friendApi.block(userId);
      setProfile({ ...profile, friendshipStatus: 'blocked' });
      setPrompt(null);
      notifySuccess();
      showToast('User blocked.', 'success', '!');
    } catch {
      notifyError();
      showToast('Unable to block user.', 'error', '!');
    }
  }, [profile, userId]);

  const liveRoom = useMemo(() => profile?.liveSession, [profile]);

  if (loading) {
    return (
      <SafeScreen>
        <VoidSurface style={styles.centerState}>
          <ActivityIndicator size="large" color={tacticalTokens.colors.ice} />
        </VoidSurface>
      </SafeScreen>
    );
  }

  if (!profile) {
    return (
      <SafeScreen>
        <VoidSurface style={styles.centerState}>
          <View style={styles.emptyState}>
            <MonoText style={[styles.display, styles.emptyTitle]}>NO PROFILE ROUTE</MonoText>
            <MonoText style={[styles.mono, styles.emptyCopy]}>{loadError || 'PROFILE BUS OFFLINE'}</MonoText>
            <Pressable onPress={() => { setLoading(true); void load(true); }} style={({ pressed }) => [styles.retryAction, pressed && styles.pressed]}>
              <MonoText style={[styles.monoBold, styles.retryActionText]}>RETRY</MonoText>
            </Pressable>
          </View>
        </VoidSurface>
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.58} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={tacticalTokens.colors.ice} />}
          >
            <View style={styles.header}>
              <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Ionicons name="chevron-back" size={20} color={tacticalTokens.colors.white} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <MonoText style={[styles.mono, styles.eyebrow]}>SYS.FREQ // PROFILE BUS</MonoText>
                <MonoText style={[styles.display, styles.title]}>LISTENER PROFILE</MonoText>
                <MonoText style={[styles.mono, styles.subtitle]}>Public stats, activity logs, and friend routing.</MonoText>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.identityRow}>
                <View style={styles.avatar}>
                  <MonoText style={[styles.display, styles.avatarText]}>{profile.username.slice(0, 2).toUpperCase()}</MonoText>
                </View>
                <View style={{ flex: 1 }}>
                  <MonoText style={[styles.display, styles.name]}>{profile.username.toUpperCase()}</MonoText>
                  <MonoText style={[styles.mono, styles.meta]}>MEMBER SINCE // {new Date(profile.createdAt).toLocaleDateString()}</MonoText>
                  {liveRoom ? (
                    <Pressable onPress={() => onOpenRoom?.(liveRoom.id)} style={({ pressed }) => [styles.liveBadge, pressed && styles.pressed]}>
                      <MonoText style={[styles.monoBold, styles.liveText]}>LIVE // {liveRoom.name.toUpperCase()}</MonoText>
                    </Pressable>
                  ) : null}
                </View>
              </View>

              <View style={styles.statRow}>
                {[
                  ['ROOMS', String(profile.sessionsHosted).padStart(2, '0')],
                  ['TRACKS', String(profile.tracksAdded).padStart(2, '0')],
                  ['LISTEN', formatListeningTime(profile.totalListeningTime)],
                  ['FRIENDS', String(profile.friendCount).padStart(2, '0')],
                ].map(([label, value]) => (
                  <View key={label} style={styles.statChip}>
                    <MonoText style={[styles.display, styles.statValue]}>{value}</MonoText>
                    <MonoText style={[styles.mono, styles.statLabel]}>{label}</MonoText>
                  </View>
                ))}
              </View>

              {profile.friendshipStatus !== 'blocked' ? (
                <Pressable
                  onPress={() => void handleFriendAction()}
                  disabled={actionLoading}
                  style={({ pressed }) => [styles.friendAction, actionLoading && styles.disabledAction, pressed && styles.pressed]}
                >
                  <MonoText style={[styles.monoBold, styles.friendActionText]}>{friendLabel(profile.friendshipStatus)}</MonoText>
                </Pressable>
              ) : (
                <View style={styles.blockedRail}>
                  <MonoText style={[styles.monoBold, styles.blockedText]}>BLOCKED</MonoText>
                </View>
              )}
            </View>

            <MonoText style={[styles.mono, styles.sectionLabel]}>RECENT ACTIVITY</MonoText>
            <View style={styles.panel}>
              {activity.length ? activity.map((event, index) => (
                <View key={event.id} style={index !== activity.length - 1 ? styles.activityDivider : undefined}>
                  <View style={styles.activityRow}>
                    <View style={styles.activityGlyph}>
                      <Ionicons name="radio-outline" size={14} color={tacticalTokens.colors.ice} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <MonoText style={[styles.display, styles.activityTitle]}>{describeEvent(event)}</MonoText>
                      <MonoText style={[styles.mono, styles.activityTime]}>{formatTimeAgo(event.createdAt)}</MonoText>
                    </View>
                  </View>
                </View>
              )) : (
                <View style={styles.emptyState}>
                  <Ionicons name="pulse-outline" size={38} color={tacticalTokens.colors.textMuted} />
                  <MonoText style={[styles.display, styles.emptyTitle]}>NO LOGS</MonoText>
                  <MonoText style={[styles.mono, styles.emptyCopy]}>No recent signal activity was returned for this profile.</MonoText>
                </View>
              )}
            </View>

            {profile.friendshipStatus !== 'blocked' ? (
              <Pressable onPress={() => { tapLight(); setPrompt('block'); }} style={({ pressed }) => [styles.blockAction, pressed && styles.pressed]}>
                <MonoText style={[styles.monoBold, styles.blockActionText]}>BLOCK USER</MonoText>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </VoidSurface>

      <TacticalActionPrompt
        visible={Boolean(prompt)}
        eyebrow="SYS.FREQ // CONNECTION CONTROL"
        title={prompt === 'remove' ? 'REMOVE FRIEND' : 'BLOCK USER'}
        description={
          prompt === 'remove'
            ? `Drop ${profile.username.toUpperCase()} from your friend bus?`
            : `Block ${profile.username.toUpperCase()} and suppress their profile activity?`
        }
        onClose={() => setPrompt(null)}
        actions={
          prompt === 'remove'
            ? [
                { label: 'KEEP LINK', description: 'Leave this friend connection active.', icon: 'return-up-back-outline', onPress: () => setPrompt(null) },
                { label: 'REMOVE FRIEND', description: 'Delete this friend connection from your roster.', icon: 'trash-outline', tone: 'danger', onPress: () => { void confirmRemove(); } },
              ]
            : [
                { label: 'KEEP USER', description: 'Leave this profile accessible.', icon: 'return-up-back-outline', onPress: () => setPrompt(null) },
                { label: 'BLOCK USER', description: 'Suppress this user from your friend bus.', icon: 'ban-outline', tone: 'danger', onPress: () => { void confirmBlock(); } },
              ]
        }
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  pressed: { opacity: 0.82 },
  mono: { fontFamily: tacticalTokens.fonts.mono },
  monoBold: { fontFamily: tacticalTokens.fonts.monoBold },
  display: { fontFamily: tacticalTokens.fonts.display },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  backButton: { width: 44, height: 44, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, color: tacticalTokens.colors.ice, letterSpacing: 2 },
  title: { marginTop: 2, fontSize: 32, color: tacticalTokens.colors.white },
  subtitle: { marginTop: 4, fontSize: 12, color: tacticalTokens.colors.textSoft, letterSpacing: 1, lineHeight: 20 },
  sectionLabel: { marginTop: 20, marginBottom: 8, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 2.2 },
  panel: { borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: 'rgba(8, 8, 8, 0.94)', paddingHorizontal: 12 },
  identityRow: { flexDirection: 'row', gap: 12, paddingVertical: 16 },
  avatar: { width: 72, height: 72, borderWidth: 1, borderColor: tacticalTokens.colors.ice, backgroundColor: '#071116', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, color: tacticalTokens.colors.white },
  name: { fontSize: 28, color: tacticalTokens.colors.white },
  meta: { marginTop: 4, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.3 },
  liveBadge: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: tacticalTokens.colors.acid, backgroundColor: '#071207', paddingHorizontal: 10, paddingVertical: 6 },
  liveText: { fontSize: 10, color: tacticalTokens.colors.acid, letterSpacing: 1.4 },
  statRow: { flexDirection: 'row', gap: 8, paddingBottom: 16 },
  statChip: { flex: 1, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, paddingHorizontal: 8, paddingVertical: 8 },
  statValue: { fontSize: 16, color: tacticalTokens.colors.white },
  statLabel: { marginTop: 2, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.2 },
  friendAction: { borderWidth: 1, borderColor: tacticalTokens.colors.white, backgroundColor: tacticalTokens.colors.white, alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  friendActionText: { fontSize: 12, color: tacticalTokens.colors.void, letterSpacing: 1.8 },
  blockedRail: { borderWidth: 1, borderColor: tacticalTokens.colors.orange, backgroundColor: '#1A120D', alignItems: 'center', paddingVertical: 12, marginBottom: 16 },
  blockedText: { fontSize: 12, color: tacticalTokens.colors.orange, letterSpacing: 1.8 },
  activityDivider: { borderBottomWidth: 1, borderBottomColor: tacticalTokens.colors.borderSoft },
  activityRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 12 },
  activityGlyph: { width: 32, height: 32, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 16, color: tacticalTokens.colors.white },
  activityTime: { marginTop: 2, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  emptyTitle: { marginTop: 12, fontSize: 24, color: tacticalTokens.colors.white },
  emptyCopy: { marginTop: 4, fontSize: 12, color: tacticalTokens.colors.textSoft, letterSpacing: 1, textAlign: 'center', lineHeight: 20 },
  retryAction: { marginTop: 8, borderWidth: 1, borderColor: tacticalTokens.colors.ice, backgroundColor: '#04161A', paddingHorizontal: 16, paddingVertical: 10 },
  retryActionText: { fontSize: 10, color: tacticalTokens.colors.ice, letterSpacing: 1.5 },
  blockAction: { marginTop: 16, borderWidth: 1, borderColor: tacticalTokens.colors.orange, backgroundColor: '#1A120D', alignItems: 'center', paddingVertical: 12 },
  blockActionText: { fontSize: 12, color: tacticalTokens.colors.orange, letterSpacing: 1.8 },
  disabledAction: { opacity: 0.62 },
});

export default UserProfileScreen;
