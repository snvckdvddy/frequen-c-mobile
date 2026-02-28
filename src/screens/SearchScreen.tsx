/**
 * SearchScreen — Standalone search tab.
 *
 * Idle: Saved tracks (horizontal scroll) + Recent searches
 * Active: Segmented results (Tracks / Rooms / People)
 *
 * Design ref: SoundCloud search UI — art-forward, clean density.
 * Adapted to Frequen-C's visual language.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Keyboard, Alert,
} from 'react-native';
import { Text, SafeScreen, ErrorState } from '../components/ui';
import { TrackCardSkeleton } from '../components/ui/Skeleton';
import { TrackResultCard } from '../components/search/TrackResultCard';
import { RoomResultCard } from '../components/search/RoomResultCard';
import { PersonResultCard } from '../components/search/PersonResultCard';
import { AddToRoomSheet } from '../components/search/AddToRoomSheet';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { useActiveSession } from '../contexts/ActiveSessionContext';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { searchApi } from '../services/api';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import type { Track, Session, MockUser, SearchSegment } from '../types';

// ─── Segment Chip ─────────────────────────────────────────────

function SegmentChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${label}${count !== undefined ? `, ${count} results` : ''}${active ? ', selected' : ''}`}
      accessibilityState={{ selected: active }}
    >
      <Text
        variant="labelSmall"
        color={active ? palette.frost : palette.slate}
      >
        {label}{count !== undefined ? ` (${count})` : ''}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Favorite Card (compact square for horizontal scroll) ─────

function FavoriteCard({
  track,
  onPress,
  onLongPress,
}: {
  track: Track;
  onPress: (track: Track) => void;
  onLongPress: (track: Track) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.favoriteCard}
      onPress={() => onPress(track)}
      onLongPress={() => onLongPress(track)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${track.title} by ${track.artist}`}
      accessibilityHint="Long press to remove from favorites"
    >
      <View style={styles.favoriteArt}>
        <Text variant="label" color={palette.slate} style={{ fontSize: 20 }}>
          {track.artist.charAt(0)}
        </Text>
      </View>
      <Text
        variant="labelSmall"
        color={palette.frost}
        numberOfLines={1}
        style={styles.favoriteTitle}
      >
        {track.title}
      </Text>
      <Text
        variant="labelSmall"
        color={palette.slate}
        numberOfLines={1}
      >
        {track.artist}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

interface SearchScreenProps {
  onOpenRoom: (sessionId: string) => void;
  onBrowseRooms: () => void;
  onCreateRoom?: () => void;
}

export function SearchScreen({ onOpenRoom, onBrowseRooms, onCreateRoom }: SearchScreenProps) {
  const searchInputRef = useRef<TextInput>(null);
  const { favorites, toggleFavorite, isFavorite, removeFavorite } = useFavoritesContext();
  const { activeSession } = useActiveSession();
  const { searches, addSearch, removeSearch, clearAll } = useRecentSearches();

  // Search state
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [activeSegment, setActiveSegment] = useState<SearchSegment>('tracks');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [trackResults, setTrackResults] = useState<Track[]>([]);
  const [roomResults, setRoomResults] = useState<Session[]>([]);
  const [peopleResults, setPeopleResults] = useState<MockUser[]>([]);

  // Add to room sheet
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Debounce ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef<string>('');

  // ─── Search Logic ──────────────────────────────────────
  const executeSearch = useCallback((q: string, segment?: SearchSegment) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setTrackResults([]);
      setRoomResults([]);
      setPeopleResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    lastQueryRef.current = trimmed;

    // Fire all three in parallel
    Promise.all([
      searchApi.tracks(trimmed).catch(() => ({ tracks: [] as Track[] })),
      searchApi.sessions(trimmed).catch(() => ({ sessions: [] as Session[] })),
      searchApi.users(trimmed).catch(() => ({ users: [] as MockUser[] })),
    ]).then(([trackRes, sessionRes, userRes]) => {
      setTrackResults(trackRes.tracks);
      setRoomResults(sessionRes.sessions);
      setPeopleResults(userRes.users);
      setIsSearching(false);

      // Save to recent searches
      addSearch(trimmed, segment || activeSegment);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Search failed');
      setIsSearching(false);
    });
  }, [addSearch, activeSegment]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!text.trim()) {
      setTrackResults([]);
      setRoomResults([]);
      setPeopleResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    timerRef.current = setTimeout(() => executeSearch(text), 500);
  }, [executeSearch]);

  const handleCancel = useCallback(() => {
    setQuery('');
    setIsActive(false);
    setTrackResults([]);
    setRoomResults([]);
    setPeopleResults([]);
    setIsSearching(false);
    setError(null);
    Keyboard.dismiss();
  }, []);

  const handleRecentTap = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
    setIsActive(true);
    executeSearch(recentQuery);
  }, [executeSearch]);

  const handleAddToRoom = useCallback((track: Track) => {
    setSheetTrack(track);
    setSheetVisible(true);
  }, []);

  const handleFavoriteLongPress = useCallback((track: Track) => {
    Alert.alert(
      'Remove Favorite',
      `Remove "${track.title}" from saved tracks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFavorite(track.id),
        },
      ]
    );
  }, [removeFavorite]);

  // ─── Idle State ────────────────────────────────────────
  const hasResults = query.trim().length > 0;

  const renderIdleState = () => (
    <ScrollView
      style={styles.idleScroll}
      contentContainerStyle={styles.idleContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Favorites Section */}
      {favorites.length > 0 && (
        <View style={styles.section}>
          <Text variant="label" color={palette.frost} style={styles.sectionTitle}>
            Saved Tracks ({favorites.length})
          </Text>
          <FlatList
            horizontal
            data={favorites}
            keyExtractor={(item) => item.track.id}
            renderItem={({ item }) => (
              <FavoriteCard
                track={item.track}
                onPress={handleAddToRoom}
                onLongPress={handleFavoriteLongPress}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesRow}
            initialNumToRender={5}
            maxToRenderPerBatch={3}
            windowSize={5}
          />
        </View>
      )}

      {favorites.length === 0 && (
        <View style={styles.emptyFavorites}>
          <Text variant="body" color={palette.slate} align="center">
            Tracks you save will show up here.
          </Text>
        </View>
      )}

      {/* Recent Searches */}
      {searches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.recentHeader}>
            <Text variant="label" color={palette.frost}>
              Recent Searches
            </Text>
            <TouchableOpacity onPress={clearAll} accessibilityRole="button" accessibilityLabel="Clear all recent searches">
              <Text variant="labelSmall" color={palette.slate}>Clear All</Text>
            </TouchableOpacity>
          </View>
          {searches.map((s) => (
            <TouchableOpacity
              key={s.query + s.timestamp}
              style={styles.recentItem}
              onPress={() => handleRecentTap(s.query)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Search for ${s.query}`}
            >
              <Text variant="body" color={palette.silver} style={{ flex: 1 }}>
                {s.query}
              </Text>
              <TouchableOpacity
                onPress={() => removeSearch(s.query)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${s.query} from recent searches`}
              >
                <Text variant="labelSmall" color={palette.slate}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // ─── Active State (Results) ────────────────────────────
  const renderActiveState = () => (
    <View style={styles.activeContainer}>
      {/* Error banner */}
      {error && (
        <ErrorState
          variant="banner"
          message={error}
          onRetry={() => executeSearch(lastQueryRef.current)}
        />
      )}

      {/* Segment Chips */}
      <View style={styles.segmentRow}>
        <SegmentChip
          label="Tracks"
          count={trackResults.length}
          active={activeSegment === 'tracks'}
          onPress={() => setActiveSegment('tracks')}
        />
        <SegmentChip
          label="Rooms"
          count={roomResults.length}
          active={activeSegment === 'rooms'}
          onPress={() => setActiveSegment('rooms')}
        />
        <SegmentChip
          label="People"
          count={peopleResults.length}
          active={activeSegment === 'people'}
          onPress={() => setActiveSegment('people')}
        />
      </View>

      {/* Loading skeletons */}
      {isSearching && (
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          <TrackCardSkeleton />
          <TrackCardSkeleton />
          <TrackCardSkeleton />
        </View>
      )}

      {/* Track Results */}
      {activeSegment === 'tracks' && !isSearching && (
        <FlatList
          data={trackResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrackResultCard
              track={item}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={toggleFavorite}
              onAddToRoom={handleAddToRoom}
            />
          )}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={7}
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="body" color={palette.slate} align="center" style={{ paddingTop: spacing.xl }}>
                No tracks found
              </Text>
            ) : null
          }
        />
      )}

      {/* Room Results */}
      {activeSegment === 'rooms' && !isSearching && (
        <FlatList
          data={roomResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RoomResultCard session={item} onPress={onOpenRoom} />
          )}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={7}
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="body" color={palette.slate} align="center" style={{ paddingTop: spacing.xl }}>
                No rooms found
              </Text>
            ) : null
          }
        />
      )}

      {/* People Results */}
      {activeSegment === 'people' && !isSearching && (
        <FlatList
          data={peopleResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PersonResultCard user={item} />}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={7}
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="body" color={palette.slate} align="center" style={{ paddingTop: spacing.xl }}>
                No people found
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );

  return (
    <SafeScreen>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchBarRow}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search tracks, rooms, people..."
            placeholderTextColor={palette.slate}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setIsActive(true)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isActive && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} accessibilityRole="button" accessibilityLabel="Cancel search">
              <Text variant="label" color={palette.slate}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Active session banner */}
        {activeSession && (
          <View style={styles.sessionBanner}>
            <View style={styles.sessionDot} />
            <Text variant="labelSmall" color={palette.silver} style={{ flex: 1 }}>
              In {activeSession.sessionName}
            </Text>
            <Text variant="labelSmall" color={palette.slate}>
              Tracks you add go straight to the queue
            </Text>
          </View>
        )}

        {/* Content */}
        {isActive && hasResults ? renderActiveState() : renderIdleState()}

        {/* Add to Room Sheet */}
        <AddToRoomSheet
          visible={sheetVisible}
          track={sheetTrack}
          onClose={() => setSheetVisible(false)}
          onBrowseRooms={onBrowseRooms}
          onCreateRoom={onCreateRoom}
        />
      </View>
    </SafeScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Search bar
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: palette.steel,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.inputPadding,
    color: palette.frost,
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: spacing.xs,
  },

  // Segment chips
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: palette.steel,
  },
  chipActive: {
    backgroundColor: palette.orange,
  },

  // Idle state
  idleScroll: {
    flex: 1,
  },
  idleContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing['3xl'],
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  favoritesRow: {
    gap: spacing.sm,
  },
  emptyFavorites: {
    paddingVertical: spacing['2xl'],
  },

  // Favorite card (compact square)
  favoriteCard: {
    width: 120,
  },
  favoriteArt: {
    width: 120,
    height: 120,
    borderRadius: spacing.radius.md,
    backgroundColor: palette.steel,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  favoriteTitle: {
    marginBottom: 1,
  },

  // Recent searches
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },

  // Session banner
  sessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(100, 200, 255, 0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 200, 255, 0.15)',
    gap: spacing.xs,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.orange,
  },

  // Active state
  activeContainer: {
    flex: 1,
  },
  resultsList: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing['2xl'],
  },
});

export default SearchScreen;
