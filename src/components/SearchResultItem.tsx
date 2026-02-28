/**
 * Search Result Item — Single track result from iTunes search.
 *
 * Shows album art, title, artist, and "+" / "Added" toggle button.
 * "Added" state resets after 2s so the same track can be re-added.
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from './ui';
import { palette } from '../design/tokens/materials';
import { spacing } from '../theme/spacing';
import type { Track } from '../types';

export interface SearchResultItemProps {
  track: Track;
  onAdd: (t: Track) => boolean | void;
}

export function SearchResultItem({ track, onAdd }: SearchResultItemProps) {
  const [added, setAdded] = useState(false);
  const handlePress = () => {
    if (added) return;
    const accepted = onAdd(track);
    if (accepted === false) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  return (
    <TouchableOpacity style={searchStyles.item} onPress={handlePress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${added ? 'Added' : 'Add'} ${track.title} by ${track.artist}`} accessibilityState={{ disabled: added }}>
      {track.albumArt ? (
        <Image source={{ uri: track.albumArt }} style={searchStyles.art} />
      ) : (
        <View style={[searchStyles.art, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text variant="labelSmall" color={palette.slate}>{track.artist.charAt(0)}</Text>
        </View>
      )}
      <View style={searchStyles.info}>
        <Text variant="label" color={palette.frost} numberOfLines={1}>{track.title}</Text>
        <Text variant="bodySmall" color={palette.slate} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Text variant="labelLarge" color={added ? palette.slate : palette.orange}>
        {added ? 'Added' : '+'}
      </Text>
    </TouchableOpacity>
  );
}

const searchStyles = StyleSheet.create({
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: palette.chromeBorder,
  },
  art: {
    width: 48, height: 48, borderRadius: spacing.radius.sm,
    backgroundColor: palette.steel, alignItems: 'center',
    justifyContent: 'center', marginRight: spacing.md,
  },
  info: { flex: 1, marginRight: spacing.md },
});

export default SearchResultItem;
