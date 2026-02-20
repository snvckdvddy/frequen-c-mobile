/**
 * Home Screen
 *
 * The landing pad after auth. Shows:
 * - Quick-join / create buttons
 * - Active sessions you're in ("Your Rooms")
 *
 * Clean, restrained. No emoji, no colored mode bars.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, SafeScreen, FadeIn } from '../components/ui';
import { AnimatedPressable } from '../components/ui/AnimatedPressable';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Session } from '../types';

// ─── Mode label (text only) ────────────────────────────────

const modeLabel: Record<string, string> = {
  campfire: 'Campfire',
  spotlight: 'Spotlight',
  openFloor: 'Open Floor',
};

// ─── Component ──────────────────────────────────────────────

interface HomeScreenProps {
  onCreateSession: () => void;
  onJoinSession: () => void;
  onOpenRoom: (sessionId: string) => void;
}

export function HomeScreen({ onCreateSession, onJoinSession, onOpenRoom }: HomeScreenProps) {
  const { user, logout } = useAuth();
  const [myRooms, setMyRooms] = useState<Session[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyRooms = useCallback(async () => {
    try {
      const { sessions } = await sessionApi.myRooms();
      setMyRooms(sessions);
    } catch {
      // Silently fail — empty state is fine
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
        {/* Greeting */}
        <FadeIn delay={0} duration={350}>
          <View style={styles.header}>
            <Text variant="h1" color={colors.text.primary} style={styles.greeting}>
              Hey, {user?.username || 'listener'}.
            </Text>
            <Text variant="body" color={colors.text.secondary}>
              Ready to tune in?
            </Text>
          </View>
        </FadeIn>

        {/* Quick Actions */}
        <FadeIn delay={80} duration={350}>
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
        </FadeIn>

        {/* Your Rooms */}
        <FadeIn delay={160} duration={350}>
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
              myRooms.map((room) => (
                <AnimatedPressable
                  key={room.id}
                  style={styles.roomCard}
                  onPress={() => onOpenRoom(room.id)}
                  scaleDown={0.98}
                >
                <View style={styles.roomInfo}>
                  <View style={styles.roomHeader}>
                    <Text variant="labelLarge" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
                      {room.name}
                    </Text>
                    {room.isLive && (
                      <View style={styles.liveDot} />
                    )}
                  </View>
                  <Text variant="bodySmall" color={colors.text.muted}>
                    {modeLabel[room.roomMode] || 'Campfire'}
                    {' · '}
                    {room.genre || 'Mixed'}
                    {' · '}
                    Code: {room.joinCode}
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary} style={styles.roomMeta}>
                    {(room.listeners?.length || 0)} listener{(room.listeners?.length || 0) !== 1 ? 's' : ''}
                    {(room.queue?.length || 0) > 0 ? ` · ${room.queue.length} in queue` : ''}
                  </Text>
                </View>
              </AnimatedPressable>
            ))
          )}
          </View>
        </FadeIn>

        {/* Dev: logout button */}
        <Button
          title="Sign Out"
          onPress={logout}
          variant="ghost"
          size="sm"
          style={styles.logoutBtn}
        />
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
  header: {
    marginBottom: spacing.xl,
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
  roomCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  roomInfo: {
    padding: spacing.cardPadding,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.action.primary,
  },
  roomMeta: {
    marginTop: 2,
  },
  logoutBtn: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
});

export default HomeScreen;
