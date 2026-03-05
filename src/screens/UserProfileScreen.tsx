/**
 * UserProfileScreen — View another user's profile.
 *
 * Shows:
 *   - Avatar, username, member since
 *   - Stats: sessions hosted, tracks added, listening time, friends
 *   - Friendship action button (Add / Pending / Friends / Blocked)
 *   - Currently listening badge (if in a live session)
 *   - Recent activity feed
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { userApi, friendApi, UserProfile, ActivityEvent, FriendshipStatus } from '../services/api';
import { VoidSurface, ModuleFaceplate } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';

interface UserProfileScreenProps {
  userId: string;
  onBack: () => void;
  onOpenRoom?: (sessionId: string) => void;
}

export function UserProfileScreen({ userId, onBack, onOpenRoom }: UserProfileScreenProps) {
  const { user: currentUser } = useAuth();
  const { accent, isVoltageSag } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const [profileRes, activityRes] = await Promise.all([
        userApi.getProfile(userId),
        userApi.getActivity(userId, 10),
      ]);
      setProfile(profileRes.user);
      setActivity(activityRes.events);
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  // ─── Friendship Actions ─────────────────────────────────────

  const handleFriendAction = useCallback(async () => {
    if (!profile || actionLoading) return;
    setActionLoading(true);

    try {
      switch (profile.friendshipStatus) {
        case 'none':
          await friendApi.sendRequest(userId);
          setProfile({ ...profile, friendshipStatus: 'pending_sent' });
          break;
        case 'pending_received':
          await friendApi.accept(userId);
          setProfile({ ...profile, friendshipStatus: 'friends', friendCount: profile.friendCount + 1 });
          break;
        case 'pending_sent':
          // Cancel not supported — show info
          Alert.alert('Request Pending', 'Your friend request is still pending.');
          break;
        case 'friends':
          Alert.alert(
            'Remove Friend',
            `Remove ${profile.username} from your friends?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove', style: 'destructive',
                onPress: async () => {
                  await friendApi.remove(userId);
                  setProfile({ ...profile, friendshipStatus: 'none', friendCount: profile.friendCount - 1 });
                },
              },
            ],
          );
          break;
      }
    } catch (err) {
      console.error('Friend action failed:', err);
    } finally {
      setActionLoading(false);
    }
  }, [profile, userId, actionLoading]);

  // ─── Helpers ────────────────────────────────────────────────

  const formatListeningTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    if (hours < 1) return `${Math.floor(seconds / 60)}m`;
    return `${hours}h`;
  };

  const friendButtonLabel = (status: FriendshipStatus): string => {
    switch (status) {
      case 'none': return 'ADD FRIEND';
      case 'pending_sent': return 'PENDING';
      case 'pending_received': return 'ACCEPT';
      case 'friends': return 'FRIENDS ✓';
      case 'blocked': return 'BLOCKED';
      default: return 'ADD FRIEND';
    }
  };

  const friendButtonColor = (status: FriendshipStatus): string => {
    switch (status) {
      case 'friends': return palette.green;
      case 'pending_sent': return palette.slate;
      case 'pending_received': return accent;
      case 'blocked': return palette.red;
      default: return accent;
    }
  };

  // ─── Event description ─────────────────────────────────────

  const describeEvent = (event: ActivityEvent): string => {
    switch (event.eventType) {
      case 'session_created': return `Created a room${event.metadata.sessionName ? `: ${event.metadata.sessionName}` : ''}`;
      case 'track_added': return `Added ${event.track?.title || 'a track'}${event.track?.artist ? ` by ${event.track.artist}` : ''}`;
      case 'friend_accepted': return `Connected with ${event.targetUser?.username || 'someone'}`;
      case 'duel_won': return 'Won a Crossfader Duel';
      case 'power_move': return `Used ${event.metadata.moveType || 'a power move'}`;
      default: return event.eventType.replace(/_/g, ' ');
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  if (loading || !profile) {
    return (
      <SafeScreen>
        <VoidSurface style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={palette.slate}>Loading profile...</Text>
        </VoidSurface>
      </SafeScreen>
    );
  }

  const isOwnProfile = currentUser?.id === userId;

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        {/* ─── Header ────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={palette.silver} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PROFILE</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={accent} />}
        >
          {/* ─── Avatar + Name ───────────────────────── */}
          <View style={styles.avatarSection}>
            <View style={[styles.avatar, { borderColor: accent }]}>
              <Ionicons name="person" size={40} color={palette.silver} />
            </View>
            <Text style={styles.username}>{profile.username}</Text>
            <Text style={styles.memberSince}>
              Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>

            {/* Live session badge */}
            {profile.liveSession && (
              <TouchableOpacity
                style={styles.liveBadge}
                onPress={() => onOpenRoom?.(profile.liveSession!.id)}
                activeOpacity={0.7}
              >
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE IN: {profile.liveSession.name}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ─── Friend Action ───────────────────────── */}
          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.friendBtn, { borderColor: friendButtonColor(profile.friendshipStatus) }]}
              onPress={handleFriendAction}
              disabled={actionLoading || profile.friendshipStatus === 'blocked'}
              activeOpacity={0.6}
            >
              <Ionicons
                name={profile.friendshipStatus === 'friends' ? 'checkmark-circle' : 'person-add'}
                size={16}
                color={friendButtonColor(profile.friendshipStatus)}
              />
              <Text style={[styles.friendBtnText, { color: friendButtonColor(profile.friendshipStatus) }]}>
                {friendButtonLabel(profile.friendshipStatus)}
              </Text>
            </TouchableOpacity>
          )}

          {/* ─── Stats Grid ──────────────────────────── */}
          <ModuleFaceplate label="SIGNAL STATS" screws>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: accent }]}>{profile.sessionsHosted}</Text>
                <Text style={styles.statLabel}>ROOMS</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: accent }]}>{profile.tracksAdded}</Text>
                <Text style={styles.statLabel}>TRACKS</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: accent }]}>{formatListeningTime(profile.totalListeningTime)}</Text>
                <Text style={styles.statLabel}>LISTENING</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: accent }]}>{profile.friendCount}</Text>
                <Text style={styles.statLabel}>FRIENDS</Text>
              </View>
            </View>
          </ModuleFaceplate>

          {/* ─── Recent Activity ─────────────────────── */}
          {activity.length > 0 && (
            <ModuleFaceplate label="RECENT ACTIVITY">
              {activity.map((event) => (
                <View key={event.id} style={styles.activityRow}>
                  <Ionicons name="radio-outline" size={14} color={palette.slate} />
                  <Text style={styles.activityText}>{describeEvent(event)}</Text>
                  <Text style={styles.activityTime}>
                    {formatTimeAgo(event.createdAt)}
                  </Text>
                </View>
              ))}
            </ModuleFaceplate>
          )}

          {/* ─── Block Action (for non-friends) ──────── */}
          {!isOwnProfile && profile.friendshipStatus !== 'blocked' && (
            <TouchableOpacity
              style={styles.blockBtn}
              onPress={() => {
                Alert.alert(
                  'Block User',
                  `Block ${profile.username}? They won't be able to see your activity or send you requests.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Block', style: 'destructive',
                      onPress: async () => {
                        await friendApi.block(userId);
                        setProfile({ ...profile, friendshipStatus: 'blocked' });
                      },
                    },
                  ],
                );
              }}
            >
              <Ionicons name="ban" size={14} color={palette.red} />
              <Text style={styles.blockText}>Block User</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </VoidSurface>
    </SafeScreen>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: 40,
    gap: 20,
  },
  // Avatar section
  avatarSection: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    backgroundColor: colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.displayBold,
    color: palette.frost,
    letterSpacing: ls.normal,
  },
  memberSince: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: palette.green,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.green,
  },
  liveText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.green,
    letterSpacing: ls.wide,
  },
  // Friend button
  friendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  friendBtnText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    letterSpacing: ls.wide,
    fontWeight: '600',
  },
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.displayBold,
  },
  statLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  activityText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: palette.silver,
  },
  activityTime: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
  },
  // Block
  blockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 20,
  },
  blockText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.red,
    letterSpacing: ls.wide,
  },
});

export default UserProfileScreen;
