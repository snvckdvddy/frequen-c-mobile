/**
 * Activity Feed Screen — "SIGNAL MONITOR"
 *
 * Shows friends' recent activity: tracks played, rooms joined,
 * reactions, CV earned, duel results, etc.
 * Cursor-paginated via activityApi.feed().
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen } from '../components/ui';
import { activityApi, type ActivityEvent } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { VoidSurface } from '../design/components';
import { palette } from '../design/tokens/materials';
import { fontFamily, letterSpacing as ls } from '../design/tokens/typography';
import { spacing } from '../theme/spacing';

interface ActivityFeedScreenProps {
  onBack: () => void;
  onOpenRoom?: (sessionId: string) => void;
  onOpenProfile?: (userId: string) => void;
}

// Event type → icon + color
const EVENT_META: Record<string, { icon: string; color: string }> = {
  track_played: { icon: 'musical-notes', color: palette.ice },
  room_joined: { icon: 'radio-outline', color: palette.green },
  room_created: { icon: 'add-circle-outline', color: palette.orange },
  reaction: { icon: 'heart', color: palette.red },
  duel_won: { icon: 'trophy-outline', color: palette.amber },
  cv_earned: { icon: 'flash', color: palette.green },
  friend_added: { icon: 'people-outline', color: palette.ice },
  forecast_correct: { icon: 'analytics-outline', color: palette.orange },
};

const DEFAULT_META = { icon: 'ellipse-outline', color: palette.slate };

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
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

// Extracted separator to avoid inline re-creation
const EventSeparator = () => <View style={styles.separator} />;

export function ActivityFeedScreen({ onBack, onOpenRoom, onOpenProfile }: ActivityFeedScreenProps) {
  const { accent } = useTheme();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | undefined>(undefined);
  const hasMoreRef = useRef(true);

  const fetchFeed = useCallback(async (before?: string) => {
    try {
      const res = await activityApi.feed(30, before);
      const items = res.events ?? [];
      if (before) {
        setEvents((prev) => [...prev, ...items]);
      } else {
        setEvents(items);
      }
      hasMoreRef.current = res.hasMore ?? items.length >= 30;
      if (items.length > 0) {
        cursorRef.current = items[items.length - 1].createdAt;
      }
      setError(null);
    } catch (err) {
      if (!before) setError(err instanceof Error ? err.message : 'Failed to load activity');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    hasMoreRef.current = true;
    cursorRef.current = undefined;
    await fetchFeed();
    setRefreshing(false);
  }, [fetchFeed]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !hasMoreRef.current) return;
    setLoadingMore(true);
    await fetchFeed(cursorRef.current);
    setLoadingMore(false);
  }, [loadingMore, fetchFeed]);

  const handleEventPress = useCallback((event: ActivityEvent) => {
    if (event.sessionId && onOpenRoom) {
      onOpenRoom(event.sessionId);
    } else if (event.actor?.id && onOpenProfile) {
      onOpenProfile(event.actor.id);
    }
  }, [onOpenRoom, onOpenProfile]);

  const renderEvent = ({ item }: { item: ActivityEvent }) => {
    const meta = EVENT_META[item.eventType] || DEFAULT_META;
    return (
      <TouchableOpacity
        style={styles.eventItem}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${item.actor.username} ${formatEventText(item)}`}
      >
        <View style={[styles.eventIcon, { borderColor: meta.color }]}>
          <Ionicons name={meta.icon as any} size={16} color={meta.color} />
        </View>
        <View style={styles.eventContent}>
          <Text style={styles.eventText}>
            <Text style={styles.eventUsername}>{item.actor.username}</Text>
            {' '}{formatEventText(item)}
          </Text>
          <Text style={styles.eventTime}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={palette.frost} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>SIGNAL MONITOR</Text>
          <View style={{ width: 32 }} />
        </View>

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
        ) : events.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="pulse-outline" size={48} color={palette.steel} />
            <Text style={styles.emptyText}>No signals yet.</Text>
            <Text style={styles.emptySubtext}>
              Activity from your friends will appear here as they listen, create rooms, and react.
            </Text>
          </View>
        ) : (
          <FlatList
            data={events}
            keyExtractor={(item, idx) => `${item.id ?? idx}`}
            renderItem={renderEvent}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.3}
            ItemSeparatorComponent={EventSeparator}
            initialNumToRender={15}
            windowSize={5}
            removeClippedSubviews
            ListFooterComponent={loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={palette.slate} />
              </View>
            ) : null}
          />
        )}
      </VoidSurface>
    </SafeScreen>
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
  backBtn: {
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
  listContent: {
    paddingVertical: spacing.sm,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 14,
  },
  eventIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  eventContent: {
    flex: 1,
  },
  eventText: {
    fontFamily: fontFamily.body,
    fontSize: 13,
    color: palette.silver,
    lineHeight: 19,
  },
  eventUsername: {
    fontFamily: fontFamily.displayBold,
    color: palette.frost,
  },
  eventTime: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.normal,
    marginTop: 3,
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
  footer: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});

export default ActivityFeedScreen;
