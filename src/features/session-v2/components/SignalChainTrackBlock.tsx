import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { withAlpha } from '../../../design/tokens/materials';
import { getSourceColor, getSourceLabel } from '../../../design/tokens/sourceColors';
import { CrossMatchBadge } from '../../../components/ui/CrossMatchBadge';
import { tacticalTokens } from '../theme/tacticalTokens';
import type { SignalChainItem, SignalChainVisualMode } from '../types';

interface SignalChainTrackBlockProps {
  item: SignalChainItem;
  mode: SignalChainVisualMode;
  onLongPress?: () => void;
  onVote: (trackId: string, direction: 1 | -1) => void;
  onApprove: (trackId: string) => void;
  onReject: (trackId: string) => void;
}

function getBlockVisuals(item: SignalChainItem, mode: SignalChainVisualMode) {
  if (item.isPending) {
    return {
      borderColor: tacticalTokens.colors.textSoft,
      stripColor: tacticalTokens.colors.void,
      backgroundColor: withAlpha(tacticalTokens.colors.void, 0.92),
      opacity: 0.92,
      borderStyle: 'dashed' as const,
      titleColor: tacticalTokens.colors.textDim,
      metaColor: tacticalTokens.colors.textSoft,
    };
  }

  if (mode === 'campfire' && item.isCurrent) {
    return {
      borderColor: tacticalTokens.colors.orange,
      stripColor: tacticalTokens.colors.orange,
      backgroundColor: tacticalTokens.colors.matte,
      opacity: 1,
      borderStyle: 'solid' as const,
      titleColor: tacticalTokens.colors.white,
      metaColor: tacticalTokens.colors.textMuted,
    };
  }

  if (mode === 'openFloor' && item.voteHeat === 'high') {
    return {
      borderColor: tacticalTokens.colors.acid,
      stripColor: tacticalTokens.colors.acid,
      backgroundColor: tacticalTokens.colors.matte,
      opacity: 1,
      borderStyle: 'solid' as const,
      titleColor: tacticalTokens.colors.white,
      metaColor: tacticalTokens.colors.textMuted,
    };
  }

  if (mode === 'openFloor' && item.voteHeat === 'low') {
    return {
      borderColor: tacticalTokens.colors.border,
      stripColor: tacticalTokens.colors.void,
      backgroundColor: tacticalTokens.colors.matte,
      opacity: 0.4,
      borderStyle: 'solid' as const,
      titleColor: tacticalTokens.colors.white,
      metaColor: tacticalTokens.colors.textSoft,
    };
  }

  return {
    borderColor: tacticalTokens.colors.border,
    stripColor: tacticalTokens.colors.void,
    backgroundColor: tacticalTokens.colors.matte,
    opacity: 1,
    borderStyle: 'solid' as const,
    titleColor: tacticalTokens.colors.white,
    metaColor: tacticalTokens.colors.textMuted,
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
    ? tacticalTokens.colors.acid
    : voteHeat === 'low'
      ? tacticalTokens.colors.hotPink
      : tacticalTokens.colors.white;

  return (
    <View style={styles.voteTower}>
      <Pressable onPress={onUpvote} accessibilityRole="button" accessibilityLabel="Upvote track" style={({ pressed }) => [styles.voteCell, pressed && styles.voteCellPressed]}>
        <Text style={styles.voteGlyph}>▲</Text>
      </Pressable>
      <View style={styles.voteCountCell}>
        <Text style={[styles.voteCount, { color: countColor }]}>{voteCount}</Text>
      </View>
      <Pressable onPress={onDownvote} accessibilityRole="button" accessibilityLabel="Downvote track" style={({ pressed }) => [styles.voteCell, pressed && styles.voteCellPressed]}>
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
  // Track titles render in their native casing — uppercasing user content
  // (e.g. "WILL_UJUSTBEMYFKNFRIENDRICKYB...") makes them shouty and harder
  // to scan. Section labels (PATCH, NOW PATCHED, etc.) stay uppercase
  // because they're our typography choice, not user data.
  const titleLabel = item.track.title;
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
              borderRightColor: item.isPending ? tacticalTokens.colors.textDim : tacticalTokens.colors.border,
              borderStyle: item.isPending ? 'dashed' : 'solid',
            },
          ]}
        >
          <Text
            style={[
              styles.indexText,
              {
                color:
                  visuals.stripColor === tacticalTokens.colors.orange ||
                  visuals.stripColor === tacticalTokens.colors.acid
                    ? tacticalTokens.colors.void
                    : tacticalTokens.colors.textDim,
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
            <View style={styles.metaRow}>
              <View style={[styles.sourceBadge, { borderColor: getSourceColor(item.track.source) }]}>
                <Text style={[styles.sourceLabel, { color: getSourceColor(item.track.source) }]}>
                  {getSourceLabel(item.track.source)}
                </Text>
              </View>
              <CrossMatchBadge
                source={item.track.source}
                metadataSource={item.track.metadataSource}
                label="VIA SPOTIFY"
                textStyle={styles.crossMatchTacticalLabel}
              />
              <Text style={[styles.meta, { color: visuals.metaColor }]} numberOfLines={1}>
                @{patchedBy}
              </Text>
            </View>
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
              <Text style={[styles.approvalGlyph, { color: tacticalTokens.colors.acid }]}>✓</Text>
            </Pressable>
            <Pressable
              onPress={() => onReject(item.track.id)}
              style={({ pressed }) => [styles.approvalCell, styles.rejectCell, pressed && styles.approvalPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Reject ${item.track.title}`}
            >
              <Text style={[styles.approvalGlyph, { color: tacticalTokens.colors.hotPink }]}>✕</Text>
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
        ) : !item.showApprovalActions && !item.isPending && onLongPress ? (
          // Context menu affordance: discoverable tap target for the
          // remove / share / power-routing actions that previously
          // were only reachable via long-press on the row. Long-press
          // still works (kept on the outer Pressable above) — this is
          // a discoverable + accessible alternative for users who
          // don't know to try long-press. Hides itself when the row
          // is already showing approval or vote-tower controls (those
          // own the right edge in their respective modes).
          <Pressable
            onPress={onLongPress}
            style={({ pressed }) => [styles.menuTab, pressed && styles.menuTabPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Open actions for ${item.track.title}`}
            hitSlop={8}
          >
            <Text style={styles.menuGlyph}>⋮</Text>
          </Pressable>
        ) : null}
      </Pressable>

      {item.showCampfireCable ? (
        <View
          pointerEvents="none"
          style={[
            styles.patchCable,
            { backgroundColor: item.isCurrent ? tacticalTokens.colors.orange : tacticalTokens.colors.border },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    marginBottom: tacticalTokens.spacing.sm,
  },
  wrapperCampfire: {
    marginBottom: tacticalTokens.spacing.xs,
  },
  wrapperOpenFloor: {
    marginBottom: tacticalTokens.spacing.sm,
  },
  block: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: tacticalTokens.colors.matte,
    borderWidth: 1,
    borderRadius: 0,
    overflow: 'hidden',
  },
  blockPressed: {
    opacity: 0.9,
  },
  indexStrip: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    backgroundColor: tacticalTokens.colors.void,
  },
  indexText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 9,
    color: tacticalTokens.colors.textDim,
    transform: [{ rotate: '-90deg' }],
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tacticalTokens.spacing.xs + 2,
    paddingVertical: 6,
    gap: tacticalTokens.spacing.xs,
    overflow: 'hidden',
  },
  artBlock: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
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
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 8,
    color: tacticalTokens.colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: 13,
    lineHeight: 15,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
  },
  metaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceBadge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  sourceLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 7,
    letterSpacing: 0.8,
  },
  // Phase 5: tactical-font override for the shared `CrossMatchBadge`
  // primitive. The base chip owns color + shape (orange pill that matches
  // `BetaBadge`); this override just swaps the sans-serif default for the
  // session-v2 mono font so the label reads as one language with the
  // neighboring `sourceBadge` glyphs. Kept here (not on the primitive) so
  // `components/ui/` never imports feature-scoped tokens.
  crossMatchTacticalLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 7,
    letterSpacing: 0.8,
  },
  meta: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 8,
    color: tacticalTokens.colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
    flexShrink: 1,
  },
  approvalTower: {
    width: 64,
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderLeftColor: tacticalTokens.colors.border,
  },
  approvalCell: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveCell: {
    backgroundColor: withAlpha(tacticalTokens.colors.acid, 0.1),
  },
  rejectCell: {
    backgroundColor: withAlpha(tacticalTokens.colors.hotPink, 0.1),
    borderLeftWidth: 1,
    borderLeftColor: tacticalTokens.colors.border,
  },
  approvalPressed: {
    opacity: 0.9,
  },
  approvalGlyph: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 16,
  },
  voteTower: {
    width: 44,
    flexDirection: 'column',
    borderLeftWidth: 1,
    borderLeftColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  voteCell: {
    minHeight: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCellPressed: {
    backgroundColor: withAlpha(tacticalTokens.colors.white, 0.08),
  },
  // Right-edge tap target for the context menu (remove / share / etc).
  // Visually subtle so it doesn't dominate the row, but discoverable
  // enough that users learn the interaction without needing to find
  // long-press by accident.
  menuTab: {
    width: 32,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  menuTabPressed: {
    backgroundColor: withAlpha(tacticalTokens.colors.white, 0.08),
  },
  menuGlyph: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 18,
    color: tacticalTokens.colors.textMuted,
    lineHeight: 18,
  },
  voteGlyph: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 11,
    color: tacticalTokens.colors.textMuted,
  },
  voteCountCell: {
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  voteCount: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 15,
  },
  patchCable: {
    position: 'absolute',
    left: 11,
    top: '100%',
    width: 2,
    height: 6,
  },
});

export default SignalChainTrackBlock;
