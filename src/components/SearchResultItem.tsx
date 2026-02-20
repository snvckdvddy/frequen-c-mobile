/**
 * Search Result Item — Single track result from iTunes search.
 *
 * Shows album art, title, artist, and "+" / "Added" toggle button.
 * "Added" state resets after 2s so the same track can be re-added.
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { Track } from '../types';

export interface SearchResultItemProps {
  track: Track;
  onAdd: (t: Track) => void;
}

export function SearchResultItem({ track, onAdd }: SearchResultItemProps) {
  const [added, setAdded] = useState(false);
  const handlePress = () => {
    if (added) return;
    onAdd(track);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (
    <TouchableOpacity style={searchStyles.item} onPress={handlePress} activeOpacity={0.7}>
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={searchStyles.art} />
      ) : (
        <View style={[searchStyles.art, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text variant="labelSmall" color={colors.text.muted}>{track.artist.charAt(0)}</Text>
        </View>
      )}
      <View style={searchStyles.info}>
        <Text variant="label" color={colors.text.primary} numberOfLines={1}>{track.title}</Text>
        <Text variant="bodySmall" color={colors.text.muted} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Text variant="labelLarge" color={added ? colors.text.muted : colors.action.primary}>
        {added ? 'Added' : '+'}
      </Text>
    </TouchableOpacity>
  );
}

const searchStyles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.xs,
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  art: {
    width: 36, height: 36, borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input, alignItems: 'center',
    justifyContent: 'center', marginRight: spacing.sm,
  },
  info: { flex: 1, marginRight: spacing.sm },
});

export default SearchResultItem;
