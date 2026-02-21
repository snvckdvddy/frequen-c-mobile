/**
 * Mini Player — Persistent bottom bar showing current track.
 *
 * Convergence Strategy §1.4:
 * Height: 56pt
 * Layout: progress bar (top edge) + album art + title/artist + play/pause + skip
 * Reactions belong in full player only — NOT in mini-player.
 * Tapping the main area opens NowPlayingSheet.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { formatTime, type PlaybackState } from '../services/playbackEngine';
import type { QueueTrack } from '../types';

export const MINI_PLAYER_HEIGHT = 56;

export interface MiniPlayerProps {
  track: QueueTrack;
  playback: PlaybackState;
  onSkip: () => void;
  onPress: () => void;
  onPlayPause?: () => void;
  canSkip?: boolean;
}

export function MiniPlayer({
  track,
  playback,
  onSkip,
  onPress,
  onPlayPause,
  canSkip = true,
}: MiniPlayerProps) {
  // Animate progress width smoothly
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Glow pulse for now-playing
  const glowOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: playback.progress,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [playback.progress, progressAnim]);

  useEffect(() => {
    if (playback.isPlaying) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.9, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [playback.isPlaying, glowOpacity]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Progress bar across top edge */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth as any }]} />
        {playback.isPlaying && (
          <Animated.View
            style={[
              styles.progressGlow,
              { opacity: glowOpacity, left: `${(playback.progress * 100).toFixed(1)}%` as any },
            ]}
          />
        )}
      </View>

      <View style={styles.content}>
        {/* Tappable area: art + info → opens NowPlayingSheet */}
        <Pressable style={styles.trackArea} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Now playing: ${track.title} by ${track.artist}. Tap to expand`}>
          {track.albumArt ? (
            <Image source={{ uri: track.albumArt }} style={styles.art} />
          ) : (
            <View style={[styles.art, styles.artPlaceholder]}>
              <Ionicons name="musical-note" size={16} color={colors.text.muted} />
            </View>
          )}

          <View style={styles.info}>
            <View style={styles.titleRow}>
              {playback.isLoading && (
                <ActivityIndicator size="small" color={colors.action.primary} />
              )}
              <Text variant="label" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
                {track.title}
              </Text>
            </View>
            <Text variant="labelSmall" color={colors.text.secondary} numberOfLines={1}
                  style={{ textTransform: 'none', letterSpacing: 0 }}>
              {track.artist}{!playback.isLoading && playback.elapsed > 0 ? ` · ${formatTime(playback.elapsed)}` : ''}
            </Text>
          </View>
        </Pressable>

        {/* Controls: play/pause + skip only */}
        <View style={styles.controls}>
          {onPlayPause && (
            <TouchableOpacity style={styles.playBtn} onPress={onPlayPause} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={playback.isPlaying ? 'Pause' : 'Play'}>
              <Ionicons
                name={playback.isPlaying ? 'pause' : 'play'}
                size={18}
                color={colors.action.primaryText}
              />
            </TouchableOpacity>
          )}
          {canSkip && (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onSkip}
              activeOpacity={0.6}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Skip to next track"
            >
              <Ionicons name="play-skip-forward" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MINI_PLAYER_HEIGHT,
    backgroundColor: colors.bg.elevated,       // Steel #161B28 — Convergence §1.4
    borderTopWidth: 1,
    borderTopColor: colors.border.default,     // Dark steel divider
  },
  progressTrack: {
    height: 2,
    backgroundColor: colors.bg.elevated,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.action.primary,
  },
  progressGlow: {
    position: 'absolute',
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.action.primary,
    marginLeft: -4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.sm,
  },
  trackArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  art: {
    width: 40,                                 // Convergence §1.4 — 40×40 art
    height: 40,
    borderRadius: 6,
    backgroundColor: colors.bg.input,          // Gunmetal placeholder bg
  },
  artPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MiniPlayer;
