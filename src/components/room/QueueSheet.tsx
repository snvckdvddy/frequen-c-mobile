/**
 * QueueSheet — Full-screen queue bottom sheet.
 *
 * Contains: search bar, search results, recent searches,
 * draggable queue list with suggestions panel, played history.
 * Extracted from SessionRoomScreen for modularity.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, FlatList,
  TextInput, ActivityIndicator, Keyboard, Platform,
  Dimensions, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { VoidSurface, LEDReadout } from '../../design/components';
import { palette } from '../../design/tokens/materials';
import { letterSpacing as ls } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';
import { QueueTrackCard } from '../QueueTrackCard';
import { SearchResultItem } from '../SearchResultItem';
import { SuggestionCard } from '../SuggestionCard';
import { PlayedHistory } from '../PlayedHistory';
import { AnalyzeButton, SonicAestheticResultCard } from './SonicAestheticCard';
import { OracleModeCard } from './OracleModeCard';
import { aiApi, type SonicAestheticResult } from '../../services/api';
import type { QueueTrack, Track, RoomBehaviors } from '../../types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface QueueSheetProps {
  visible: boolean;
  accent: string;

  // Queue state
  queue: QueueTrack[];
  suggestedQueue: QueueTrack[];
  playedHistory: QueueTrack[];

  // Search state (lifted from parent)
  searchInSheet: boolean;
  query: string;
  results: Track[];
  isSearching: boolean;
  recentSearches: Array<{ query: string; timestamp: string }>;

  // Room context
  userId?: string;
  isHost: boolean;
  isApprovalMode: boolean;
  behaviors: RoomBehaviors;

  // Keyboard state (for Android safe area)
  keyboardVisible: boolean;
  keyboardHeight: number;

  // Callbacks
  onClose: () => void;
  onSearchToggle: (open: boolean) => void;
  onQueryChange: (q: string) => void;
  onCancelSearch: () => void;
  onAddTrack: (track: Track) => void;
  onVote: (trackId: string, direction: 1 | -1) => void;
  onRemoveFromQueue: (trackId: string) => void;
  onApproveTrack: (trackId: string) => void;
  onRejectTrack: (trackId: string) => void;
  onRemoveRecentSearch: (q: string) => void;

  // Favorites
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (track: QueueTrack) => void;

  // Context menu
  onLongPress: (track: QueueTrack) => void;

  // AI: Sonic Aesthetic suggestion callback
  onAddSuggestion?: (title: string, artist: string) => void;
}

export function QueueSheet({
  visible,
  accent,
  queue,
  suggestedQueue,
  playedHistory,
  searchInSheet,
  query,
  results,
  isSearching,
  recentSearches,
  userId,
  isHost,
  isApprovalMode,
  behaviors,
  keyboardVisible,
  keyboardHeight,
  onClose,
  onSearchToggle,
  onQueryChange,
  onCancelSearch,
  onAddTrack,
  onVote,
  onRemoveFromQueue,
  onApproveTrack,
  onRejectTrack,
  onRemoveRecentSearch,
  isFavorite,
  onToggleFavorite,
  onLongPress,
  onAddSuggestion,
}: QueueSheetProps) {
  const searchInputRef = useRef<TextInput>(null);
  const searchInSheetRef = useRef(searchInSheet);
  searchInSheetRef.current = searchInSheet;
  const [searchMode, setSearchMode] = useState<'database' | 'oracle'>('database');
  const [aestheticResult, setAestheticResult] = useState<SonicAestheticResult | null>(null);
  const [aestheticLoading, setAestheticLoading] = useState(false);
  const [aestheticError, setAestheticError] = useState<string | null>(null);

  const keyboardSafeSheetStyle: ViewStyle | undefined =
    Platform.OS === 'android' && searchInSheet && keyboardVisible
      ? {
          height: Math.max(340, SCREEN_HEIGHT - keyboardHeight - 16),
          maxHeight: SCREEN_HEIGHT - 16,
          marginBottom: keyboardHeight,
        }
      : undefined;

  const handleClose = () => {
    setSearchMode('database');
    onClose();
  };

  const handleAnalyze = useCallback(async () => {
    if (!onAddSuggestion || queue.length < 2 || aestheticLoading) return;
    setAestheticLoading(true);
    setAestheticError(null);
    try {
      const data = await aiApi.sonicAesthetic(
        queue.map((t) => ({ title: t.title, artist: t.artist, album: t.album }))
      );
      setAestheticResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to analyze sonic aesthetic';
      setAestheticError(message);
      console.warn('[SonicAesthetic]', message);
    } finally {
      setAestheticLoading(false);
    }
  }, [onAddSuggestion, queue, aestheticLoading]);

  const handleDismissAesthetic = useCallback(() => {
    setAestheticResult(null);
  }, []);

  const handleAddAestheticSuggestion = useCallback((title: string, artist: string) => {
    onAddSuggestion?.(title, artist);
  }, [onAddSuggestion]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.sheetBackdrop} accessibilityViewIsModal>
        <TouchableOpacity
          style={styles.sheetBackdropTouch}
          onPress={handleClose}
          activeOpacity={1}
          accessible={false}
        />
        <VoidSurface
          style={[styles.sheetContainer, keyboardSafeSheetStyle]}
          grain={false}
        >
          <View style={styles.sheetHandle} />

          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <LEDReadout value="QUEUE" variant="amber" size="md" />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {queue.length >= 2 && onAddSuggestion && (
                <AnalyzeButton onPress={handleAnalyze} loading={aestheticLoading} compact />
              )}
              <TouchableOpacity
                style={[styles.addTrackBtn, { borderColor: accent }]}
                onPress={() => {
                  const opening = !searchInSheet;
                  if (opening) setSearchMode('database');
                  onSearchToggle(opening);
                }}
                accessibilityRole="button"
                accessibilityLabel={searchInSheet ? 'Close search' : 'Add track to queue'}
              >
                <Ionicons name="add" size={16} color={accent} />
                <Text variant="label" color={accent} style={{ fontSize: 12 }}>
                  Add track
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} accessibilityRole="button" accessibilityLabel="Close queue">
                <Ionicons name="close" size={24} color={palette.slate} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search (inside sheet) */}
          {searchInSheet && (
            <View style={styles.searchModeWrap}>
              <View style={styles.searchModeTabs}>
                <TouchableOpacity
                  style={[styles.searchModeTab, searchMode === 'database' && styles.searchModeTabActive]}
                  onPress={() => setSearchMode('database')}
                  accessibilityRole="button"
                  accessibilityLabel="Database search mode"
                  accessibilityState={{ selected: searchMode === 'database' }}
                >
                  <Text style={[styles.searchModeText, searchMode === 'database' && styles.searchModeTextActive]}>
                    DATABASE
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.searchModeTab, searchMode === 'oracle' && styles.searchModeTabActive]}
                  onPress={() => setSearchMode('oracle')}
                  accessibilityRole="button"
                  accessibilityLabel="Oracle semantic search mode"
                  accessibilityState={{ selected: searchMode === 'oracle' }}
                >
                  <Text style={[styles.searchModeText, searchMode === 'oracle' && styles.searchModeTextActive]}>
                    ✦ ORACLE
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {searchInSheet && searchMode === 'database' && (
            <View style={styles.sheetSearchRow}>
              <TextInput
                ref={searchInputRef}
                style={styles.sheetSearchInput}
                placeholder="Search for tracks..."
                placeholderTextColor={palette.slate}
                value={query}
                onChangeText={onQueryChange}
                autoFocus
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Search for tracks"
                accessibilityHint="Type to search for tracks to add to the queue"
              />
              <TouchableOpacity onPress={onCancelSearch} accessibilityRole="button" accessibilityLabel="Cancel search">
                <Text variant="label" color={palette.slate}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Search results */}
          {searchInSheet && searchMode === 'database' && query.length > 0 ? (
            <View style={{ flex: 1 }}>
              {isSearching && (
                <ActivityIndicator color={accent} style={{ marginVertical: spacing.sm }} />
              )}
              {/* Result count */}
              {!isSearching && results.length > 0 && (
                <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs }}>
                  <Text variant="labelSmall" color={palette.slate} style={{ letterSpacing: ls.wide, textTransform: 'uppercase' }}>
                    {results.length} result{results.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <SearchResultItem track={item} onAdd={onAddTrack} />}
                keyboardShouldPersistTaps="handled"
                onScrollBeginDrag={Keyboard.dismiss}
                style={{ flex: 1 }}
                initialNumToRender={8}
                maxToRenderPerBatch={5}
                windowSize={7}
                ListEmptyComponent={
                  !isSearching ? (
                    <View style={styles.sheetEmpty}>
                      <Ionicons name="search-outline" size={24} color={palette.slate} />
                      <Text variant="body" color={palette.slate} style={{ marginTop: spacing.xs }}>
                        No tracks found for "{query}"
                      </Text>
                    </View>
                  ) : null
                }
              />
            </View>
          ) : searchInSheet && searchMode === 'database' && query.length === 0 && recentSearches.length === 0 ? (
            /* Search open, no query, no recent searches — helpful prompt */
            <View style={[styles.sheetEmpty, { paddingTop: spacing.xl }]}>
              <Ionicons name="search-outline" size={32} color={palette.slate} />
              <Text variant="body" color={palette.slate} style={{ marginTop: spacing.sm, textAlign: 'center' }}>
                Search by title, artist, or album
              </Text>
            </View>
          ) : searchInSheet && searchMode === 'database' && recentSearches.length > 0 ? (
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
              <Text variant="labelSmall" color={palette.slate} style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: ls.wide }}>
                Recent Searches
              </Text>
              {recentSearches.slice(0, 6).map((s) => (
                <TouchableOpacity
                  key={s.query + s.timestamp}
                  style={styles.recentItem}
                  onPress={() => onQueryChange(s.query)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${s.query}`}
                >
                  <Ionicons name="time-outline" size={14} color={palette.slate} style={{ marginRight: 8 }} />
                  <Text variant="body" color={palette.silver} style={{ flex: 1 }} numberOfLines={1}>
                    {s.query}
                  </Text>
                  <TouchableOpacity
                    onPress={() => onRemoveRecentSearch(s.query)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${s.query} from recent searches`}
                  >
                    <Ionicons name="close" size={14} color={palette.slate} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ) : searchInSheet && searchMode === 'oracle' ? (
            <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
              <OracleModeCard
                onAddResolvedTrack={onAddTrack}
                onAddTrack={(title, artist) => onAddSuggestion?.(title, artist)}
              />
            </View>
          ) : (
            /* Queue list */
            <FlatList<QueueTrack>
              data={queue}
              keyExtractor={(item) => item.id}
              style={styles.queueList}
              renderItem={({ item, index }) => (
                <QueueTrackCard
                  track={item}
                  isNowPlaying={index === 0}
                  onVote={onVote}
                  userId={userId}
                  behaviors={behaviors}
                  isHost={isHost}
                  isFavorite={isFavorite(item.sourceId || item.id)}
                  onToggleFavorite={() => onToggleFavorite(item)}
                  onLongPress={() => onLongPress(item)}
                  showDragHandle={isHost && index > 0}
                />
              )}
              contentContainerStyle={styles.queueListContent}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              scrollEnabled
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <>
                  {aestheticError && (
                    <View style={styles.aestheticErrorWrap}>
                      <Text variant="bodySmall" color={palette.red}>{aestheticError}</Text>
                    </View>
                  )}

                  {aestheticResult && onAddSuggestion && (
                    <SonicAestheticResultCard
                      result={aestheticResult}
                      onDismiss={handleDismissAesthetic}
                      onAddSuggestion={handleAddAestheticSuggestion}
                    />
                  )}

                  {/* Approval mode: Suggestions panel (host only) */}
                  {isApprovalMode && isHost && suggestedQueue.length > 0 && (
                    <View style={styles.suggestionsPanel}>
                      <Text variant="label" color={palette.silver} style={{ marginBottom: spacing.sm }}>
                        Suggestions ({suggestedQueue.length})
                      </Text>
                      {suggestedQueue.map((track) => (
                        <SuggestionCard
                          key={track.id}
                          track={track}
                          onApprove={onApproveTrack}
                          onReject={onRejectTrack}
                        />
                      ))}
                    </View>
                  )}
                </>
              }
              ListEmptyComponent={
                <View style={styles.sheetEmpty}>
                  <Ionicons name="musical-notes" size={32} color={palette.slate} />
                  <Text variant="body" color={palette.slate} style={{ marginTop: spacing.sm }}>
                    Queue is empty
                  </Text>
                  <TouchableOpacity
                    style={{ marginTop: spacing.sm }}
                    onPress={() => onSearchToggle(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Search to add tracks"
                  >
                    <Text variant="label" color={accent}>
                      Search to add tracks
                    </Text>
                  </TouchableOpacity>
                </View>
              }
              ListFooterComponent={
                <PlayedHistory history={playedHistory} onRequeue={onAddTrack} />
              }
            />
          )}
        </VoidSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    height: '92%',
    maxHeight: '92%',
    minHeight: 360,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: palette.iceGlow,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 0,
    backgroundColor: palette.iceGlow,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 0,
    borderWidth: 1,
    gap: 4,
  },
  sheetSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchModeWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  searchModeTabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    borderRadius: 0,
    overflow: 'hidden',
  },
  searchModeTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    backgroundColor: palette.midnight,
  },
  searchModeTabActive: {
    backgroundColor: 'rgba(90, 200, 200, 0.10)',
  },
  searchModeText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 11,
    letterSpacing: 1,
    color: palette.slate,
  },
  searchModeTextActive: {
    color: palette.frost,
  },
  sheetSearchInput: {
    flex: 1,
    height: 38,
    backgroundColor: '#111',
    borderRadius: 0,
    paddingHorizontal: 12,
    color: palette.frost,
    fontSize: 13,
    fontFamily: 'SpaceMono-Regular',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  sheetEmpty: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  queueList: {
    flex: 1,
  },
  queueListContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  suggestionsPanel: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: 0,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  aestheticErrorWrap: {
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
});

export default QueueSheet;
