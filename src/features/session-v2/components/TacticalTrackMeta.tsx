import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { QueueTrack } from '../../../types';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalTrackMetaProps {
  track: QueueTrack | null;
}

export function TacticalTrackMeta({ track }: TacticalTrackMetaProps) {
  const idle = !track;
  const title = track?.title || 'NO TRACK PATCHED';
  const artistLine = track ? `${track.artist} // ${track.title}` : 'SEARCH // ADD TRACKS';
  const patchedBy = track?.addedBy?.username || 'SYSTEM';

  return (
    <View style={styles.container}>
      <View style={[styles.rail, idle && styles.railIdle]} />
      <View style={styles.content}>
        <Text style={[styles.title, idle && styles.titleIdle]} numberOfLines={2}>
          {title.toUpperCase()}
        </Text>
        <Text style={[styles.artist, idle && styles.artistIdle]} numberOfLines={1}>
          {artistLine}
        </Text>
        <View style={[styles.patchBadge, idle && styles.patchBadgeIdle]}>
          <View style={styles.patchIndicator} />
          <Text style={styles.patchLabel}>PATCHED IN BY:</Text>
          <Text style={styles.patchName}>@{patchedBy}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tacticalTokens.spacing.sm,
    marginHorizontal: tacticalTokens.spacing.xl,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rail: {
    width: 4,
    minHeight: 70,
    backgroundColor: tacticalTokens.colors.ice,
    marginRight: tacticalTokens.spacing.sm,
  },
  railIdle: {
    minHeight: 62,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.hero,
    lineHeight: tacticalTokens.fontSize.hero + 1,
    color: tacticalTokens.colors.white,
  },
  titleIdle: {
    fontSize: tacticalTokens.fontSize.title + 2,
    lineHeight: tacticalTokens.fontSize.title + 4,
  },
  artist: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.body + 1,
    color: tacticalTokens.colors.ice,
  },
  artistIdle: {
    marginTop: 2,
  },
  patchBadge: {
    marginTop: tacticalTokens.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: 6,
    backgroundColor: tacticalTokens.colors.matte,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
  },
  patchBadgeIdle: {
    marginTop: 2,
  },
  patchIndicator: {
    width: 12,
    height: 12,
    backgroundColor: tacticalTokens.colors.white,
    marginRight: tacticalTokens.spacing.sm,
  },
  patchLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.2,
    marginRight: tacticalTokens.spacing.sm,
  },
  patchName: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
  },
});

export default TacticalTrackMeta;
