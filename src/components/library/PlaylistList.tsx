/**
 * PlaylistList
 * ─────────────────────────────────────────────────────────────
 * FlatList of playlists for a selected streaming service.
 * Each row shows cover art (or fallback icon), playlist name,
 * and track count. Tap navigates to the playlist's track list.
 * Includes skeleton loading and empty state.
 */

import React from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, withAlpha } from '@/design/tokens/materials';
import { Playlist } from '../../types';

// ─── Props ──────────────────────────────────────────────────

export interface PlaylistListProps {
  playlists: Playlist[];
  loading: boolean;
  onSelectPlaylist: (playlist: Playlist) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

// ─── Skeleton Row ───────────────────────────────────────────

function SkeletonRow() {
  return (
    <View style={styles.row}>
      <View style={[styles.coverArt, styles.skeleton]} />
      <View style={styles.info}>
        <View style={[styles.skeletonText, { width: '65%' }]} />
        <View style={[styles.skeletonText, { width: '35%', marginTop: 6 }]} />
      </View>
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────

export function PlaylistList({
  playlists,
  loading,
  onSelectPlaylist,
  onRefresh,
  refreshing = false,
}: PlaylistListProps) {
  if (loading && playlists.length === 0) {
    return (
      <View style={styles.container}>
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  if (!loading && playlists.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="albums-outline" size={48} color={palette.slate} />
        <Text style={styles.emptyText}>No playlists found</Text>
        <Text style={styles.emptySubtext}>
          Playlists you create on your streaming service will appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={playlists}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => onSelectPlaylist(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.trackCount} tracks`}
        >
          {item.coverArt ? (
            <Image source={{ uri: item.coverArt }} style={styles.coverArt} />
          ) : (
            <View style={[styles.coverArt, styles.coverFallback]}>
              <Ionicons name="musical-notes" size={22} color={palette.slate} />
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.meta}>
              {item.trackCount} {item.trackCount === 1 ? 'track' : 'tracks'}
              {item.owner ? ` \u00B7 ${item.owner}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.slate} />
        </TouchableOpacity>
      )}
      onRefresh={onRefresh}
      refreshing={refreshing}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80, // room for mini player
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.chromeBorder,
  },
  coverArt: {
    width: 52,
    height: 52,
    borderRadius: 6,
    backgroundColor: palette.steel,
  },
  coverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  name: {
    color: palette.frost,
    fontSize: 15,
    fontWeight: '500',
  },
  meta: {
    color: palette.silver,
    fontSize: 13,
    marginTop: 3,
  },

  // ─── Empty state ──────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyText: {
    color: palette.frost,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: palette.silver,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },

  // ─── Skeleton ─────────
  skeleton: {
    backgroundColor: withAlpha(palette.silver, 0.15),
  },
  skeletonText: {
    height: 12,
    borderRadius: 4,
    backgroundColor: withAlpha(palette.silver, 0.15),
  },
});
