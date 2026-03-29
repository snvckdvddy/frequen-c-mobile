import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { QueueTrack } from '../../../types';
import { tacticalTokens } from '../theme/tacticalTokens';
import { getSourceColor, getSourceLabel } from '../../../design/tokens/sourceColors';

interface TacticalTrackMetaProps {
  track: QueueTrack | null;
  voltage?: number;
  onOpenPowerRouting?: () => void;
}

export function TacticalTrackMeta({
  track,
  voltage = 0,
  onOpenPowerRouting,
}: TacticalTrackMetaProps) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const idle = !track;
  const title = track?.title || 'NO TRACK PATCHED';
  const artistLine = track ? track.artist : 'SEARCH // ADD TRACKS';
  const patchState = track?.addedBy?.username ? `@${track.addedBy.username}` : 'STANDBY';
  const powerRoutingEnabled = !!track && !!onOpenPowerRouting;

  return (
    <View style={styles.container} accessible={false}>
      <View style={[styles.rail, idle && styles.railIdle]} />
      <View style={styles.content}>
        <Text style={[styles.title, compact && styles.titleCompact, idle && styles.titleIdle]} numberOfLines={2}>
          {title.toUpperCase()}
        </Text>
        <Text style={[styles.artist, compact && styles.artistCompact, idle && styles.artistIdle]} numberOfLines={1}>
          {artistLine}
        </Text>
        <View style={styles.footerRow}>
          <View style={[styles.patchBadge, compact && styles.patchBadgeCompact, idle && styles.patchBadgeIdle]}>
            {!idle && track?.source ? (
              <View style={[styles.patchIndicator, { backgroundColor: getSourceColor(track.source) }]}>
                <Text style={styles.sourceTag}>{getSourceLabel(track.source)}</Text>
              </View>
            ) : (
              <View style={[styles.patchIndicator, idle && styles.patchIndicatorIdle]} />
            )}
            <Text style={[styles.patchLabel, idle && styles.patchLabelIdle]}>
              {idle ? 'PATCH' : 'PATCHED'}
            </Text>
            <Text style={[styles.patchName, compact && styles.patchNameCompact, idle && styles.patchNameIdle]} numberOfLines={1}>
              {patchState}
            </Text>
          </View>

          <Pressable
            onPress={onOpenPowerRouting}
            disabled={!powerRoutingEnabled}
            style={({ pressed }) => [
              styles.powerPill,
              compact && styles.powerPillCompact,
              !powerRoutingEnabled && styles.powerPillDisabled,
              pressed && powerRoutingEnabled && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open power routing with ${voltage} volts available`}
            accessibilityState={{ disabled: !powerRoutingEnabled }}
          >
            <Ionicons
              name="flash-outline"
              size={13}
              color={powerRoutingEnabled ? tacticalTokens.colors.ice : tacticalTokens.colors.textSoft}
            />
            <Text style={[styles.powerValue, !powerRoutingEnabled && styles.powerValueDisabled]}>
              {String(voltage).padStart(3, '0')}V
            </Text>
            <Text style={[styles.powerUnit, !powerRoutingEnabled && styles.powerUnitDisabled]}>CV</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tacticalTokens.spacing.xs + 2,
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
    minHeight: 70,
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
    fontSize: tacticalTokens.fontSize.hero,
    lineHeight: tacticalTokens.fontSize.hero + 1,
  },
  titleCompact: {
    fontSize: tacticalTokens.fontSize.display,
    lineHeight: tacticalTokens.fontSize.display + 1,
  },
  artist: {
    marginTop: 3,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.ice,
    letterSpacing: 0.4,
  },
  artistCompact: {
    fontSize: tacticalTokens.fontSize.small + 1,
  },
  artistIdle: {
    marginTop: 3,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.guideSoft,
  },
  footerRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
  },
  patchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    paddingHorizontal: tacticalTokens.spacing.xs + 2,
    paddingVertical: 4,
    backgroundColor: tacticalTokens.colors.matte,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
  },
  patchBadgeCompact: {
    paddingHorizontal: tacticalTokens.spacing.xs,
    paddingVertical: 3,
  },
  patchBadgeIdle: {
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  patchIndicator: {
    minWidth: 10,
    height: 10,
    backgroundColor: tacticalTokens.colors.white,
    marginRight: tacticalTokens.spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patchIndicatorIdle: {
    backgroundColor: tacticalTokens.colors.textSoft,
  },
  sourceTag: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 6,
    color: tacticalTokens.colors.void,
    letterSpacing: 0.5,
    paddingHorizontal: 2,
  },
  patchLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1,
    marginRight: tacticalTokens.spacing.xs + 2,
  },
  patchLabelIdle: {
    color: tacticalTokens.colors.textDim,
  },
  patchName: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys + 1,
    color: tacticalTokens.colors.white,
  },
  patchNameCompact: {
    fontSize: tacticalTokens.fontSize.sys,
  },
  patchNameIdle: {
    color: tacticalTokens.colors.textMuted,
  },
  powerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.xs,
    minHeight: 32,
    paddingHorizontal: tacticalTokens.spacing.sm + 2,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    borderRadius: tacticalTokens.radius.sharp,
    backgroundColor: '#051419',
  },
  powerPillCompact: {
    minHeight: 30,
    paddingHorizontal: tacticalTokens.spacing.sm,
  },
  powerPillDisabled: {
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  powerValue: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.1,
  },
  powerValueDisabled: {
    color: tacticalTokens.colors.textMuted,
  },
  powerUnit: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.1,
  },
  powerUnitDisabled: {
    color: tacticalTokens.colors.textMuted,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
});

export default TacticalTrackMeta;
