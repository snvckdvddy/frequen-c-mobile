/**
 * Queue Track Card — Individual track in the queue list.
 *
 * Shows: album art, title/artist, who added, vote controls, reactions, favorite.
 * Highlights now-playing track with accent border.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { QueueTrack, Track } from '../types';

// ─── Reaction Button ─────────────────────────────────────────

export function ReactionButton({
  emoji, color, count, onPress, active = false,
}: {
  emoji: string; color: string; count?: number; onPress: () => void; active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[reactionStyles.btn, active && { backgroundColor: color + '25', borderWidth: 1, borderColor: color + '40' }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text variant="labelSmall" color={color} style={reactionStyles.emoji}>{emoji}</Text>
      {count !== undefined && count > 0 && (
        <Text variant="labelSmall" color={color}>{count}</Text>
      )}
    </TouchableOpacity>
  );
}

export const reactionStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emoji: { fontSize: 14 },
});

// ─── Queue Track Card ────────────────────────────────────────

export interface QueueTrackCardProps {
  track: QueueTrack;
  isNowPlaying: boolean;
  onVote: (trackId: string, direction: 1 | -1) => void;
  userId?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (track: Track) => void;
  onMoveUp?: (trackId: string) => void;
  onMoveDown?: (trackId: string) => void;
  showReorder?: boolean;
}

export function QueueTrackCard({
  track, isNowPlaying, onVote, userId, isFavorite, onToggleFavorite,
  onMoveUp, onMoveDown, showReorder = false,
}: QueueTrackCardProps) {
  const borderColor = isNowPlaying ? colors.queue.nowPlaying : colors.border.subtle;
  const bg = isNowPlaying ? colors.queue.nowPlaying + '10' : colors.bg.elevated;
  const isOwn = track.addedById === userId;
  const votes = track.votes ?? 0;
  const userVote = userId ? (track.votedBy?.[userId] ?? 0) : 0;
  const voltageBoost = track.voltageBoost ?? 0;
  const addedByName = track.addedBy?.username || 'someone';

  return (
    <View style={[trackStyles.card, { borderColor, backgroundColor: bg }]}>
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
            {track.artist}{track.album ? ` \u00b7 ${track.album}` : ''}
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

        {/* Actions row: vote arrows + heart (fire/star live on MiniPlayer only) */}
        <View style={trackStyles.actionsRow}>
          <View style={trackStyles.voteGroup}>
            <TouchableOpacity
              style={[trackStyles.voteBtn, userVote === 1 && trackStyles.voteBtnActive]}
              onPress={() => onVote(track.id, 1)}
              activeOpacity={0.6}
            >
              <Text variant="labelSmall" color={userVote === 1 ? colors.action.primary : colors.text.muted}>\u25B2</Text>
            </TouchableOpacity>
            <Text
              variant="labelSmall"
              color={votes > 0 ? colors.action.primary : votes < 0 ? colors.action.destructive : colors.text.muted}
            >
              {votes}
            </Text>
            <TouchableOpacity
              style={[trackStyles.voteBtn, userVote === -1 && trackStyles.voteBtnActive]}
              onPress={() => onVote(track.id, -1)}
              activeOpacity={0.6}
            >
              <Text variant="labelSmall" color={userVote === -1 ? colors.action.destructive : colors.text.muted}>\u25BC</Text>
            </TouchableOpacity>
          </View>
          {onToggleFavorite && (
            <TouchableOpacity
              style={reactionStyles.btn}
              onPress={() => onToggleFavorite(track)}
              activeOpacity={0.6}
            >
              <Text
                variant="labelSmall"
                color={isFavorite ? colors.action.primary : colors.text.muted}
                style={reactionStyles.emoji}
              >
                {isFavorite ? '\u2665' : '\u2661'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const trackStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', padding: spacing.sm,
    borderRadius: spacing.radius.md, borderWidth: 1, marginBottom: spacing.sm,
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
  reactionGroup: { flexDirection: 'row', gap: spacing.xs },
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
