/**
 * Home Screen
 *
 * Sprint 2: Wired to convergence strategy components.
 * Uses RoomCard (§4.2) for "Your Rooms" active sessions.
 * Clean, restrained. No emoji, no colored mode bars.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, ADSRFadeIn, RoomCard, ErrorState } from '../components/ui';
import { AnimatedPressable } from '../components/ui/AnimatedPressable';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Session, RoomMode } from '../types';

// ─── Component ──────────────────────────────────────────────

interface HomeScreenProps {
  onCreateSession: () => void;
  onJoinSession: () => void;
  onOpenRoom: (sessionId: string) => void;
  onOpenProfile?: () => void;
  onOpenDesignTest?: () => void; // DEV — remove before release
}

export function HomeScreen({ onCreateSession, onJoinSession, onOpenRoom, onOpenProfile, onOpenDesignTest }: HomeScreenProps) {
  const { user } = useAuth();
  const [myRooms, setMyRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMyRooms = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      setMyRooms(sessions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rooms');
    }
  }, []);

  useEffect(() => {
    fetchMyRooms();
    const interval = setInterval(fetchMyRooms, 15000);
    return () => clearInterval(interval);
  }, [fetchMyRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMyRooms();
    setRefreshing(false);
  }, [fetchMyRooms]);

  return (
    <SafeScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.action.primary}
          />
        }
      >
        {/* Error State — display if fetch fails */}
        {error && (
          <View style={styles.errorContainer}>
            <ErrorState message={error} onRetry={fetchMyRooms} />
          </View>
        )}

        {/* Greeting + Profile access */}
        <ADSRFadeIn index={0}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text variant="h1" color={colors.text.primary} style={styles.greeting}>
                  Hey, {user?.username || 'listener'}.
                </Text>
                <Text variant="body" color={colors.text.secondary}>
                  Ready to tune in?
                </Text>
              </View>
              {/* DEV: Design System test button — remove before release */}
              {onOpenDesignTest && (
                <TouchableOpacity
                  style={[styles.profileBtn, { marginRight: 8 }]}
                  onPress={onOpenDesignTest}
                  activeOpacity={0.7}
                >
                  <Ionicons name="color-palette-outline" size={24} color={colors.action.primary} />
                </TouchableOpacity>
              )}
              {onOpenProfile && (
                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={onOpenProfile}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-circle-outline" size={32} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ADSRFadeIn>

        {/* Quick Actions */}
        <ADSRFadeIn index={1}>
          <View style={styles.actions}>
            <AnimatedPressable style={styles.actionCard} onPress={onCreateSession} scaleDown={0.96}>
              <Ionicons name="add" size={22} color={colors.action.primary} style={styles.actionIcon} />
              <Text variant="labelLarge" color={colors.text.primary}>
                Create a Room
              </Text>
              <Text variant="bodySmall" color={colors.text.muted}>
                Start a new listening session
              </Text>
            </AnimatedPressable>

            <AnimatedPressable style={styles.actionCard} onPress={onJoinSession} scaleDown={0.96}>
              <Ionicons name="arrow-forward" size={22} color={colors.action.primary} style={styles.actionIcon} />
              <Text variant="labelLarge" color={colors.text.primary}>
                Join a Room
              </Text>
              <Text variant="bodySmall" color={colors.text.muted}>
                Enter with a code or link
              </Text>
            </AnimatedPressable>
          </View>
        </ADSRFadeIn>

        {/* Your Rooms — now using convergence RoomCard */}
        <ADSRFadeIn index={2}>
          <View style={styles.section}>
            <Text variant="h3" color={colors.text.primary} style={styles.sectionTitle}>
              Your Rooms
            </Text>

            {myRooms.length === 0 ? (
              <View style={styles.emptyState}>
                <Text variant="body" color={colors.text.muted} align="center">
                  No active rooms yet.{'\n'}Create one or join a friend's session.
                </Text>
              </View>
            ) : (
              <View style={styles.roomList}>
                {myRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    roomName={room.name}
                    hostUsername={room.hostUsername}
                    roomMode={(room.roomMode || 'campfire') as RoomMode}
                    isLive={room.isLive ?? true}
                    listenerCount={room.listeners?.length || 0}
                    genre={room.genre}
                    currentTrack={
                      room.currentTrack
                        ? {
                            title: room.currentTrack.title,
                            artist: room.currentTrack.artist,
                            albumArt: room.currentTrack.albumArt,
                          }
                        : undefined
                    }
                    onJoin={() => onOpenRoom(room.id)}
                    onPress={() => onOpenRoom(room.id)}
                  />
                ))}
              </View>
            )}
          </View>
        </ADSRFadeIn>

        {/* Spacer — Sign Out moved to Profile */}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    marginBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['3xl'],
    paddingBottom: 120, // clear mini-player + tab bar
  },
  header: {
    marginBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  profileBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  greeting: {
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    padding: spacing.cardPadding,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  actionIcon: {
    marginBottom: spacing.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  emptyState: {
    backgroundColor: colors.bg.surface,
    borderRadius: spacing.radius.md,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  roomList: {
    gap: spacing.md,
  },
  // logoutBtn moved to Profile screen
});

export default HomeScreen;
