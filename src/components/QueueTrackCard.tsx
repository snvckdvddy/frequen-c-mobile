/**
 * Queue Track Card — Individual track in the queue list.
 *
 * Sprint 3: Mode-aware queue UI.
 * - Open Floor: vote controls prominent, "Votes reorder" hint
 * - Campfire: vote controls dimmed, cosmetic label (votes don't reorder)
 * - Spotlight: votes hidden entirely (host curates)
 * - Ionicons replace emoji hearts for consistency
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import type { QueueTrack, Track, RoomMode, RoomBehaviors } from '../types';
import { DEFAULT_BEHAVIORS } from '../types';

// ─── Queue Track Card ────────────────────────────────────────

export interface QueueTrackCardProps {
  track: QueueTrack;
  isNowPlaying: boolean;
  onVote: (trackId: string, direction: 1 | -1) => void;
  userId?: string;
  /** @deprecated Use behaviors instead */
  roomMode?: RoomMode;
  behaviors?: RoomBehaviors;
  isHost?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (track: Track) => void;
  onMoveUp?: (trackId: string) => void;
  onMoveDown?: (trackId: string) => void;
  showReorder?: boolean;
  /** §5.1: Long press → context menu */
  onLongPress?: () => void;
  /** §5.1: Show drag handle grip for reorder */
  showDragHandle?: boolean;
  /** True while this card is being actively dragged */
  isDragging?: boolean;
}

export function QueueTrackCard({
  track, isNowPlaying, onVote, userId, behaviors,
  isHost = false, isFavorite, onToggleFavorite,
  onMoveUp, onMoveDown, showReorder = false, onLongPress,
  showDragHandle = false, isDragging = false,
}: QueueTrackCardProps) {
  const borderColor = isNowPlaying ? palette.green : palette.chromeBorder;
  const bg = isNowPlaying ? palette.green + '10' : palette.steel;
  const isOwn = track.addedById === userId;
  const votes = track.votes ?? 0;
  const userVote = userId ? (track.votedBy?.[userId] ?? 0) : 0;
  const voltageBoost = track.voltageBoost ?? 0;
  const addedByName = track.addedBy?.username || 'someone';

  // Behavior-driven flags (replacing rigid mode checks)
  const b = behaviors || DEFAULT_BEHAVIORS;
  const showVotes = true; // Always show votes — they may or may not reorder
  const votesAreCosmetic = !b.voteReordersQueue; // When votes don't reorder, they're cosmetic

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${track.title} by ${track.artist}${isNowPlaying ? ', now playing' : ''}${track.status === 'pending' ? ', pending approval' : ''}, ${votes} votes`}
      accessibilityHint={onLongPress ? 'Long press for track options' : undefined}
      style={({ pressed }) => [
        trackStyles.card,
        { borderColor, backgroundColor: bg },
        pressed && { opacity: 0.85 },
      ]}
    >
      {/* §5.1: Drag handle grip — visible when reorder enabled */}
      {showDragHandle && (
        <View style={trackStyles.dragHandle} accessibilityLabel="Drag to reorder" accessibilityRole="adjustable">
          <Ionicons name="reorder-three" size={20} color={isDragging ? palette.orange : palette.slate} />
        </View>
      )}

      {/* Album art */}
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={trackStyles.art} />
      ) : (
        <View style={[trackStyles.art, { backgroundColor: palette.steel, alignItems: 'center', justifyContent: 'center' }]}>
          <Text variant="labelSmall" color={palette.slate}>{track.artist.charAt(0)}</Text>
        </View>
      )}

      <View style={trackStyles.body}>
        <View style={trackStyles.info}>
          <View style={trackStyles.titleRow}>
            <Text variant="labelLarge" color={palette.frost} numberOfLines={1} style={{ flex: 1 }}>
              {track.title}
            </Text>
            {isNowPlaying && (
              <View style={trackStyles.nowPlayingBadge}>
                <Text variant="labelSmall" color={palette.green}>NOW</Text>
              </View>
            )}
          </View>
          <Text variant="bodySmall" color={palette.silver} numberOfLines={1}>
            {track.artist}{track.album ? ` · ${track.album}` : ''}
          </Text>
          <View style={trackStyles.metaRow}>
            <Text variant="labelSmall" color={isOwn ? palette.silver : palette.orange}>
              {isOwn ? 'You added this' : `Added by ${addedByName}`}
            </Text>
            {voltageBoost > 0 && (
              <View style={trackStyles.voltageBadge}>
                <Text variant="labelSmall" color={palette.orange}>+{voltageBoost}</Text>
              </View>
            )}
            {/* Spotlight: pending status for tracks awaiting approval */}
            {track.status === 'pending' && (
              <View style={trackStyles.pendingBadge}>
                <Text variant="labelSmall" color={palette.slate}>Pending</Text>
              </View>
            )}
          </View>
        </View>

        {/* Reorder controls (shown on long-press) */}
        {showReorder && !isNowPlaying && (
          <View style={trackStyles.reorderRow}>
            {onMoveUp && (
              <TouchableOpacity style={trackStyles.reorderBtn} onPress={() => onMoveUp(track.id)} activeOpacity={0.6}>
                <Text variant="labelSmall" color={palette.silver}>Move Up</Text>
              </TouchableOpacity>
            )}
            {onMoveDown && (
              <TouchableOpacity style={trackStyles.reorderBtn} onPress={() => onMoveDown(track.id)} activeOpacity={0.6}>
                <Text variant="labelSmall" color={palette.silver}>Move Down</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions row: mode-aware vote controls + favorite */}
        <View style={trackStyles.actionsRow}>
          {/* Vote controls — mode-differentiated */}
          {showVotes ? (
            <View style={trackStyles.voteGroup}>
              <TouchableOpacity
                style={[
                  trackStyles.voteBtn,
                  userVote === 1 && trackStyles.voteBtnActive,
                  votesAreCosmetic && trackStyles.voteBtnCosmetic,
                ]}
                onPress={() => onVote(track.id, 1)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={`Upvote${userVote === 1 ? ', currently upvoted' : ''}`}
                accessibilityState={{ selected: userVote === 1 }}
              >
                <Ionicons
                  name="chevron-up"
                  size={16}
                  color={userVote === 1 ? palette.orange : (votesAreCosmetic ? palette.slate + '80' : palette.slate)}
                />
              </TouchableOpacity>
              <Text
                variant="labelSmall"
                color={
                  votes > 0 ? palette.orange
                    : votes < 0 ? palette.red
                      : palette.slate
                }
                style={votesAreCosmetic ? { opacity: 0.6 } : undefined}
              >
                {votes}
              </Text>
              <TouchableOpacity
                style={[
                  trackStyles.voteBtn,
                  userVote === -1 && trackStyles.voteBtnActive,
                  votesAreCosmetic && trackStyles.voteBtnCosmetic,
                ]}
                onPress={() => onVote(track.id, -1)}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={`Downvote${userVote === -1 ? ', currently downvoted' : ''}`}
                accessibilityState={{ selected: userVote === -1 }}
              >
                <Ionicons
                  name="chevron-down"
                  size={16}
                  color={userVote === -1 ? palette.red : (votesAreCosmetic ? palette.slate + '80' : palette.slate)}
                />
              </TouchableOpacity>

              {/* Reorder hint — shown when votes actually reorder queue */}
              {b.voteReordersQueue && votes !== 0 && (
                <Ionicons name="swap-vertical" size={12} color={palette.slate} style={{ marginLeft: 4, opacity: 0.5 }} />
              )}
            </View>
          ) : (
            /* Spotlight: no votes, show curated indicator */
            <View style={trackStyles.curatedIndicator}>
              <Ionicons name="shield-checkmark-outline" size={14} color={palette.slate} />
              <Text variant="labelSmall" color={palette.slate} style={{ marginLeft: 4 }}>
                {isHost ? 'Curated' : 'Host curated'}
              </Text>
            </View>
          )}

          {/* Favorite — Ionicons instead of emoji */}
          {onToggleFavorite && (
            <TouchableOpacity
              style={trackStyles.favoriteBtn}
              onPress={() => onToggleFavorite(track)}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              accessibilityState={{ selected: !!isFavorite }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={18}
                color={isFavorite ? palette.orange : palette.slate}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const trackStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', padding: spacing.md, minHeight: 80,
    borderRadius: spacing.radius.md, borderWidth: 1,
    marginBottom: spacing.xs,
    borderColor: 'transparent',
    backgroundColor: palette.steel,
  },
  dragHandle: {
    width: 28, height: '100%' as any, alignItems: 'center', justifyContent: 'center',
    marginRight: 4, opacity: 0.6,
  },
  art: {
    width: 56, height: 56, borderRadius: spacing.radius.md,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  body: { flex: 1 },
  info: { marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  nowPlayingBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    backgroundColor: palette.green + '20',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  voltageBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
    backgroundColor: palette.orange + '15',
  },
  pendingBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
    backgroundColor: palette.slate + '15',
  },
  actionsRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: spacing.xs,
  },
  voteGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  voteBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  voteBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  voteBtnCosmetic: {
    opacity: 0.5,
  },
  curatedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteBtn: {
    width: 36, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  reorderRow: {
    flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    borderTopWidth: 1, borderTopColor: palette.chromeBorder,
  },
  reorderBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderRadius: spacing.radius.sm, backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

export default QueueTrackCard;
