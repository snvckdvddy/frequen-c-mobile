import React from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { QueueTrack } from '../../../types';
import type { TacticalReadoutValues } from '../types';
import TacticalLCDOverlay from './TacticalLCDOverlay';
import TacticalGridBackground from './TacticalGridBackground';
import { tacticalTokens } from '../theme/tacticalTokens';

const HERO_SIZE = Math.min(Dimensions.get('window').width - 56, 320);

interface TacticalAlbumHeroProps {
  track: QueueTrack | null;
  readout: TacticalReadoutValues;
}

export function TacticalAlbumHero({ track, readout }: TacticalAlbumHeroProps) {
  const idle = !track;

  return (
    <View style={styles.wrap}>
      <View style={[styles.frame, idle && styles.idleFrame]}>
        {track?.albumArt ? (
          <Image source={{ uri: track.albumArt }} style={styles.art} />
        ) : (
          <View style={styles.placeholder}>
            <TacticalGridBackground opacity={0.85} />
            <Text style={styles.placeholderText}>NO SIGNAL</Text>
            <Text style={styles.placeholderSubtext}>PATCH A TRACK TO PRIME OUTPUT</Text>
          </View>
        )}

        <View style={styles.overlay}>
          <TacticalLCDOverlay values={readout} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: tacticalTokens.spacing.sm,
    paddingHorizontal: tacticalTokens.spacing.xl,
  },
  frame: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
    overflow: 'hidden',
    backgroundColor: tacticalTokens.colors.matte,
  },
  idleFrame: {
    height: Math.round(HERO_SIZE * 0.58),
  },
  art: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.acid,
    letterSpacing: 2,
  },
  placeholderSubtext: {
    marginTop: tacticalTokens.spacing.sm,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.3,
  },
  overlay: {
    position: 'absolute',
    top: tacticalTokens.spacing.xs,
    right: tacticalTokens.spacing.xs,
  },
});

export default TacticalAlbumHero;
