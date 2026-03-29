import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime, type PlaybackState } from '../services/playbackEngine';
import type { QueueTrack } from '../types';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { getSourceColor } from '../design/tokens/sourceColors';

export const MINI_PLAYER_HEIGHT = 64;

export interface MiniPlayerProps {
  track: QueueTrack;
  playback: PlaybackState;
  onSkip: () => void;
  onPress: () => void;
  onPlayPause?: () => void;
  canSkip?: boolean;
}

function MonoText(props: { children: React.ReactNode; style?: import('react-native').StyleProp<import('react-native').TextStyle>; numberOfLines?: number }) {
  return <Text {...props} />;
}

export function MiniPlayer({
  track,
  playback,
  onSkip,
  onPress,
  onPlayPause,
  canSkip = true,
}: MiniPlayerProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const sourceColor = getSourceColor(track.source);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: playback.progress,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [playback.progress, progressAnim]);

  useEffect(() => {
    if (!playback.isPlaying) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.82, duration: 1100, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowOpacity, playback.isPlaying]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.shell}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth as unknown as import('react-native').DimensionValue, backgroundColor: sourceColor }]} />
        {playback.isPlaying ? <Animated.View style={[styles.progressGlow, { opacity: glowOpacity, backgroundColor: sourceColor }]} /> : null}
      </View>

      <View style={styles.content}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open now playing for ${track.title}`}
          style={({ pressed }) => [styles.trackArea, pressed && styles.pressed]}
        >
          {track.albumArt ? (
            <Image source={{ uri: track.albumArt }} style={styles.art} accessible={false} />
          ) : (
            <View style={[styles.art, styles.artFallback]}>
              <Ionicons name="musical-note-outline" size={16} color={tacticalTokens.colors.textMuted} />
            </View>
          )}

          <View style={styles.copy}>
            <View style={styles.labelRow}>
              <MonoText style={[styles.mono, styles.nowLabel]}>NOW PATCHED</MonoText>
              {playback.isLoading ? <ActivityIndicator size="small" color={tacticalTokens.colors.ice} /> : null}
            </View>
            <MonoText style={[styles.display, styles.title]} numberOfLines={1}>
              {track.title.toUpperCase()}
            </MonoText>
            <MonoText style={[styles.mono, styles.meta]} numberOfLines={1}>
              {track.artist.toUpperCase()}
              {!playback.isLoading && playback.elapsed > 0 ? ` // ${formatTime(playback.elapsed)}` : ''}
            </MonoText>
          </View>
        </Pressable>

        <View style={styles.controls}>
          {onPlayPause ? (
            <Pressable
              onPress={onPlayPause}
              accessibilityRole="button"
              accessibilityLabel={playback.isPlaying ? 'Pause playback' : 'Play track'}
              style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={playback.isPlaying ? 'pause' : 'play'}
                size={18}
                color={tacticalTokens.colors.void}
              />
            </Pressable>
          ) : null}

          {canSkip ? (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip track"
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Ionicons
                name="play-skip-forward-outline"
                size={18}
                color={tacticalTokens.colors.white}
              />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.82,
  },
  mono: {
    fontFamily: tacticalTokens.fonts.mono,
  },
  display: {
    fontFamily: tacticalTokens.fonts.display,
  },
  shell: {
    height: MINI_PLAYER_HEIGHT,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.96)',
    overflow: 'hidden',
  },
  progressTrack: {
    height: 2,
    backgroundColor: '#111111',
  },
  progressFill: {
    height: 2,
    backgroundColor: tacticalTokens.colors.ice,
  },
  progressGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
    // backgroundColor set dynamically via sourceColor inline style
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  trackArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  art: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  artFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nowLabel: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 1,
    fontSize: 16,
    color: tacticalTokens.colors.white,
  },
  meta: {
    marginTop: 1,
    fontSize: 10,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MiniPlayer;
