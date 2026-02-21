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
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { QueueTrack, Track, RoomMode } from '../types';

// ─── Queue Track Card ────────────────────────────────────────

export interface QueueTrackCardProps {
  track: QueueTrack;
  isNowPlaying: boolean;
  onVote: (trackId: string, direction: 1 | -1) => void;
  userId?: string;
  roomMode?: RoomMode;
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
  track, isNowPlaying, onVote, userId, roomMode = 'campfire',
  isHost = false, isFavorite, onToggleFavorite,
  onMoveUp, onMoveDown, showReorder = false, onLongPress,
  showDragHandle = false, isDragging = false,
}: QueueTrackCardProps) {
  const borderColor = isNowPlaying ? colors.queue.nowPlaying : colors.border.subtle;
  const bg = isNowPlaying ? colors.queue.nowPlaying + '10' : colors.bg.elevated;
  const isOwn = track.addedById === userId;
  const votes = track.votes ?? 0;
  const userVote = userId ? (track.votedBy?.[userId] ?? 0) : 0;
  const voltageBoost = track.voltageBoost ?? 0;
  const addedByName = track.addedBy?.username || 'someone';

  // Mode-specific flags
  const isOpenFloor = roomMode === 'openFloor';
  const isSpotlight = roomMode === 'spotlight';
  const isCampfire = roomMode === 'campfire';
  const showVotes = !isSpotlight; // Spotlight hides votes entirely
  const votesAreCosmetic = isCampfire; // Campfire votes don't reorder

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
          <Ionicons name="reorder-three" size={20} color={isDragging ? colors.action.primary : colors.text.muted} />
        </View>
      )}

      {/* Album art */}
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={trackStyles.art} />
      ) : (
        <View style={[trackStyles.art, { backgroundColor: colors.bg.input, alignItems: 'center', justifyContent: 'center' }]}>
          <Text variant="labelSmall" color={colors.text.muted}>{track.artist.charAt(0)}</Text>
        </View>
      )}

      <View style={trackStyles.body}>
        <View style={trackStyles.info}>
          <View style={trackStyles.titleRow}>
            <Text variant="labelLarge" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
              {track.title}
            </Text>
            {isNowPlaying && (
              <View style={trackStyles.nowPlayingBadge}>
                <Text variant="labelSmall" color={colors.queue.nowPlaying}>NOW</Text>
              </View>
            )}
          </View>
          <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
            {track.artist}{track.album ? ` · ${track.album}` : ''}
          </Text>
          <View style={trackStyles.metaRow}>
            <Text variant="labelSmall" color={isOwn ? colors.queue.myTrack : colors.contribution.recent}>
              {isOwn ? 'You added this' : `Added by ${addedByName}`}
            </Text>
            {voltageBoost > 0 && (
              <View style={trackStyles.voltageBadge}>
                <Text variant="labelSmall" color={colors.voltage.charge}>+{voltageBoost}</Text>
              </View>
            )}
            {/* Spotlight: pending status for tracks awaiting approval */}
            {track.status === 'pending' && (
              <View style={trackStyles.pendingBadge}>
                <Text variant="labelSmall" color={colors.text.muted}>Pending</Text>
              </View>
            )}
          </View>
        </View>

        {/* Reorder controls (shown on long-press) */}
        {showReorder && !isNowPlaying && (
          <View style={trackStyles.reorderRow}>
            {onMoveUp && (
              <TouchableOpacity style={trackStyles.reorderBtn} onPress={() => onMoveUp(track.id)} activeOpacity={0.6}>
                <Text variant="labelSmall" color={colors.text.secondary}>Move Up</Text>
              </TouchableOpacity>
            )}
            {onMoveDown && (
              <TouchableOpacity style={trackStyles.reorderBtn} onPress={() => onMoveDown(track.id)} activeOpacity={0.6}>
                <Text variant="labelSmall" color={colors.text.secondary}>Move Down</Text>
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
                  color={userVote === 1 ? colors.action.primary : (votesAreCosmetic ? colors.text.muted + '80' : colors.text.muted)}
                />
              </TouchableOpacity>
              <Text
                variant="labelSmall"
                color={
                  votes > 0 ? colors.action.primary
                    : votes < 0 ? colors.action.destructive
                    : colors.text.muted
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
                  color={userVote === -1 ? colors.action.destructive : (votesAreCosmetic ? colors.text.muted + '80' : colors.text.muted)}
                />
              </TouchableOpacity>

              {/* Mode hint — only on Open Floor */}
              {isOpenFloor && votes !== 0 && (
                <Ionicons name="swap-vertical" size={12} color={colors.text.muted} style={{ marginLeft: 4, opacity: 0.5 }} />
              )}
            </View>
          ) : (
            /* Spotlight: no votes, show curated indicator */
            <View style={trackStyles.curatedIndicator}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.text.muted} />
              <Text variant="labelSmall" color={colors.text.muted} style={{ marginLeft: 4 }}>
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
                color={isFavorite ? colors.action.primary : colors.text.muted}
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
    flexDirection: 'row', padding: spacing.sm, minHeight: 72,
    borderRadius: spacing.radius.md, borderWidth: 1,
    marginBottom: 0,                         // Use divider instead of gap
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default, // Visible 1pt dark steel divider between items
  },
  dragHandle: {
    width: 28, height: '100%' as any, alignItems: 'center', justifyContent: 'center',
    marginRight: 4, opacity: 0.6,
  },
  art: {
    width: 48, height: 48, borderRadius: spacing.radius.sm,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  body: { flex: 1 },
  info: { marginBottom: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nowPlayingBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    backgroundColor: colors.queue.nowPlaying + '20',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  voltageBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
    backgroundColor: colors.voltage.charge + '15',
  },
  pendingBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
    backgroundColor: colors.text.muted + '15',
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
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  reorderBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 6,
    borderRadius: spacing.radius.sm, backgroundColor: 'rgba(255,255,255,0.06)',
  },
});

export default QueueTrackCard;
