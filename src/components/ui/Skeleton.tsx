/**
 * Skeleton — shimmer loading placeholder
 *
 * Renders an animated placeholder while content loads.
 * Uses a pulsing opacity animation for perceived speed.
 *
 * NOTE: width only accepts numbers (px), NOT percentage strings.
 * Percentage strings on Animated.View crash Android.
 * Use flex: 1 on the parent or explicit pixel values instead.
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';

interface SkeletonProps {
  /** Width in px (numbers only — no '%' strings) */
  width?: number;
  /** Height in px */
  height?: number;
  /** Border radius */
  borderRadius?: number;
  /** If true, skeleton stretches to fill parent (replaces width="100%") */
  fill?: boolean;
  /** Additional styles */
  style?: ViewStyle;
}

export function Skeleton({
  width,
  height = 16,
  borderRadius = spacing.radius.sm,
  fill = false,
  style,
}: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          height,
          borderRadius,
          opacity,
          ...(fill ? { alignSelf: 'stretch' as const } : {}),
          ...(width != null ? { width } : {}),
        },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton for a track card */
export function TrackCardSkeleton() {
  return (
    <View style={skeletonCardStyles.card}>
      <Skeleton width={48} height={48} borderRadius={spacing.radius.sm} />
      <View style={skeletonCardStyles.info}>
        <Skeleton fill height={14} style={{ maxWidth: 200 }} />
        <Skeleton fill height={12} style={{ marginTop: 6, maxWidth: 140 }} />
        <Skeleton fill height={10} style={{ marginTop: 4, maxWidth: 90 }} />
      </View>
    </View>
  );
}

/** Pre-built skeleton for a session card */
export function SessionCardSkeleton() {
  return (
    <View style={skeletonCardStyles.sessionCard}>
      <Skeleton width={4} height={80} borderRadius={0} />
      <View style={skeletonCardStyles.sessionBody}>
        <View style={skeletonCardStyles.sessionHeader}>
          <Skeleton fill height={16} style={{ maxWidth: 180 }} />
          <Skeleton width={80} height={20} borderRadius={12} />
        </View>
        <Skeleton fill height={12} style={{ marginTop: 8, maxWidth: 220 }} />
        <View style={skeletonCardStyles.sessionStats}>
          <Skeleton width={80} height={10} />
          <Skeleton width={60} height={10} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: palette.midnight,
  },
});

const skeletonCardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    marginBottom: spacing.sm,
  },
  info: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  sessionCard: {
    flexDirection: 'row',
    borderRadius: spacing.radius.lg,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  sessionBody: {
    flex: 1,
    padding: spacing.cardPadding,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 8,
  },
  roomCard: {
    height: 160,
    borderRadius: spacing.radius.lg,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    padding: spacing.cardPadding,
    justifyContent: 'space-between',
  },
  roomTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto' as any,
  },
});

/** Pre-built skeleton for a RoomCard (160pt height per §4.2) */
export function RoomCardSkeleton() {
  return (
    <View style={skeletonCardStyles.roomCard}>
      {/* Top row: mode badge + live indicator */}
      <View style={skeletonCardStyles.roomTopRow}>
        <Skeleton width={72} height={20} borderRadius={10} />
        <Skeleton width={48} height={16} borderRadius={8} />
      </View>
      {/* Room name */}
      <Skeleton fill height={18} style={{ marginTop: 12, maxWidth: 180 }} />
      {/* Host name */}
      <Skeleton fill height={12} style={{ marginTop: 6, maxWidth: 120 }} />
      {/* Bottom: now playing + join button */}
      <View style={skeletonCardStyles.roomBottomRow}>
        <Skeleton fill height={10} style={{ maxWidth: 160 }} />
        <Skeleton width={60} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

export default Skeleton;
