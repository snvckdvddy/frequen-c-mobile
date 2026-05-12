import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tacticalTokens } from '../theme/tacticalTokens';
import type { QueueTrack } from '../../../types';

interface NextUpRibbonProps {
  /** The upcoming queue track — typically queue[1] from the parent. */
  nextTrack: QueueTrack | null;
}

/**
 * NextUpRibbon — "whose turn it is" beacon for CAMPFIRE mode.
 *
 * Renders a thin label below the album hero showing the next queuer
 * and their queued track. The point: in CAMPFIRE the rotation
 * fairness IS the brand promise. Hiding it (just showing the queue
 * sheet has it somewhere) wastes the design intent. This ribbon
 * surfaces the rotation cue without requiring the user to open
 * anything.
 *
 * Renders null if there's no upcoming track (nothing to announce).
 * Parents control mount/unmount based on room mode — this component
 * has no opinion about that; it just renders what it's given.
 *
 * Visual treatment:
 *   - Thin horizontal ribbon with an "NEXT" eyebrow and the
 *     @username + track-title combination on a single line
 *   - Amber accent ties to CAMPFIRE's warmer color identity
 *   - Compact enough to slot between the album hero and the
 *     transport without competing for visual weight
 */
export function NextUpRibbon({ nextTrack }: NextUpRibbonProps) {
  if (!nextTrack) return null;

  const queuerHandle = nextTrack.addedBy?.username
    ? `@${nextTrack.addedBy.username}`
    : 'SYSTEM';

  return (
    <View style={styles.wrapper}>
      <View style={styles.eyebrowCell}>
        <Text style={styles.eyebrow}>NEXT</Text>
      </View>
      <View style={styles.bodyCell}>
        <Text style={styles.handle} numberOfLines={1}>
          {queuerHandle}
        </Text>
        <Text style={styles.separator}>//</Text>
        <Text style={styles.title} numberOfLines={1}>
          {nextTrack.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: tacticalTokens.spacing.xs,
    marginHorizontal: tacticalTokens.spacing.xl,
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 22,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: 'rgba(255, 122, 69, 0.08)', // tacticalTokens.colors.orange at ~8% alpha
  },
  eyebrowCell: {
    backgroundColor: tacticalTokens.colors.orange,
    paddingHorizontal: tacticalTokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: tacticalTokens.colors.void,
  },
  bodyCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: tacticalTokens.spacing.sm,
    minWidth: 0,
  },
  handle: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: tacticalTokens.colors.orange,
  },
  separator: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 10,
    color: tacticalTokens.colors.textSoft,
  },
  title: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: tacticalTokens.colors.white,
  },
});

export default NextUpRibbon;
