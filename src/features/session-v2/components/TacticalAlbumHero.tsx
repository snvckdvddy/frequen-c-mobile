import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { QueueTrack } from '../../../types';
import type { TacticalReadoutValues } from '../types';
import TacticalLCDOverlay from './TacticalLCDOverlay';
import TacticalGridBackground from './TacticalGridBackground';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalAlbumHeroProps {
  track: QueueTrack | null;
  readout: TacticalReadoutValues;
}

export function TacticalAlbumHero({ track, readout }: TacticalAlbumHeroProps) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const idle = !track;
  const heroSize = Math.min(width - (compact ? 48 : 56), compact ? 292 : 308);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]} pointerEvents="none" accessible={false}>
      <View style={[styles.frame, { width: heroSize, height: heroSize }]}>
        {track?.albumArt ? (
          <Image source={{ uri: track.albumArt }} style={styles.art} />
        ) : (
          <View style={styles.placeholder}>
            <TacticalGridBackground opacity={0.85} />
            <View style={styles.idlePlate}>
              <Text style={styles.placeholderText}>OUTPUT IDLE</Text>
              <Text style={styles.placeholderSubtext}>PATCH A TRACK TO PRIME OUTPUT</Text>
            </View>
          </View>
        )}

        <View style={[styles.overlay, compact && styles.overlayCompact]}>
          <TacticalLCDOverlay values={readout} dimmed={idle} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: tacticalTokens.spacing.xs + 2,
    paddingHorizontal: tacticalTokens.spacing.xl,
  },
  wrapCompact: {
    marginTop: 4,
    paddingHorizontal: tacticalTokens.spacing.lg,
  },
  frame: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
    overflow: 'hidden',
    backgroundColor: tacticalTokens.colors.matte,
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
  idlePlate: {
    minWidth: '68%',
    minHeight: 68,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingVertical: tacticalTokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 2,
  },
  placeholderSubtext: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
  },
  overlay: {
    position: 'absolute',
    top: tacticalTokens.spacing.xs,
    right: tacticalTokens.spacing.xs,
  },
  overlayCompact: {
    top: 6,
    right: 6,
  },
});

export default TacticalAlbumHero;
