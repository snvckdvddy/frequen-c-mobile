/**
 * Suggestion Card — Spotlight mode pending track for host approval.
 *
 * Sprint 3: Polished with Ionicons, better visual hierarchy,
 * and swipe-hint affordance on approve/reject.
 * Only rendered for the host when roomMode === 'spotlight'.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui';
import { palette } from '../design/tokens/materials';
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
    <View style={styles.card}>
      {/* Album art */}
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={styles.art} accessible={false} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Ionicons name="musical-note" size={16} color={palette.slate} />
        </View>
      )}

      {/* Track info */}
      <View style={styles.info}>
        <Text variant="label" color={palette.frost} numberOfLines={1}>
          {track.title}
        </Text>
        <Text variant="bodySmall" color={palette.silver} numberOfLines={1}>
          {track.artist}
        </Text>
        <View style={styles.suggestedRow}>
          <Ionicons name="person-outline" size={10} color={palette.slate} />
          <Text variant="labelSmall" color={palette.slate} style={{ marginLeft: 3 }}>
            {addedByName}
          </Text>
        </View>
      </View>

      {/* Approve */}
      <TouchableOpacity
        style={styles.approveBtn}
        onPress={() => onApprove(track.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Approve ${track.title} by ${track.artist}, suggested by ${addedByName}`}
      >
        <Ionicons name="checkmark" size={20} color={palette.orange} />
      </TouchableOpacity>

      {/* Reject */}
      <TouchableOpacity
        style={styles.rejectBtn}
        onPress={() => onReject(track.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Reject ${track.title} by ${track.artist}`}
      >
        <Ionicons name="close" size={20} color={palette.red} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: palette.orange + '20',
    borderStyle: 'dashed',
    backgroundColor: palette.orange + '06',
    marginBottom: spacing.md,
  },
  art: {
    width: 48, height: 48, borderRadius: spacing.radius.sm,
    backgroundColor: palette.steel,
    marginRight: spacing.md,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginRight: spacing.md,
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  approveBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: palette.orange + '18',
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.xs,
  },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: palette.red + '18',
    alignItems: 'center', justifyContent: 'center',
  },
});

export default SuggestionCard;
