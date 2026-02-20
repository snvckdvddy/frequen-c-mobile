/**
 * Mini Player — Persistent bottom bar showing current track.
 *
 * Shows: progress bar, album art, track info, favorite/fire/skip buttons.
 * Tapping the main area opens NowPlayingSheet.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { formatTime, type PlaybackState } from '../services/playbackEngine';
import type { QueueTrack, Track } from '../types';

export const MINI_PLAYER_HEIGHT = 68;

export interface MiniPlayerProps {
  track: QueueTrack;
  playback: PlaybackState;
  onReact: (trackId: string, type: 'fire' | 'vibe') => void;
  onSkip: () => void;
  onPress: () => void;
  onPlayPause?: () => void;
  canSkip?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (track: Track) => void;
}

export function MiniPlayer({
  track, playback, onReact, onSkip, onPress, onPlayPause, canSkip = true,
  isFavorite, onToggleFavorite,
}: MiniPlayerProps) {
  // Animate progress width smoothly
  const progressAnim = useRef(new Animated.Value(0)).current;
  // Glow pulse for now-playing
  const glowOpacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: playback.progress,
      duration: 280,
      useNativeDriver: false, // width animation can't use native driver
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
    <View style={miniStyles.container}>
      {/* Progress bar across top edge — animated + glow */}
      <View style={miniStyles.progressTrack}>
        <Animated.View
          style={[miniStyles.progressFill, { width: progressWidth as any }]}
        />
        {/* Glow dot at leading edge */}
        {playback.isPlaying && (
          <Animated.View
            style={[
              miniStyles.progressGlow,
              { opacity: glowOpacity, left: `${(playback.progress * 100).toFixed(1)}%` as any },
            ]}
          />
        )}
      </View>

      <View style={miniStyles.content}>
        {/* Tappable area: art + info → opens NowPlayingSheet */}
        <Pressable style={miniStyles.trackArea} onPress={onPress}>
          {/* Track art */}
          {track.albumArt ? (
            <Image source={{ uri: track.albumArt }} style={miniStyles.art} />
          ) : (
            <View style={[miniStyles.art, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text variant="labelSmall" color={colors.text.primary}>{track.artist.charAt(0)}</Text>
            </View>
          )}

          {/* Track info */}
          <View style={miniStyles.info}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {playback.isLoading && (
                <ActivityIndicator size="small" color={colors.action.primary} />
              )}
              <Text variant="label" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
                {track.title}
              </Text>
            </View>
            <Text variant="labelSmall" color={colors.text.secondary} numberOfLines={1}>
              {track.artist} · {playback.isLoading ? 'Loading...' : formatTime(playback.elapsed)}
            </Text>
          </View>
        </Pressable>

        {/* Action buttons — NOT inside the pressable so taps don't get swallowed */}
        <View style={miniStyles.actions}>
          {/* Play/Pause */}
          {onPlayPause && (
            <TouchableOpacity style={miniStyles.playBtn} onPress={onPlayPause} activeOpacity={0.7}>
              <Ionicons
                name={playback.isPlaying ? 'pause' : 'play'}
                size={20}
                color={colors.text.primary}
              />
            </TouchableOpacity>
          )}
          {/* Heart / Favorite */}
          {onToggleFavorite && (
            <TouchableOpacity style={miniStyles.btn} onPress={() => onToggleFavorite(track)} activeOpacity={0.6}>
              <Text variant="label" color={isFavorite ? colors.action.primary : colors.text.muted}>
                {isFavorite ? '\u2665' : '\u2661'}
              </Text>
            </TouchableOpacity>
          )}
          {/* Fire reaction */}
          <TouchableOpacity style={miniStyles.btn} onPress={() => onReact(track.id, 'fire')} activeOpacity={0.6}>
            <Text variant="label" color={colors.reaction.fire}>\uD83D\uDD25</Text>
          </TouchableOpacity>
          {/* Vibe reaction */}
          <TouchableOpacity style={miniStyles.btn} onPress={() => onReact(track.id, 'vibe')} activeOpacity={0.6}>
            <Text variant="label" color={colors.reaction.vibe}>\u2728</Text>
          </TouchableOpacity>
          {/* Skip */}
          {canSkip && (
            <TouchableOpacity style={miniStyles.btn} onPress={onSkip} activeOpacity={0.6}>
              <Ionicons name="play-skip-forward" size={16} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MINI_PLAYER_HEIGHT,
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
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
    width: 40,
    height: 40,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MiniPlayer;
