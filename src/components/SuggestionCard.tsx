/**
 * Suggestion Card — Spotlight mode pending track for host approval.
 *
 * Shows: album art, title, artist, who suggested, approve/reject buttons.
 * Only rendered for the host when roomMode === 'spotlight'.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { QueueTrack } from '../types';

export interface SuggestionCardProps {
  track: QueueTrack;
  onApprove: (trackId: string) => void;
  onReject: (trackId: string) => void;
}

export function SuggestionCard({ track, onApprove, onReject }: SuggestionCardProps) {
  const addedByName = track.addedBy?.username || 'someone';
  return (
    <View style={suggestionStyles.card}>
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={suggestionStyles.art} />
      ) : (
        <View style={[suggestionStyles.art, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text variant="labelSmall" color={colors.text.muted}>{track.artist.charAt(0)}</Text>
        </View>
      )}
      <View style={suggestionStyles.info}>
        <Text variant="label" color={colors.text.primary} numberOfLines={1}>{track.title}</Text>
        <Text variant="bodySmall" color={colors.text.muted} numberOfLines={1}>
          {track.artist} \u00b7 suggested by {addedByName}
        </Text>
      </View>
      <TouchableOpacity style={suggestionStyles.approveBtn} onPress={() => onApprove(track.id)} activeOpacity={0.7}>
        <Text variant="labelLarge" color={colors.action.primary}>\u2713</Text>
      </TouchableOpacity>
      <TouchableOpacity style={suggestionStyles.rejectBtn} onPress={() => onReject(track.id)} activeOpacity={0.7}>
        <Text variant="labelLarge" color={colors.action.destructive}>\u2715</Text>
      </TouchableOpacity>
    </View>
  );
}

const suggestionStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.bg.elevated,
    marginBottom: spacing.sm,
  },
  art: {
    width: 36, height: 36, borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input, alignItems: 'center',
    justifyContent: 'center', marginRight: spacing.sm,
  },
  info: { flex: 1, marginRight: spacing.sm },
  approveBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.action.primary + '20',
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs,
  },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.action.destructive + '20',
    alignItems: 'center', justifyContent: 'center',
  },
});

export default SuggestionCard;
