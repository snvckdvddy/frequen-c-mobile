import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QueueTrack, RoomBehaviors, RoomMode, Track } from '../../../types';
import { buildSignalChainItems } from '../adapters/buildSignalChainItems';
import { deriveVisualMode } from '../adapters/deriveVisualMode';
import TacticalGridBackground from './TacticalGridBackground';
import SignalChainModeSwitch from './SignalChainModeSwitch';
import SignalChainAddBlock from './SignalChainAddBlock';
import SignalChainTrackBlock from './SignalChainTrackBlock';
import { tacticalTokens } from '../theme/tacticalTokens';
import { theme } from '../../../theme/theme';

interface SignalChainSheetV2Props {
  visible: boolean;
  roomMode: RoomMode;
  behaviors: RoomBehaviors;
  queue: QueueTrack[];
  suggestedQueue: QueueTrack[];
  playedHistory: QueueTrack[];
  voltage: number;
  searchInSheet: boolean;
  query: string;
  results: Track[];
  isSearching: boolean;
  recentSearches: Array<{ query: string; timestamp: string }>;
  isHost: boolean;
  keyboardVisible: boolean;
  keyboardHeight: number;
  onClose: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onQueryChange: (query: string) => void;
  onSelectMode: (mode: RoomMode) => void;
  onAddTrack: (track: Track) => void;
  onVote: (trackId: string, direction: 1 | -1) => void;
  onApproveTrack: (trackId: string) => void;
  onRejectTrack: (trackId: string) => void;
  onLongPress: (track: QueueTrack) => void;
  onRemoveRecentSearch: (query: string) => void;
  onRequeueHistory: (track: Track) => void;
}

function formatDuration(duration?: number) {
  const safe = Math.max(0, Math.floor(duration || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatLogId(index: number) {
  return `LOG.${String(index + 1).padStart(3, '0')}`;
}

function formatPatchedBy(track: QueueTrack): string {
  const anyTrack = track as any;
  const addedBy = anyTrack?.addedBy;
  if (typeof addedBy === 'string') return addedBy;
  if (addedBy && typeof addedBy === 'object') {
    if (typeof addedBy.username === 'string') return addedBy.username;
    if (typeof addedBy.name === 'string') return addedBy.name;
  }
  if (typeof anyTrack?.addedByUsername === 'string') return anyTrack.addedByUsername;
  return anyTrack?.artist || 'SYSTEM';
}

function SearchResultRow({
  track,
  onAdd,
}: {
  track: Track;
  onAdd: (track: Track) => void;
}) {
  return (
    <Pressable
      onPress={() => onAdd(track)}
      style={({ pressed }) => [styles.searchResultRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${track.title} by ${track.artist}`}
    >
      <View style={styles.searchResultStrip}>
        <Text style={styles.searchResultStripText}>+</Text>
      </View>
      <View style={styles.searchResultContent}>
        <View style={styles.searchResultMetaRow}>
          <Text style={styles.searchResultMetaTag}>TRACK</Text>
          <Text style={styles.searchResultMetaValue}>{formatDuration(track.duration)}</Text>
        </View>
        <Text style={styles.searchResultTitle} numberOfLines={1}>
          {track.title.toUpperCase()}
        </Text>
        <Text style={styles.searchResultMeta} numberOfLines={1}>
          {track.artist}
        </Text>
        <View style={styles.searchPreviewRow}>
          <View style={styles.searchArtBlock}>
            {track.albumArt ? <Image source={{ uri: track.albumArt }} style={styles.searchArtImage} /> : null}
          </View>
          <View style={styles.searchPreviewGhost} />
          <View style={styles.searchPreviewGhost} />
        </View>
      </View>
      <View style={styles.addCell}>
        <Ionicons name="add" size={18} color={tacticalTokens.colors.orange} />
      </View>
    </Pressable>
  );
}

function RecentHistoryFooter({
  playedHistory,
  onRequeue,
  fullView = false,
}: {
  playedHistory: QueueTrack[];
  onRequeue: (track: Track) => void;
  fullView?: boolean;
}) {
  return (
    <View style={[styles.historySection, fullView && styles.historySectionFull]}>
      <Text style={styles.historyHeader}>DATA LOGS</Text>
      {playedHistory.length ? (
        fullView ? (
          <View style={styles.historyStack}>
            {playedHistory.map((track, index) => (
              <Pressable
                key={`history-${track.id}-${track.addedAt}`}
                onPress={() => onRequeue(track)}
                style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Requeue ${track.title}`}
              >
                <View style={styles.historyRowStrip}>
                  <Text style={styles.historyRowStripText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={styles.historyRowArt}>
                  {track.albumArt ? <Image source={{ uri: track.albumArt }} style={styles.historyArtImage} /> : null}
                </View>
                <View style={styles.historyRowBody}>
                  <View style={styles.historyCardHeader}>
                    <Text style={styles.historyLogId}>{formatLogId(index)}</Text>
                    <Text style={styles.historyDataValueIce}>PLAYED</Text>
                  </View>
                  <Text style={styles.historyRowTitle} numberOfLines={1}>
                    {track.title.toUpperCase()}
                  </Text>
                  <Text style={styles.historyRowMeta} numberOfLines={1}>
                    PATCHED BY @{formatPatchedBy(track).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.historyRowStat}>
                  <Text style={styles.historyDataValueOrange}>{formatDuration(track.duration)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.historyScroll}
          >
            {playedHistory.slice(0, 6).map((track, index) => (
              <Pressable
                key={`history-${track.id}-${track.addedAt}`}
                onPress={() => onRequeue(track)}
                style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Requeue ${track.title}`}
              >
                <View style={styles.historyCardStrip}>
                  <Text style={styles.historyCardStripText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={styles.historyCardBody}>
                  <View style={styles.historyCardHeader}>
                    <Text style={styles.historyLogId}>{formatLogId(index)}</Text>
                    <View style={styles.historyStatusDot} />
                  </View>
                  <Text style={styles.historyCardTitle} numberOfLines={2}>
                    {track.title.toUpperCase()}
                  </Text>
                  <View style={styles.historyDataBlock}>
                    <View style={styles.historyDataRow}>
                      <Text style={styles.historyDataLabel}>ARTIST</Text>
                      <Text style={styles.historyDataValueWhite} numberOfLines={1}>{track.artist.toUpperCase()}</Text>
                    </View>
                    <View style={styles.historyDataRow}>
                      <Text style={styles.historyDataLabel}>LENGTH</Text>
                      <Text style={styles.historyDataValueOrange}>{formatDuration(track.duration)}</Text>
                    </View>
                    <View style={styles.historyDataRow}>
                      <Text style={styles.historyDataLabel}>STATE</Text>
                      <Text style={styles.historyDataValueIce}>PLAYED</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )
      ) : (
        <View style={styles.historyEmpty}>
          <Text style={styles.historyEmptyLabel}>NO ROUTED TRACKS YET</Text>
          <Text style={styles.historyEmptySubtext}>PLAY OR SKIP TRACKS TO BUILD THE LOG</Text>
        </View>
      )}
    </View>
  );
}

function SignalChainViewSwitch({
  activeView,
  onSelect,
}: {
  activeView: 'queue' | 'logs';
  onSelect: (view: 'queue' | 'logs') => void;
}) {
  return (
    <View style={styles.viewSwitch}>
      {([
        ['queue', 'QUEUE'],
        ['logs', 'DATA LOGS'],
      ] as const).map(([key, label]) => {
        const active = activeView === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={({ pressed }) => [
              styles.viewSwitchButton,
              active && styles.viewSwitchButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.viewSwitchLabel, active && styles.viewSwitchLabelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SignalChainSheetV2({
  visible,
  roomMode,
  behaviors,
  queue,
  suggestedQueue,
  playedHistory,
  voltage,
  searchInSheet,
  query,
  results,
  isSearching,
  recentSearches,
  isHost,
  keyboardVisible,
  keyboardHeight,
  onClose,
  onOpenSearch,
  onCloseSearch,
  onQueryChange,
  onSelectMode,
  onAddTrack,
  onVote,
  onApproveTrack,
  onRejectTrack,
  onLongPress,
  onRemoveRecentSearch,
  onRequeueHistory,
}: SignalChainSheetV2Props) {
  const [searchMode, setSearchMode] = useState<'database' | 'oracle'>('database');
  const [activeView, setActiveView] = useState<'queue' | 'logs'>('queue');
  const visualMode = deriveVisualMode(behaviors);
  const items = useMemo(
    () => buildSignalChainItems({ mode: visualMode, queue, suggestedQueue, isHost }),
    [visualMode, queue, suggestedQueue, isHost],
  );

  useEffect(() => {
    if (searchInSheet) {
      setActiveView('queue');
    }
  }, [searchInSheet]);

  const keyboardSafeStyle: ViewStyle | undefined =
    searchInSheet && keyboardVisible
      ? {
          maxHeight: Dimensions.get('window').height - Math.max(keyboardHeight, 0) - 16,
          marginBottom: keyboardHeight,
        }
      : undefined;

  const renderQueueItem = ({ item }: { item: (typeof items)[number] }) => (
    <SignalChainTrackBlock
      item={item}
      mode={visualMode}
      onLongPress={() => onLongPress(item.track)}
      onVote={onVote}
      onApprove={onApproveTrack}
      onReject={onRejectTrack}
    />
  );

  const handleAddFromSearch = (track: Track) => {
    onAddTrack(track);
    onCloseSearch();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />

        <View style={[styles.sheet, keyboardSafeStyle]}>
          <TacticalGridBackground opacity={0.9} />
          <View style={styles.sheetTopRule} />

          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>SIGNAL CHAIN</Text>
            <View style={styles.voltageBlock}>
              <Text style={styles.voltageText}>{String(voltage).padStart(2, '0')}V</Text>
            </View>
          </View>

          {!searchInSheet && (
            <SignalChainViewSwitch activeView={activeView} onSelect={setActiveView} />
          )}

          {searchInSheet ? (
            <View style={styles.searchPanel}>
              <View style={styles.searchTabs}>
                <Pressable
                  onPress={() => setSearchMode('database')}
                  style={({ pressed }) => [
                    styles.searchTab,
                    searchMode === 'database' && styles.searchTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.searchTabLabel, searchMode === 'database' && styles.searchTabLabelActive]}>
                    DATABASE
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSearchMode('oracle')}
                  style={({ pressed }) => [
                    styles.searchTab,
                    searchMode === 'oracle' && styles.searchTabActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.searchTabLabel, searchMode === 'oracle' && styles.searchTabLabelActive]}>
                    ORACLE
                  </Text>
                </Pressable>
              </View>

              {searchMode === 'database' ? (
                <>
                  <View style={styles.searchInputRow}>
                    <View style={styles.searchInputPrefix}>
                      <Text style={styles.searchInputPrefixText}>QRY</Text>
                    </View>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="SEARCH TITLES / ARTISTS / ALBUMS"
                      placeholderTextColor={tacticalTokens.colors.textDim}
                      value={query}
                      onChangeText={onQueryChange}
                      autoFocus
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="search"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <Pressable onPress={onCloseSearch} style={({ pressed }) => [styles.closeSearchButton, pressed && styles.pressed]}>
                      <Ionicons name="close" size={18} color={tacticalTokens.colors.white} />
                    </Pressable>
                  </View>

                  {query.length > 0 ? (
                    <View style={styles.searchResultsWrap}>
                      {isSearching ? (
                        <ActivityIndicator color={tacticalTokens.colors.orange} style={{ marginTop: tacticalTokens.spacing.lg }} />
                      ) : (
                        <FlatList
                          data={results}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item }) => <SearchResultRow track={item} onAdd={handleAddFromSearch} />}
                          keyboardShouldPersistTaps="handled"
                          contentContainerStyle={styles.resultsContent}
                          ListEmptyComponent={
                            <View style={styles.searchEmpty}>
                              <Text style={styles.searchEmptyText}>NO MATCHES // REFINE QUERY</Text>
                            </View>
                          }
                        />
                      )}
                    </View>
                  ) : (
                    <View style={styles.recentSearchWrap}>
                      <Text style={styles.recentSearchHeader}>RECENT SEARCHES</Text>
                      {recentSearches.length ? recentSearches.slice(0, 6).map((item, index) => (
                        <View key={`${item.query}-${item.timestamp}`} style={styles.recentSearchRow}>
                          <View style={styles.recentSearchStrip}>
                            <Text style={styles.recentSearchStripText}>{String(index + 1).padStart(2, '0')}</Text>
                          </View>
                          <Pressable
                            onPress={() => onQueryChange(item.query)}
                            style={({ pressed }) => [styles.recentSearchQuery, pressed && styles.pressed]}
                          >
                            <Text style={styles.recentSearchText}>{item.query.toUpperCase()}</Text>
                          </Pressable>
                          <Pressable onPress={() => onRemoveRecentSearch(item.query)} style={({ pressed }) => [styles.recentSearchRemove, pressed && styles.pressed]}>
                            <Ionicons name="close" size={14} color={tacticalTokens.colors.textDim} />
                          </Pressable>
                        </View>
                      )) : (
                        <Text style={styles.searchEmptyText}>NO LOCAL HISTORY</Text>
                      )}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.oracleStub}>
                  <View style={styles.oracleStubHeader}>
                    <Text style={styles.oracleStubId}>ROUTE.404</Text>
                    <View style={styles.oracleStubStatus} />
                  </View>
                  <Text style={styles.oracleStubTitle}>ORACLE OFFLINE</Text>
                  <Text style={styles.oracleStubBody}>
                    DATABASE SEARCH IS ACTIVE IN V2. ORACLE ROUTING RETURNS IN A LATER SLICE.
                  </Text>
                </View>
              )}
            </View>
          ) : activeView === 'queue' ? (
            <>
              <SignalChainModeSwitch mode={roomMode} isHost={isHost} onSelectMode={onSelectMode} />
              <SignalChainAddBlock onPress={onOpenSearch} />

              <FlatList
                data={items}
                keyExtractor={(item) => `${item.track.id}-${item.indexLabel}-${item.isPending ? 'pending' : 'live'}`}
                renderItem={renderQueueItem}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
              />
            </>
          ) : (
            <ScrollView
              style={styles.logsView}
              contentContainerStyle={styles.logsContent}
              showsVerticalScrollIndicator={false}
            >
              <RecentHistoryFooter playedHistory={playedHistory} onRequeue={onRequeueHistory} fullView />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tacticalTokens.colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    minHeight: '75%',
    maxHeight: '85%',
    backgroundColor: theme.colors.void,
    borderTopWidth: 2,
    borderTopColor: theme.colors.textPure,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
    paddingBottom: theme.spacing.xl,
  },
  sheetTopRule: {
    height: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  viewSwitch: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.md,
    gap: 0,
  },
  viewSwitchButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewSwitchButtonActive: {
    backgroundColor: theme.colors.textPure,
  },
  viewSwitchLabel: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 0.8,
  },
  viewSwitchLabelActive: {
    color: theme.colors.void,
  },
  headerTitle: {
    fontFamily: theme.fonts.display,
    fontSize: 24,
    lineHeight: 24,
    color: theme.colors.textPure,
    textTransform: 'uppercase',
  },
  voltageBlock: {
    minWidth: 52,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.iceCyan,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.void,
  },
  voltageText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 14,
    color: theme.colors.iceCyan,
  },
  searchPanel: {
    flex: 1,
  },
  searchTabs: {
    marginHorizontal: theme.spacing.xl,
    flexDirection: 'row',
    backgroundColor: theme.colors.borderLight,
    padding: 2,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  searchTab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.void,
  },
  searchTabActive: {
    backgroundColor: theme.colors.textPure,
  },
  searchTabLabel: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 0.8,
  },
  searchTabLabelActive: {
    color: theme.colors.void,
  },
  searchInputRow: {
    marginTop: tacticalTokens.spacing.md,
    marginHorizontal: tacticalTokens.spacing.xl,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: tacticalTokens.spacing.xs,
  },
  searchInputPrefix: {
    width: 44,
    minHeight: 52,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputPrefixText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  searchInput: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    color: tacticalTokens.colors.white,
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    paddingHorizontal: tacticalTokens.spacing.md,
    letterSpacing: 0.8,
  },
  closeSearchButton: {
    width: 44,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  searchResultsWrap: {
    flex: 1,
    paddingTop: tacticalTokens.spacing.sm,
  },
  resultsContent: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.xxxl,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 108,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    marginBottom: tacticalTokens.spacing.md,
  },
  searchResultStrip: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.matte,
    borderRightWidth: 1,
    borderRightColor: tacticalTokens.colors.border,
  },
  searchResultStripText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.orange,
  },
  searchResultContent: {
    flex: 1,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
    minWidth: 0,
  },
  searchResultMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tacticalTokens.spacing.xs,
  },
  searchResultMetaTag: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.2,
  },
  searchResultMetaValue: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  searchArtBlock: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  searchArtImage: {
    width: '100%',
    height: '100%',
  },
  searchResultTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  searchResultMeta: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textDim,
  },
  searchPreviewRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.xs,
    marginTop: tacticalTokens.spacing.md,
  },
  searchPreviewGhost: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: '#1D1D1D',
  },
  addCell: {
    width: 48,
    minHeight: 106,
    borderLeftWidth: 1,
    borderLeftColor: tacticalTokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmpty: {
    minHeight: 132,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingVertical: tacticalTokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  searchEmptyText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  recentSearchWrap: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.lg,
  },
  recentSearchHeader: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 2,
    marginBottom: tacticalTokens.spacing.md,
  },
  recentSearchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: tacticalTokens.spacing.sm,
  },
  recentSearchStrip: {
    width: 44,
    minHeight: 56,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSearchStripText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  recentSearchQuery: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.md,
    backgroundColor: tacticalTokens.colors.void,
    marginLeft: tacticalTokens.spacing.xs,
  },
  recentSearchText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
    letterSpacing: 0.8,
  },
  recentSearchRemove: {
    width: 44,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    marginLeft: tacticalTokens.spacing.xs,
    backgroundColor: tacticalTokens.colors.matte,
  },
  oracleStub: {
    marginTop: tacticalTokens.spacing.lg,
    marginHorizontal: tacticalTokens.spacing.xl,
    padding: tacticalTokens.spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    minHeight: 188,
  },
  oracleStubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    paddingBottom: tacticalTokens.spacing.xs,
    marginBottom: tacticalTokens.spacing.md,
  },
  oracleStubId: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.2,
  },
  oracleStubStatus: {
    width: 6,
    height: 6,
    backgroundColor: tacticalTokens.colors.textDim,
  },
  oracleStubTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  oracleStubBody: {
    marginTop: tacticalTokens.spacing.sm,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.textDim,
    lineHeight: 28,
  },
  listContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xxxl,
  },
  logsView: {
    flex: 1,
  },
  logsContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.xxxl,
  },
  historySection: {
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
  },
  historySectionFull: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  historyHeader: {
    marginBottom: theme.spacing.md,
    fontFamily: theme.fonts.monoBold,
    fontSize: 12,
    color: theme.colors.iceCyan,
    letterSpacing: 1.4,
  },
  historyScroll: {
    paddingRight: tacticalTokens.spacing.xl,
    gap: tacticalTokens.spacing.md,
  },
  historyStack: {
    gap: tacticalTokens.spacing.md,
  },
  historyEmpty: {
    minHeight: 92,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingVertical: tacticalTokens.spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    justifyContent: 'center',
    gap: tacticalTokens.spacing.xs,
  },
  historyEmptyLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.4,
  },
  historyEmptySubtext: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.2,
  },
  historyCard: {
    width: 176,
    minHeight: 152,
    flexDirection: 'row',
    backgroundColor: tacticalTokens.colors.matte,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tacticalTokens.colors.border,
  },
  historyCardStrip: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  historyCardStripText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    transform: [{ rotate: '-90deg' }],
  },
  historyCardBody: {
    flex: 1,
    padding: tacticalTokens.spacing.md,
  },
  historyRow: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  historyRowStrip: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  historyRowStripText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    transform: [{ rotate: '-90deg' }],
  },
  historyRowArt: {
    width: 56,
    height: 56,
    marginLeft: tacticalTokens.spacing.md,
    marginTop: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  historyRowBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  historyRowTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  historyRowMeta: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1,
  },
  historyRowStat: {
    width: 74,
    borderLeftWidth: 1,
    borderLeftColor: tacticalTokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.sm,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    paddingBottom: tacticalTokens.spacing.xs,
    marginBottom: tacticalTokens.spacing.sm,
  },
  historyLogId: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.2,
  },
  historyStatusDot: {
    width: 6,
    height: 6,
    backgroundColor: tacticalTokens.colors.acid,
  },
  historyCardTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    lineHeight: tacticalTokens.fontSize.label + 2,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
    minHeight: 38,
  },
  historyDataBlock: {
    marginTop: tacticalTokens.spacing.md,
    gap: 2,
  },
  historyDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
  },
  historyDataLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1,
  },
  historyDataValueWhite: {
    flex: 1,
    textAlign: 'right',
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
  },
  historyDataValueOrange: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
  },
  historyDataValueIce: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
  },
  historyArtBlock: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  historyArtImage: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.84,
  },
});

export default SignalChainSheetV2;
