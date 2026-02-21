/**
 * Played History — "Recently Played" footer for the queue list.
 *
 * Shows the last N tracks that were played with album art,
 * title/artist, and a re-queue button.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { QueueTrack, Track } from '../types';

export interface PlayedHistoryProps {
  history: QueueTrack[];
  /** Max tracks to show (default 5) */
  limit?: number;
  onRequeue: (track: Track) => void;
}

export function PlayedHistory({ history, limit = 5, onRequeue }: PlayedHistoryProps) {
  if (history.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="labelSmall" color={colors.text.muted} style={styles.title}>
        Recently Played
      </Text>
      {history.slice(0, limit).map((t) => (
        <View key={t.id + '_hist'} style={styles.item}>
          {t.albumArt ? (
            <Image source={{ uri: t.albumArt }} style={styles.art} />
          ) : (
            <View style={[styles.art, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text variant="labelSmall" color={colors.text.muted}>{t.artist.charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text variant="labelSmall" color={colors.text.muted} numberOfLines={1}>{t.title}</Text>
            <Text variant="labelSmall" color={colors.text.muted} numberOfLines={1} style={{ opacity: 0.6 }}>
              {t.artist}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onRequeue(t)}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="reload-outline" size={14} color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  title: {
    marginBottom: spacing.sm,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    opacity: 0.6,
  },
  item: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.xs,
    opacity: 0.5,
  },
  art: {
    width: 28,
    height: 28,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input,
    marginRight: spacing.sm,
  },
});

export default PlayedHistory;
