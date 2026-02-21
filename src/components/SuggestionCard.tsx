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
    <View style={styles.card}>
      {/* Album art */}
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artPlaceholder]}>
          <Ionicons name="musical-note" size={16} color={colors.text.muted} />
        </View>
      )}

      {/* Track info */}
      <View style={styles.info}>
        <Text variant="label" color={colors.text.primary} numberOfLines={1}>
          {track.title}
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
          {track.artist}
        </Text>
        <View style={styles.suggestedRow}>
          <Ionicons name="person-outline" size={10} color={colors.text.muted} />
          <Text variant="labelSmall" color={colors.text.muted} style={{ marginLeft: 3 }}>
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
        <Ionicons name="checkmark" size={20} color={colors.action.primary} />
      </TouchableOpacity>

      {/* Reject */}
      <TouchableOpacity
        style={styles.rejectBtn}
        onPress={() => onReject(track.id)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Reject ${track.title} by ${track.artist}`}
      >
        <Ionicons name="close" size={20} color={colors.action.destructive} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
    borderWidth: 1,
    borderColor: colors.action.primary + '20',
    borderStyle: 'dashed',
    backgroundColor: colors.action.primary + '06',
    marginBottom: spacing.sm,
  },
  art: {
    width: 40, height: 40, borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input,
    marginRight: spacing.sm,
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  approveBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.action.primary + '18',
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.xs,
  },
  rejectBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.action.destructive + '18',
    alignItems: 'center', justifyContent: 'center',
  },
});

export default SuggestionCard;
