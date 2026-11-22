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
import {
  deriveMiniPlayerControls,
  getHostOutputStatus,
} from '../features/session-v2/adapters/transportControls';
import { usePauseSettle } from '../features/session-v2/hooks/usePauseSettle';
import { getSourceColor } from '../design/tokens/sourceColors';
import { PreviewBadge } from './ui';

export const MINI_PLAYER_HEIGHT = 64;

export interface MiniPlayerProps {
  track: QueueTrack;
  playback: PlaybackState;
  onSkip: () => void;
  onPress: () => void;
  onPlayPause?: () => void;
  canSkip?: boolean;
  /** Host-output model: only the host's device has transport over the audio.
   *  A guest gets a read-only host status instead of pause and skip. */
  isHost: boolean;
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
  isHost,
}: MiniPlayerProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.35)).current;
  const sourceColor = getSourceColor(track.source);

  // A tapped pause shows at once and holds against late "playing" reports,
  // so the button and glow settle straight to paused (see pauseSettle.ts).
  const { displayedPlaying, notePlayPauseTap } = usePauseSettle(
    playback.isPlaying,
    playback.isLoading,
  );
  const controls = deriveMiniPlayerControls({
    isHost,
    hasPlayPause: !!onPlayPause,
    canSkip,
  });
  const hostStatus = getHostOutputStatus(playback.isPlaying);

  const handlePlayPause = () => {
    notePlayPauseTap();
    onPlayPause?.();
  };

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: playback.progress,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [playback.progress, progressAnim]);

  useEffect(() => {
    if (!displayedPlaying) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 0.82, duration: 1100, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowOpacity, displayedPlaying]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.shell}>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth as unknown as import('react-native').DimensionValue, backgroundColor: sourceColor }]} />
        {displayedPlaying ? <Animated.View style={[styles.progressGlow, { opacity: glowOpacity, backgroundColor: sourceColor }]} /> : null}
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
              <PreviewBadge source={track.source} />
              {playback.isLoading ? <ActivityIndicator size="small" color={tacticalTokens.colors.ice} /> : null}
            </View>
            <MonoText style={[styles.display, styles.title]} numberOfLines={1}>
              {track.title}
            </MonoText>
            <MonoText style={[styles.mono, styles.meta]} numberOfLines={1}>
              {track.artist}
              {!playback.isLoading && playback.elapsed > 0 ? ` // ${formatTime(playback.elapsed)}` : ''}
            </MonoText>
          </View>
        </Pressable>

        <View style={styles.controls}>
          {controls.showHostStatus ? (
            <View
              style={styles.hostStatus}
              accessibilityRole="text"
              accessibilityLabel={hostStatus.accessibilityLabel}
            >
              <Ionicons
                name="radio-outline"
                size={14}
                color={playback.isPlaying ? tacticalTokens.colors.white : tacticalTokens.colors.textMuted}
              />
              <MonoText
                style={[
                  styles.hostStatusText,
                  !playback.isPlaying && styles.hostStatusTextPaused,
                ]}
              >
                {hostStatus.label}
              </MonoText>
            </View>
          ) : null}

          {controls.showPlayPause ? (
            <Pressable
              onPress={handlePlayPause}
              accessibilityRole="button"
              accessibilityLabel={displayedPlaying ? 'Pause playback' : 'Play track'}
              style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}
            >
              <Ionicons
                name={displayedPlaying ? 'pause' : 'play'}
                size={18}
                color={tacticalTokens.colors.void}
              />
            </Pressable>
          ) : null}

          {controls.showSkip ? (
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
    // Reduced from 16 to 14 per UX feedback 2026-05-11.
    fontSize: 14,
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
  // Guest-side stand-in for the controls: same height as the buttons, no touch target.
  hostStatus: {
    minWidth: 84,
    height: 38,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  hostStatusText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.2,
  },
  hostStatusTextPaused: {
    color: tacticalTokens.colors.textMuted,
  },
});

export default MiniPlayer;
