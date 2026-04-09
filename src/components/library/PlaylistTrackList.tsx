/**
 * PlaylistTrackList
 * ─────────────────────────────────────────────────────────────
 * FlatList of tracks within a selected playlist.
 * Reuses the existing TrackListItem component.
 *
 * Tap action depends on context:
 * - In session: queue the track
 * - Standalone: show context menu (queue, favorite, etc.)
 */

import React from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, withAlpha } from '@/design/tokens/materials';
import { Track, Playlist } from '../../types';
import { TrackListItem } from '../ui';

// ─── Props ──────────────────────────────────────────────────

export interface PlaylistTrackListProps {
  /** The parent playlist (for header display) */
  playlist: Playlist;
  /** Tracks loaded from the playlist */
  tracks: Track[];
  /** Whether tracks are currently loading */
  loading: boolean;
  /** Called when a track is tapped */
  onTrackPress: (track: Track) => void;
  /** Called when the back/close button is tapped */
  onBack: () => void;
  /** Optional: called when the menu on a track is pressed */
  onTrackMenuPress?: (track: Track) => void;
}

// ─── Component ──────────────────────────────────────────────

export function PlaylistTrackList({
  playlist,
  tracks,
  loading,
  onTrackPress,
  onBack,
  onTrackMenuPress,
}: PlaylistTrackListProps) {
  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Back to playlists"
      >
        <Ionicons name="chevron-back" size={22} color={palette.frost} />
      </TouchableOpacity>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {playlist.name}
        </Text>
        <Text style={styles.headerMeta}>
          {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={palette.orange} />
          <Text style={styles.loadingText}>Loading tracks...</Text>
        </View>
      </View>
    );
  }

  if (tracks.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.empty}>
          <Ionicons name="musical-note-outline" size={40} color={palette.slate} />
          <Text style={styles.emptyText}>This playlist is empty</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tracks}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <TrackListItem
            title={item.title}
            artist={item.artist}
            albumArt={item.albumArt}
            duration={item.duration}
            source={item.source}
            metadataSource={item.metadataSource}
            onPress={() => onTrackPress(item)}
            onMenuPress={
              onTrackMenuPress ? () => onTrackMenuPress(item) : undefined
            }
            showMenu={!!onTrackMenuPress}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.chromeBorder,
    marginBottom: 4,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: palette.frost,
    fontSize: 18,
    fontWeight: '600',
  },
  headerMeta: {
    color: palette.silver,
    fontSize: 13,
    marginTop: 2,
  },

  // ─── Loading ──────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    color: palette.silver,
    fontSize: 13,
    marginTop: 8,
  },

  // ─── Empty ────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: palette.silver,
    fontSize: 14,
    marginTop: 10,
  },
});
