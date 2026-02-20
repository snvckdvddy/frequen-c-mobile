/**
 * Now Playing Sheet — Expanded playback view.
 *
 * Opens as a full-screen modal overlay when user taps the MiniPlayer.
 * Shows: large album art, track info, progress scrubber, controls.
 *
 * The component is controlled — parent passes visibility + track data.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated, Dimensions,
  PanResponder, Modal, Image,
} from 'react-native';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import {
  togglePlayPause, seekTo, onProgress, formatTime,
  type PlaybackState,
} from '../services/playbackEngine';
import type { QueueTrack, Reaction } from '../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ART_SIZE = SCREEN_W - spacing.screenPadding * 4;
const SCRUBBER_WIDTH = SCREEN_W - spacing.screenPadding * 4;

interface NowPlayingSheetProps {
  visible: boolean;
  track: QueueTrack | null;
  playback: PlaybackState;
  onClose: () => void;
  onSkip: () => void;
  onReact: (trackId: string, type: 'fire' | 'vibe') => void;
  canSkip?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (track: QueueTrack) => void;
}

const DISMISS_THRESHOLD = 120; // px drag distance to trigger close

export function NowPlayingSheet({
  visible, track, playback, onClose, onSkip, onReact, canSkip = true,
  isFavorite, onToggleFavorite,
}: NowPlayingSheetProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;

  // Slide in/out
  useEffect(() => {
    if (visible) {
      dragOffset.setValue(0);
    }
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_H,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible]);

  // Pan responder for swipe-down-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture vertical downward drags (not taps or horizontal swipes)
        return gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5;
      },
      onPanResponderMove: (_, gs) => {
        // Only allow downward drag (clamp at 0)
        if (gs.dy > 0) {
          dragOffset.setValue(gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.5) {
          // Dismiss: animate out then call onClose
          Animated.timing(dragOffset, {
            toValue: SCREEN_H,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            dragOffset.setValue(0);
            onClose();
          });
        } else {
          // Snap back
          Animated.spring(dragOffset, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  // Scrubber drag
  const handleScrub = useCallback((locationX: number) => {
    const fraction = Math.max(0, Math.min(1, locationX / SCRUBBER_WIDTH));
    seekTo(fraction);
  }, []);

  if (!track) return null;

  const fireCount = track.reactions?.filter((r: Reaction) => r.type === 'fire').length || 0;
  const vibeCount = track.reactions?.filter((r: Reaction) => r.type === 'vibe').length || 0;

  // Combined translateY: slide animation + drag offset
  const combinedTranslateY = Animated.add(slideAnim, dragOffset);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY: combinedTranslateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Drag handle (also tappable to close) */}
        <TouchableOpacity style={styles.handleArea} onPress={onClose} activeOpacity={0.8}>
          <View style={styles.handle} />
        </TouchableOpacity>

        {/* Album Art */}
        <View style={styles.artContainer}>
          {track.albumArt ? (
            <Image source={{ uri: track.albumArt }} style={styles.artImage} />
          ) : (
            <View style={styles.artPlaceholder}>
              <Text variant="h1" color={colors.text.muted} style={styles.artInitial}>
                {track.artist.charAt(0)}
              </Text>
            </View>
          )}
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text variant="h2" color={colors.text.primary} numberOfLines={1} align="center">
            {track.title}
          </Text>
          <Text variant="body" color={colors.text.secondary} numberOfLines={1} align="center">
            {track.artist}{track.album ? ` \u2014 ${track.album}` : ''}
          </Text>
          {track.addedBy && (
            <Text variant="labelSmall" color={colors.text.muted} align="center" style={{ marginTop: 4 }}>
              Added by {track.addedBy.username}
            </Text>
          )}
        </View>

        {/* Favorite button */}
        {onToggleFavorite && track && (
          <TouchableOpacity
            style={styles.favoriteRow}
            onPress={() => onToggleFavorite(track)}
            activeOpacity={0.7}
          >
            <Text
              variant="h3"
              color={isFavorite ? colors.action.primary : colors.text.muted}
            >
              {isFavorite ? '\u2665' : '\u2661'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Progress Scrubber */}
        <View style={styles.scrubberSection}>
          <TouchableOpacity
            style={styles.scrubberTrack}
            activeOpacity={1}
            onPress={(e) => handleScrub(e.nativeEvent.locationX)}
          >
            <View style={styles.scrubberBg} />
            <View
              style={[
                styles.scrubberFill,
                { width: `${(playback.progress * 100).toFixed(1)}%` as any },
              ]}
            />
            <View
              style={[
                styles.scrubberThumb,
                { left: `${(playback.progress * 100).toFixed(1)}%` as any },
              ]}
            />
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text variant="labelSmall" color={colors.text.muted}>
              {formatTime(playback.elapsed)}
            </Text>
            <Text variant="labelSmall" color={colors.text.muted}>
              -{formatTime(Math.max(0, playback.duration - playback.elapsed))}
            </Text>
          </View>
        </View>

        {/* Playback Controls */}
        <View style={styles.controls}>
          {/* Reactions (left side) */}
          <TouchableOpacity
            style={styles.reactionBtn}
            onPress={() => onReact(track.id, 'fire')}
            activeOpacity={0.7}
          >
            <Text variant="h3" color={colors.reaction.fire}>\uD83D\uDD25</Text>
            {fireCount > 0 && (
              <Text variant="labelSmall" color={colors.reaction.fire}>{fireCount}</Text>
            )}
          </TouchableOpacity>

          {/* Main transport */}
          <View style={styles.transport}>
            {/* Restart track */}
            <TouchableOpacity style={styles.transportBtn} onPress={() => seekTo(0)} activeOpacity={0.6}>
              <Text variant="h3" color={colors.text.secondary}>\u23EE</Text>
            </TouchableOpacity>

            {/* Play/Pause */}
            <TouchableOpacity
              style={styles.playPauseBtn}
              onPress={togglePlayPause}
              activeOpacity={0.7}
            >
              <Text variant="h1" color={colors.text.primary}>
                {playback.isPlaying ? '\u23F8' : '\u25B6'}
              </Text>
            </TouchableOpacity>

            {/* Skip */}
            {canSkip ? (
              <TouchableOpacity style={styles.transportBtn} onPress={onSkip} activeOpacity={0.6}>
                <Text variant="h3" color={colors.text.secondary}>\u23ED</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.transportBtn}>
                <Text variant="h3" color={colors.text.muted}>\u23ED</Text>
              </View>
            )}
          </View>

          {/* Reactions (right side) */}
          <TouchableOpacity
            style={styles.reactionBtn}
            onPress={() => onReact(track.id, 'vibe')}
            activeOpacity={0.7}
          >
            <Text variant="h3" color={colors.reaction.vibe}>\u2728</Text>
            {vibeCount > 0 && (
              <Text variant="labelSmall" color={colors.reaction.vibe}>{vibeCount}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Queue context hint */}
        <View style={styles.queueHint}>
          <Text variant="labelSmall" color={colors.text.muted} align="center">
            Swipe down to return to queue
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    paddingTop: 60,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.muted,
    opacity: 0.5,
  },

  // Album art
  artContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  artImage: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: spacing.radius.lg,
  },
  artPlaceholder: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  artInitial: {
    fontSize: 72,
    opacity: 0.4,
  },
  artSubtext: {
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Track info
  trackInfo: {
    paddingHorizontal: spacing.screenPadding * 2,
    marginBottom: spacing.lg,
  },

  // Favorite
  favoriteRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  // Scrubber
  scrubberSection: {
    paddingHorizontal: spacing.screenPadding * 2,
    marginBottom: spacing.xl,
  },
  scrubberTrack: {
    height: 24,
    justifyContent: 'center',
  },
  scrubberBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.bg.elevated,
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.action.primary,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.action.primary,
    marginLeft: -6,
    top: 6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding * 2,
    marginBottom: spacing.xl,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  transportBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBtn: {
    alignItems: 'center',
    gap: 2,
  },

  // Queue hint
  queueHint: {
    paddingVertical: spacing.md,
  },
});

export default NowPlayingSheet;
