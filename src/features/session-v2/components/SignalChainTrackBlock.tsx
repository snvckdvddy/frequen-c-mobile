import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../../theme/theme';
import type { SignalChainItem, SignalChainVisualMode } from '../types';

interface SignalChainTrackBlockProps {
  item: SignalChainItem;
  mode: SignalChainVisualMode;
  onLongPress?: () => void;
  onVote: (trackId: string, direction: 1 | -1) => void;
  onApprove: (trackId: string) => void;
  onReject: (trackId: string) => void;
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getBlockVisuals(item: SignalChainItem, mode: SignalChainVisualMode) {
  if (item.isPending) {
    return {
      borderColor: theme.colors.textDim,
      stripColor: theme.colors.void,
      backgroundColor: withAlpha(theme.colors.void, 0.92),
      opacity: 0.92,
      borderStyle: 'dashed' as const,
      titleColor: theme.colors.textDim,
      metaColor: theme.colors.textDim,
    };
  }

  if (mode === 'campfire' && item.isCurrent) {
    return {
      borderColor: theme.colors.electricOrange,
      stripColor: theme.colors.electricOrange,
      backgroundColor: theme.colors.matteGrey,
      opacity: 1,
      borderStyle: 'solid' as const,
      titleColor: theme.colors.textPure,
      metaColor: theme.colors.textDim,
    };
  }

  if (mode === 'openFloor' && item.voteHeat === 'high') {
    return {
      borderColor: theme.colors.acidGreen,
      stripColor: theme.colors.acidGreen,
      backgroundColor: theme.colors.matteGrey,
      opacity: 1,
      borderStyle: 'solid' as const,
      titleColor: theme.colors.textPure,
      metaColor: theme.colors.textDim,
    };
  }

  if (mode === 'openFloor' && item.voteHeat === 'low') {
    return {
      borderColor: theme.colors.borderLight,
      stripColor: theme.colors.void,
      backgroundColor: theme.colors.matteGrey,
      opacity: 0.4,
      borderStyle: 'solid' as const,
      titleColor: theme.colors.textPure,
      metaColor: theme.colors.textDim,
    };
  }

  return {
    borderColor: theme.colors.borderLight,
    stripColor: theme.colors.void,
    backgroundColor: theme.colors.matteGrey,
    opacity: 1,
    borderStyle: 'solid' as const,
    titleColor: theme.colors.textPure,
    metaColor: theme.colors.textDim,
  };
}

function VoteTower({
  voteCount,
  voteHeat,
  onUpvote,
  onDownvote,
}: {
  voteCount: number;
  voteHeat: SignalChainItem['voteHeat'];
  onUpvote: () => void;
  onDownvote: () => void;
}) {
  const countColor = voteHeat === 'high'
    ? theme.colors.acidGreen
    : voteHeat === 'low'
      ? theme.colors.hotPink
      : theme.colors.textPure;

  return (
    <View style={styles.voteTower}>
      <Pressable onPress={onUpvote} style={({ pressed }) => [styles.voteCell, pressed && styles.voteCellPressed]}>
        <Text style={styles.voteGlyph}>▲</Text>
      </Pressable>
      <View style={styles.voteCountCell}>
        <Text style={[styles.voteCount, { color: countColor }]}>{voteCount}</Text>
      </View>
      <Pressable onPress={onDownvote} style={({ pressed }) => [styles.voteCell, pressed && styles.voteCellPressed]}>
        <Text style={styles.voteGlyph}>▼</Text>
      </Pressable>
    </View>
  );
}

export function SignalChainTrackBlock({
  item,
  mode,
  onLongPress,
  onVote,
  onApprove,
  onReject,
}: SignalChainTrackBlockProps) {
  const visuals = getBlockVisuals(item, mode);
  const voteCount = item.track.votes ?? 0;
  const patchedBy = item.track.addedBy?.username || item.track.artist || 'SYSTEM';
  const titleLabel = item.track.title.toUpperCase();
  const topLabel = item.isPending
    ? 'HOST REVIEW'
    : mode === 'openFloor'
      ? 'VOTE BUS'
      : 'PATCH';
  const wrapperStyle = [
    styles.wrapper,
    mode === 'campfire' && styles.wrapperCampfire,
    mode === 'openFloor' && styles.wrapperOpenFloor,
  ];

  return (
    <View style={wrapperStyle}>
      <Pressable
        onLongPress={item.isPending ? undefined : onLongPress}
        delayLongPress={250}
        style={({ pressed }) => [
          styles.block,
          {
            borderColor: visuals.borderColor,
            backgroundColor: visuals.backgroundColor,
            borderStyle: visuals.borderStyle,
            opacity: visuals.opacity,
          },
          pressed && !item.isPending && styles.blockPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${item.track.title} by ${item.track.artist}`}
      >
        <View
          style={[
            styles.indexStrip,
            {
              backgroundColor: visuals.stripColor,
              borderRightColor: item.isPending ? theme.colors.textDim : theme.colors.borderLight,
              borderStyle: item.isPending ? 'dashed' : 'solid',
            },
          ]}
        >
          <Text
            style={[
              styles.indexText,
              {
                color:
                  visuals.stripColor === theme.colors.electricOrange ||
                  visuals.stripColor === theme.colors.acidGreen
                    ? theme.colors.void
                    : theme.colors.textDim,
              },
            ]}
          >
            {item.indexLabel}
          </Text>
        </View>

        <View style={styles.content}>
          <View style={[styles.artBlock, item.isPending && styles.artGhost]}>
            {item.track.albumArt ? (
              <Image
                source={{ uri: item.track.albumArt }}
                style={[styles.artImage, item.isPending && styles.artImageGhost]}
              />
            ) : null}
          </View>

          <View style={styles.textWrap}>
            <Text style={[styles.blockLabel, { color: visuals.metaColor }]} numberOfLines={1}>
              {topLabel}
            </Text>
            <Text style={[styles.title, { color: visuals.titleColor }]} numberOfLines={1}>
              {titleLabel}
            </Text>
            <Text style={[styles.meta, { color: visuals.metaColor }]} numberOfLines={1}>
              PATCHED BY @{patchedBy}
            </Text>
          </View>
        </View>

        {item.showApprovalActions ? (
          <View style={styles.approvalTower}>
            <Pressable
              onPress={() => onApprove(item.track.id)}
              style={({ pressed }) => [styles.approvalCell, styles.approveCell, pressed && styles.approvalPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Approve ${item.track.title}`}
            >
              <Text style={[styles.approvalGlyph, { color: theme.colors.acidGreen }]}>✓</Text>
            </Pressable>
            <Pressable
              onPress={() => onReject(item.track.id)}
              style={({ pressed }) => [styles.approvalCell, styles.rejectCell, pressed && styles.approvalPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Reject ${item.track.title}`}
            >
              <Text style={[styles.approvalGlyph, { color: theme.colors.hotPink }]}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {item.showVoteTower ? (
          <VoteTower
            voteCount={voteCount}
            voteHeat={item.voteHeat}
            onUpvote={() => onVote(item.track.id, 1)}
            onDownvote={() => onVote(item.track.id, -1)}
          />
        ) : null}
      </Pressable>

      {item.showCampfireCable ? (
        <View
          pointerEvents="none"
          style={[
            styles.patchCable,
            { backgroundColor: item.isCurrent ? theme.colors.electricOrange : theme.colors.borderLight },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  wrapperCampfire: {
    marginBottom: theme.spacing.xs,
  },
  wrapperOpenFloor: {
    marginBottom: theme.spacing.sm,
  },
  block: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.colors.matteGrey,
    borderWidth: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  blockPressed: {
    opacity: 0.9,
  },
  indexStrip: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    backgroundColor: theme.colors.void,
  },
  indexText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    transform: [{ rotate: '-90deg' }],
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    overflow: 'hidden',
  },
  artBlock: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.matteGrey,
    flexShrink: 0,
    overflow: 'hidden',
  },
  artGhost: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  artImage: {
    width: '100%',
    height: '100%',
  },
  artImageGhost: {
    opacity: 0.22,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  blockLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    color: theme.colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: theme.fonts.display,
    fontSize: 16,
    lineHeight: 18,
    color: theme.colors.textPure,
    textTransform: 'uppercase',
  },
  meta: {
    marginTop: 4,
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  approvalTower: {
    width: 80,
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.borderLight,
  },
  approvalCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveCell: {
    backgroundColor: withAlpha(theme.colors.acidGreen, 0.1),
  },
  rejectCell: {
    backgroundColor: withAlpha(theme.colors.hotPink, 0.1),
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.borderLight,
  },
  approvalPressed: {
    opacity: 0.9,
  },
  approvalGlyph: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 18,
  },
  voteTower: {
    width: 56,
    flexDirection: 'column',
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.borderLight,
    backgroundColor: theme.colors.void,
  },
  voteCell: {
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCellPressed: {
    backgroundColor: withAlpha(theme.colors.textPure, 0.08),
  },
  voteGlyph: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
    color: theme.colors.textDim,
  },
  voteCountCell: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.void,
  },
  voteCount: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 16,
  },
  patchCable: {
    position: 'absolute',
    left: 11,
    top: '100%',
    width: 2,
    height: 8,
  },
});

export default SignalChainTrackBlock;
