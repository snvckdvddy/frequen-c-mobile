/**
 * Track List Item — Standardized track row for queue, search results, library.
 *
 * Convergence Strategy §4.1:
 * Height: 72pt
 * Art: 48×48pt, 6pt radius
 * Title: 16pt frost, single line, truncate
 * Artist: 14pt silver, single line
 * "Added by": 12pt slate (only in session context)
 * ⋯ menu: 24pt, silver, right-aligned
 */

import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { CrossMatchBadge } from './CrossMatchBadge';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';
import type { TrackSource } from '../../types';

interface TrackListItemProps {
  title: string;
  artist: string;
  albumArt?: string;
  duration?: number;
  addedBy?: string;
  /** Show drag handle for reorderable lists */
  showDragHandle?: boolean;
  /** Show context menu (⋯) button */
  showMenu?: boolean;
  /** Called when ⋯ is tapped */
  onMenuPress?: () => void;
  /** Called when the whole row is tapped */
  onPress?: () => void;
  /** Highlight as now-playing */
  isNowPlaying?: boolean;
  /** Custom right-side action (replaces menu when provided) */
  rightAction?: React.ReactNode;
  /** §5.1: Long press → open context menu sheet */
  onLongPress?: () => void;
  /**
   * Phase 5 cross-match attribution — when set, the row renders a small
   * "via {source}" chip next to the title whenever `metadataSource` differs
   * from `source`. Pass the track's `source` and `metadataSource` through
   * untouched; the chip decides whether to render based on the pair.
   */
  source?: TrackSource;
  metadataSource?: TrackSource;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TrackListItem({
  title,
  artist,
  albumArt,
  duration,
  addedBy,
  showDragHandle = false,
  showMenu = true,
  onMenuPress,
  onPress,
  isNowPlaying = false,
  rightAction,
  onLongPress,
  source,
  metadataSource,
}: TrackListItemProps) {
  return (
    <TouchableOpacity
      style={[styles.container, isNowPlaying && styles.nowPlaying]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.7}
      disabled={!onPress && !onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${title} by ${artist}${isNowPlaying ? ', now playing' : ''}${addedBy ? `, added by ${addedBy}` : ''}`}
      accessibilityHint={onLongPress ? 'Long press to open track options' : undefined}
    >
      {/* Drag handle (curator only) */}
      {showDragHandle && (
        <View style={styles.dragHandle} accessibilityLabel="Drag to reorder" accessibilityRole="adjustable">
          <Ionicons name="menu" size={16} color={palette.slate} />
        </View>
      )}

      {/* Album art */}
      {albumArt ? (
        <Image source={{ uri: albumArt }} style={styles.art} accessible={false} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Ionicons name="musical-note" size={20} color={palette.slate} />
        </View>
      )}

      {/* Track info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text
            variant="body"
            color={isNowPlaying ? palette.orange : palette.frost}
            numberOfLines={1}
            style={styles.titleText}
          >
            {title}
          </Text>
          <CrossMatchBadge source={source} metadataSource={metadataSource} />
        </View>
        <Text variant="bodySmall" color={palette.silver} numberOfLines={1}>
          {artist}{duration ? ` · ${formatDuration(duration)}` : ''}
        </Text>
        {addedBy && (
          <Text variant="labelSmall" color={palette.slate} numberOfLines={1}
                style={{ textTransform: 'none', letterSpacing: 0 }}>
            Added by @{addedBy}
          </Text>
        )}
      </View>

      {/* Right action slot or context menu */}
      {rightAction ? (
        rightAction
      ) : showMenu ? (
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={onMenuPress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${title}`}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={palette.silver} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  nowPlaying: {
    backgroundColor: 'rgba(100, 255, 218, 0.1)',
  },
  dragHandle: {
    width: 24,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: palette.midnight,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    flexShrink: 1,
    minWidth: 0,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TrackListItem;
