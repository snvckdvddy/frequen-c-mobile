/**
 * TrackResultCard — Search result for a track.
 *
 * Shows: album art (initial) | title, artist · album, duration · source | ♡ ＋
 * ♡ toggles favorite (solid fill on save, haptic tapLight)
 * ＋ opens AddToRoomSheet
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Text } from '../ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { tapLight } from '../../utils/haptics';
import type { Track } from '../../types';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    spotify: 'Spotify',
    appleMusic: 'Apple Music',
    soundcloud: 'SoundCloud',
    youtube: 'YouTube',
    tidal: 'Tidal',
    itunes: 'iTunes',
  };
  return map[source] || source;
}

interface TrackResultCardProps {
  track: Track;
  isFavorite: boolean;
  onToggleFavorite: (track: Track) => void;
  onAddToRoom: (track: Track) => void;
}

export function TrackResultCard({
  track,
  isFavorite,
  onToggleFavorite,
  onAddToRoom,
}: TrackResultCardProps) {
  return (
    <View style={styles.card}>
      {/* Album art */}
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={styles.art} />
      ) : (
        <View style={[styles.art, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text variant="labelSmall" color={colors.text.muted}>
            {track.artist.charAt(0)}
          </Text>
        </View>
      )}

      {/* Track info */}
      <View style={styles.info}>
        <Text variant="label" color={colors.text.primary} numberOfLines={1}>
          {track.title}
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
          {track.artist}{track.album ? ` · ${track.album}` : ''}
        </Text>
        <Text variant="labelSmall" color={colors.text.muted}>
          {formatDuration(track.duration)} · {sourceLabel(track.source)}
        </Text>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          tapLight();
          onToggleFavorite(track);
        }}
        activeOpacity={0.6}
      >
        <Text
          variant="labelLarge"
          color={isFavorite ? colors.action.primary : colors.text.muted}
          style={{ fontSize: 18 }}
        >
          {isFavorite ? '♥' : '♡'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onAddToRoom(track)}
        activeOpacity={0.6}
      >
        <Text variant="labelLarge" color={colors.action.primary} style={{ fontSize: 20 }}>
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 1,
  },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TrackResultCard;
