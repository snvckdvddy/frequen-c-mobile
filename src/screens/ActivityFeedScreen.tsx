import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeScreen } from '../components/ui';
import { VoidSurface } from '../design/components';
import { activityApi, type ActivityEvent } from '../services/api';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { tapLight } from '../utils/haptics';

interface ActivityFeedScreenProps {
  onBack: () => void;
  onOpenRoom?: (sessionId: string) => void;
  onOpenProfile?: (userId: string) => void;
}

const EVENT_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  track_played: { icon: 'musical-notes-outline', color: tacticalTokens.colors.ice, label: 'TRACK PLAYED' },
  room_joined: { icon: 'radio-outline', color: tacticalTokens.colors.acid, label: 'ROOM JOINED' },
  room_created: { icon: 'add-circle-outline', color: tacticalTokens.colors.orange, label: 'ROOM CREATED' },
  reaction: { icon: 'heart-outline', color: tacticalTokens.colors.hotPink, label: 'REACTION' },
  duel_won: { icon: 'trophy-outline', color: tacticalTokens.colors.orange, label: 'DUEL WON' },
  cv_earned: { icon: 'flash-outline', color: tacticalTokens.colors.acid, label: 'CV EARNED' },
  friend_added: { icon: 'people-outline', color: tacticalTokens.colors.ice, label: 'FRIEND LINK' },
  forecast_correct: { icon: 'analytics-outline', color: tacticalTokens.colors.orange, label: 'FORECAST' },
};

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

function formatEventText(event: ActivityEvent): string {
  switch (event.eventType) {
    case 'track_played':
      return `played ${event.track?.title ? `"${event.track.title}"` : 'a track'}${event.track?.artist ? ` by ${event.track.artist}` : ''}`;
    case 'room_joined':
      return 'joined a listening room';
    case 'room_created':
      return 'started a new session';
    case 'reaction':
      return `reacted to ${event.track?.title ? `"${event.track.title}"` : 'a track'}`;
    case 'duel_won':
      return 'won a crossfader duel';
    case 'cv_earned':
      return 'earned CV';
    case 'friend_added':
      return 'made a new connection';
    case 'forecast_correct':
      return 'nailed a frequency forecast';
    default:
      return event.eventType.replace(/_/g, ' ');
  }
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}D AGO`;
  return `${Math.floor(days / 7)}W AGO`;
}

function ActorTile({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      <View style={styles.actorFrame}>
        <Image source={{ uri: avatarUrl }} style={styles.actorImage} />
      </View>
    );
  }

  return (
    <View style={styles.actorFrame}>
      <MonoText style={styles.actorFallback}>{username.slice(0, 2).toUpperCase()}</MonoText>
    </View>
  );
}

export function ActivityFeedScreen({ onBack, onOpenRoom, onOpenProfile }: ActivityFeedScreenProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const cursorRef = useRef<string | undefined>(undefined);
  const hasMoreRef = useRef(true);

  const fetchFeed = useCallback(async (before?: string) => {
    try {
      const res = await activityApi.feed(30, before);
      const nextItems = res.events ?? [];
      if (before) {
        setEvents((prev) => [...prev, ...nextItems]);
      } else {
        setEvents(nextItems);
      }
      hasMoreRef.current = res.hasMore ?? nextItems.length >= 30;
      cursorRef.current = nextItems.length > 0 ? nextItems[nextItems.length - 1].createdAt : before;
      setInlineError(null);
    } catch (err: any) {
      if (!before) {
        setInlineError((err?.message || 'SIGNAL MONITOR OFFLINE').toUpperCase());
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    hasMoreRef.current = true;
    cursorRef.current = undefined;
    void fetchFeed();
  }, [fetchFeed]);

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMoreRef.current || loading) return;
    setLoadingMore(true);
    void fetchFeed(cursorRef.current);
  }, [fetchFeed, loading, loadingMore]);

  const handleEventPress = useCallback((event: ActivityEvent) => {
    tapLight();
    if (event.sessionId && onOpenRoom) {
      onOpenRoom(event.sessionId);
      return;
    }
    if (event.actor?.id && onOpenProfile) {
      onOpenProfile(event.actor.id);
    }
  }, [onOpenProfile, onOpenRoom]);

  const stats = useMemo(() => {
    const roomEvents = events.filter((event) => event.sessionId).length;
    const profileEvents = events.filter((event) => !event.sessionId && event.actor?.id).length;
    return {
      total: events.length,
      rooms: roomEvents,
      people: profileEvents,
    };
  }, [events]);

  function renderEvent({ item }: { item: ActivityEvent }) {
    const meta = EVENT_META[item.eventType] ?? {
      icon: 'ellipse-outline',
      color: tacticalTokens.colors.textMuted,
      label: item.eventType.replace(/_/g, ' ').toUpperCase(),
    };

    return (
      <Pressable
        onPress={() => handleEventPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${item.actor.username} ${formatEventText(item)}`}
        style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
      >
        <View style={styles.eventLeft}>
          <View style={[styles.eventIconFrame, { borderColor: meta.color }]}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
          </View>
          <View style={styles.eventRail} />
        </View>

        <View style={styles.eventBody}>
          <View style={styles.eventTop}>
            <ActorTile username={item.actor.username} avatarUrl={item.actor.avatarUrl} />
            <View style={styles.eventCopy}>
              <MonoText style={styles.eventLabel}>{meta.label}</MonoText>
              <Text style={styles.eventText}>
                <Text style={styles.eventActor}>{item.actor.username}</Text>
                {' '}{formatEventText(item)}
              </Text>
            </View>
            <MonoText style={styles.eventTime}>{formatTimeAgo(item.createdAt)}</MonoText>
          </View>

          {item.track ? (
            <View style={styles.eventMetaRow}>
              <MonoText style={styles.eventMetaText}>
                TRACK // {item.track.title.toUpperCase()} {item.track.artist ? `// ${item.track.artist.toUpperCase()}` : ''}
              </MonoText>
            </View>
          ) : null}

          {item.sessionId ? (
            <View style={styles.eventMetaRow}>
              <MonoText style={styles.eventMetaText}>ROOM ROUTE ACTIVE</MonoText>
            </View>
          ) : null}
        </View>
      </Pressable>
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
                <MonoText style={styles.eyebrow}>SYS.FREQ // SIGNAL MONITOR</MonoText>
                <MonoText style={styles.title}>ACTIVITY BUS</MonoText>
                <MonoText style={styles.subtitle}>Live relay of rooms joined, tracks played, reactions, and friend movement.</MonoText>
              </View>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryChip}>
                <MonoText style={[styles.summaryValue, { color: tacticalTokens.colors.ice }]}>
                  {String(stats.total).padStart(2, '0')}
                </MonoText>
                <MonoText style={styles.summaryLabel}>SIGNALS</MonoText>
              </View>
              <View style={styles.summaryChip}>
                <MonoText style={[styles.summaryValue, { color: tacticalTokens.colors.acid }]}>
                  {String(stats.rooms).padStart(2, '0')}
                </MonoText>
                <MonoText style={styles.summaryLabel}>ROOMS</MonoText>
              </View>
              <View style={styles.summaryChip}>
                <MonoText style={[styles.summaryValue, { color: tacticalTokens.colors.orange }]}>
                  {String(stats.people).padStart(2, '0')}
                </MonoText>
                <MonoText style={styles.summaryLabel}>PEOPLE</MonoText>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={tacticalTokens.colors.ice} />
            </View>
          ) : inlineError ? (
            <View style={styles.centerState}>
              <Ionicons name="warning-outline" size={42} color={tacticalTokens.colors.orange} />
              <MonoText style={styles.emptyTitle}>CONNECTION LOST</MonoText>
              <MonoText style={styles.emptyText}>{inlineError}</MonoText>
              <Pressable
                onPress={() => {
                  tapLight();
                  setLoading(true);
                  void fetchFeed();
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry activity feed"
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
              >
                <MonoText style={styles.retryText}>RETRY</MonoText>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={events}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              renderItem={renderEvent}
              contentContainerStyle={styles.listContent}
              refreshControl={(
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={tacticalTokens.colors.ice}
                />
              )}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.35}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={(
                <View style={styles.emptyState}>
                  <Ionicons name="pulse-outline" size={42} color={tacticalTokens.colors.textMuted} />
                  <MonoText style={styles.emptyTitle}>NO SIGNALS YET</MonoText>
                  <MonoText style={styles.emptyText}>
                    Friend activity will patch into this relay as rooms go live and tracks start moving.
                  </MonoText>
                </View>
              )}
              ListFooterComponent={loadingMore ? (
                <View style={styles.footer}>
                  <ActivityIndicator size="small" color={tacticalTokens.colors.textMuted} />
                </View>
              ) : null}
            />
          )}
        </View>
      </VoidSurface>
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
    color: tacticalTokens.colors.orange,
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
  listContent: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xxxl,
  },
  eventRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(9, 9, 9, 0.92)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  eventLeft: {
    alignItems: 'center',
  },
  eventIconFrame: {
    width: 38,
    height: 38,
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventRail: {
    width: 1,
    flex: 1,
    backgroundColor: tacticalTokens.colors.borderGhost,
    marginTop: tacticalTokens.spacing.xs,
  },
  eventBody: {
    flex: 1,
    minWidth: 0,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tacticalTokens.spacing.sm,
  },
  actorFrame: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actorImage: {
    width: '100%',
    height: '100%',
  },
  actorFallback: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
  },
  eventCopy: {
    flex: 1,
    minWidth: 0,
  },
  eventLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.4,
  },
  eventText: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.textSoft,
    lineHeight: 20,
  },
  eventActor: {
    fontFamily: tacticalTokens.fonts.display,
    color: tacticalTokens.colors.white,
  },
  eventTime: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  eventMetaRow: {
    marginTop: tacticalTokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderGhost,
    paddingTop: tacticalTokens.spacing.sm,
  },
  eventMetaText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  separator: {
    height: tacticalTokens.spacing.sm,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.xl,
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
  retryButton: {
    marginTop: tacticalTokens.spacing.lg,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  retryText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.6,
  },
  footer: {
    paddingVertical: tacticalTokens.spacing.lg,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.82,
  },
});

export default ActivityFeedScreen;
