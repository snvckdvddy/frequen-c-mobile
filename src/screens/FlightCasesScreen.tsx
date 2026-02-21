/**
 * Flight Cases Screen — Modular Synthesis Library
 *
 * Replaces flat Library with collapsible "cases":
 *   Liked Tracks — heart icon, favorited tracks
 *   Session History — clock icon, past sessions
 *   Collections — user-created groups (future)
 *   Master Bounces — session receipts (future)
 *
 * Each case has a brushed-metal header with latch visual.
 */

import React, { useState, useCallback } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, ADSRFadeIn, TrackListItem } from '../components/ui';
import { WaveformIcon } from '../components/ui/WaveformIcon';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Track, FavoriteTrack, RoomMode } from '../types';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Props ──────────────────────────────────────────────────

interface FlightCasesScreenProps {
  onOpenRoom?: (sessionId: string) => void;
}

// ─── Flight Case Container ──────────────────────────────────

interface FlightCaseProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function FlightCase({ title, icon, count, children, defaultOpen = false }: FlightCaseProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsOpen((prev) => !prev);
  };

  return (
    <View style={caseStyles.container}>
      {/* Chrome header with latches */}
      <TouchableOpacity
        style={caseStyles.header}
        onPress={toggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${count} items${isOpen ? ', expanded' : ', collapsed'}`}
        accessibilityState={{ expanded: isOpen }}
      >
        {/* Left latch */}
        <View style={caseStyles.latch} />

        <View style={caseStyles.headerContent}>
          {icon}
          <Text variant="labelLarge" color={colors.text.primary} style={caseStyles.title}>
            {title}
          </Text>
          <View style={caseStyles.countBadge}>
            <Text variant="labelSmall" color={colors.chrome.text} style={{ fontSize: 10 }}>
              {count}
            </Text>
          </View>
        </View>

        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.text.muted}
        />

        {/* Right latch */}
        <View style={caseStyles.latch} />
      </TouchableOpacity>

      {/* Case contents — Melody Channel styling */}
      {isOpen && (
        <View style={caseStyles.body}>
          {children}
        </View>
      )}
    </View>
  );
}

const caseStyles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    paddingVertical: 14,
    paddingHorizontal: 16,
    // Brushed metal effect via subtle gradient
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 13,
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.chrome.surface,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
  latch: {
    width: 3,
    height: 12,
    borderRadius: 1.5,
    backgroundColor: colors.chrome.border,
    marginHorizontal: 4,
  },
  body: {
    backgroundColor: colors.bg.surface,
    padding: 12,
  },
});

// ─── Mock Session History (until backend supports it) ───────

const mockHistory = [
  { id: 'hist_1', name: 'Friday Night Vibes', roomMode: 'campfire' as RoomMode, date: '2 hours ago', trackCount: 12, duration: '45 min' },
  { id: 'hist_2', name: 'Studio Session', roomMode: 'spotlight' as RoomMode, date: 'Yesterday', trackCount: 8, duration: '30 min' },
  { id: 'hist_3', name: 'Open Aux', roomMode: 'openFloor' as RoomMode, date: '3 days ago', trackCount: 24, duration: '1.5 hrs' },
];

// ─── Main Screen ────────────────────────────────────────────

export function FlightCasesScreen({ onOpenRoom }: FlightCasesScreenProps) {
  const { favorites, toggleFavorite } = useFavoritesContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Future: re-fetch from server
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // FavoriteTrack wraps Track in .track property
  const favTracks: Track[] = favorites.map((f: FavoriteTrack) => f.track);

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
        {/* Header */}
        <ADSRFadeIn index={0}>
          <View style={styles.header}>
            <Text variant="h2" color={colors.text.primary}>
              Flight Cases
            </Text>
            <Text variant="bodySmall" color={colors.text.secondary}>
              Your gear, organized
            </Text>
          </View>
        </ADSRFadeIn>

        {/* Case: Liked Tracks */}
        <ADSRFadeIn index={1}>
          <FlightCase
            title="Liked Tracks"
            icon={<Ionicons name="heart" size={16} color={colors.action.primary} />}
            count={favTracks.length}
            defaultOpen={true}
          >
            {favTracks.length === 0 ? (
              <View style={styles.emptyCase}>
                <Ionicons name="heart-outline" size={28} color={colors.text.muted} />
                <Text variant="bodySmall" color={colors.text.muted} align="center">
                  No liked tracks yet. Heart tracks in a session to save them here.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 4 }}>
                {favTracks.map((track) => (
                  <TrackListItem
                    key={track.id}
                    title={track.title}
                    artist={track.artist}
                    albumArt={track.albumArt}
                    duration={track.duration}
                    onPress={() => {}}
                  />
                ))}
              </View>
            )}
          </FlightCase>
        </ADSRFadeIn>

        {/* Case: Session History */}
        <ADSRFadeIn index={2}>
          <FlightCase
            title="Session History"
            icon={<Ionicons name="time-outline" size={16} color={colors.chrome.text} />}
            count={mockHistory.length}
          >
            <View style={{ gap: 8 }}>
              {mockHistory.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.historyCard}
                  onPress={() => onOpenRoom?.(session.id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${session.name}, ${session.trackCount} tracks, ${session.duration}, ${session.date}`}
                >
                  <WaveformIcon mode={session.roomMode} size={16} />
                  <View style={{ flex: 1 }}>
                    <Text variant="label" color={colors.text.primary}>
                      {session.name}
                    </Text>
                    <Text variant="labelSmall" color={colors.text.muted}>
                      {session.trackCount} tracks / {session.duration}
                    </Text>
                  </View>
                  <Text variant="labelSmall" color={colors.text.muted}>
                    {session.date}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </FlightCase>
        </ADSRFadeIn>

        {/* Case: Collections (placeholder) */}
        <ADSRFadeIn index={3}>
          <FlightCase
            title="Collections"
            icon={<Ionicons name="folder-outline" size={16} color={colors.chrome.text} />}
            count={0}
          >
            <View style={styles.emptyCase}>
              <Ionicons name="folder-open-outline" size={28} color={colors.text.muted} />
              <Text variant="bodySmall" color={colors.text.muted} align="center">
                Create collections to organize your favorite sessions and tracks.
              </Text>
            </View>
          </FlightCase>
        </ADSRFadeIn>

        {/* Case: Master Bounces (placeholder) */}
        <ADSRFadeIn index={4}>
          <FlightCase
            title="Master Bounces"
            icon={<Ionicons name="pulse-outline" size={16} color={colors.chrome.text} />}
            count={0}
          >
            <View style={styles.emptyCase}>
              <Ionicons name="analytics-outline" size={28} color={colors.text.muted} />
              <Text variant="bodySmall" color={colors.text.muted} align="center">
                Session receipts will appear here after completed sessions.
              </Text>
            </View>
          </FlightCase>
        </ADSRFadeIn>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeScreen>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['2xl'],
    paddingBottom: 120,
  },
  header: {
    marginBottom: spacing.lg,
  },
  emptyCase: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
});

export default FlightCasesScreen;
