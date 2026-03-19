/**
 * Now Playing Sheet — Expanded playback view.
 *
 * Sprint 2: Convergence strategy alignment.
 * - Full album art hero (§1.5)
 * - Progress scrubber with elapsed/remaining
 * - Ionicons transport controls (no emoji)
 * - ReactionBar (§3.3) replaces scattered fire/vibe
 * - Swipe-down-to-dismiss preserved
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated, Dimensions,
  PanResponder, Modal, Image, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, ReactionBar } from './ui';
import { FloatingReaction } from './ui/FloatingReaction';
import { DynamicGradientBg } from './DynamicGradientBg';
import { spacing } from '../theme/spacing';
import {
  togglePlayPause, seekTo, formatTime,
  type PlaybackState,
} from '../services/playbackEngine';
import type { QueueTrack } from '../types';
// ─── Design System: Rack × Chrome visual language ──────────
import { LEDReadout } from '../design/components';
import { palette } from '../design/tokens/materials';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const ART_SIZE = SCREEN_W - spacing.screenPadding * 2;        // Convergence §1.5 — deviceWidth - 48pt
const SCRUBBER_WIDTH = SCREEN_W - spacing.screenPadding * 2;  // Match art width
const DISMISS_THRESHOLD = 120;

interface NowPlayingSheetProps {
  visible: boolean;
  track: QueueTrack | null;
  playback: PlaybackState;
  onClose: () => void;
  onSkip: () => void;
  onReact: (trackId: string, type: string) => void;
  canSkip?: boolean;
  /** Room name to show in header (e.g. "Caleb's Campfire") */
  roomName?: string;
  /** Callback when overflow menu is tapped */
  onOverflowPress?: () => void;
}

export function NowPlayingSheet({
  visible, track, playback, onClose, onSkip, onReact, canSkip = true,
  roomName, onOverflowPress,
}: NowPlayingSheetProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;
  const dragOffset = useRef(new Animated.Value(0)).current;

  // Double-tap detection — §5.1: double-tap album art → heart reaction
  const lastTapRef = useRef<number>(0);
  const [floatingHearts, setFloatingHearts] = useState<{ id: number; x: number }[]>([]);
  let heartCounter = useRef(0);

  const handleArtPress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms window for double-tap

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double-tap detected — spawn floating heart + fire reaction
      lastTapRef.current = 0; // reset to avoid triple-tap
      const id = ++heartCounter.current;
      // Randomize X offset slightly for organic feel (-20 to +20)
      const x = (Math.random() - 0.5) * 40;
      setFloatingHearts((prev) => [...prev, { id, x }]);

      // Also fire the reaction callback
      if (track) onReact(track.id, 'heart');
    } else {
      lastTapRef.current = now;
    }
  }, [track, onReact]);

  const removeHeart = useCallback((id: number) => {
    setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
  }, []);

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
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragOffset.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > DISMISS_THRESHOLD || gs.vy > 0.5) {
          Animated.timing(dragOffset, {
            toValue: SCREEN_H,
            duration: 250,
            useNativeDriver: true,
          }).start(() => {
            dragOffset.setValue(0);
            onClose();
          });
        } else {
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

  // Reaction handler — maps ReactionBar emoji types to parent callback
  const handleReaction = useCallback(
    (type: string) => {
      if (track) onReact(track.id, type);
    },
    [track, onReact],
  );

  if (!track) return null;

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
        {/* Dynamic gradient background — §2.4 */}
        <DynamicGradientBg imageUri={track?.albumArt} />

        {/* Header — Rack chrome bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel="Close player">
            <Ionicons name="chevron-down" size={24} color={palette.silver} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {roomName ? (
              <LEDReadout value={roomName.toUpperCase()} variant="ice" size="sm" />
            ) : (
              <View style={styles.handle} />
            )}
          </View>
          {onOverflowPress ? (
            <TouchableOpacity onPress={onOverflowPress} style={styles.headerBtn} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel="More options">
              <Ionicons name="ellipsis-horizontal" size={20} color={palette.silver} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerBtn} />
          )}
        </View>

        {/* Album Art Hero — §1.5 + §5.1 double-tap */}
        <View style={styles.artContainer}>
          <Pressable onPress={handleArtPress} accessibilityRole="image" accessibilityLabel={`Album art for ${track.title}. Double tap to react`}>
            {track.albumArt ? (
              <Image source={{ uri: track.albumArt }} style={styles.artImage} />
            ) : (
              <View style={styles.artPlaceholder}>
                <Ionicons name="musical-notes" size={64} color={palette.slate} style={{ opacity: 0.4 }} />
              </View>
            )}
          </Pressable>
          {/* Floating hearts from double-tap — §7 animation spec */}
          {floatingHearts.map((heart) => (
            <FloatingReaction
              key={heart.id}
              emoji="❤️"
              offsetX={heart.x}
              size={42}
              onComplete={() => removeHeart(heart.id)}
            />
          ))}
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text variant="h2" color={palette.frost} numberOfLines={1} align="center" style={{ fontFamily: 'ChakraPetch-Bold' }}>
            {track.title}
          </Text>
          <Text variant="body" color={palette.silver} numberOfLines={1} align="center">
            {track.artist}{track.album ? ` — ${track.album}` : ''}
          </Text>
          {track.addedBy && (
            <Text variant="labelSmall" color={palette.slate} align="center" style={{ marginTop: 4 }}>
              Added by {track.addedBy.username}
            </Text>
          )}
        </View>

        {/* Progress Scrubber */}
        <View style={styles.scrubberSection}>
          <TouchableOpacity
            style={styles.scrubberTrack}
            activeOpacity={1}
            onPress={(e) => handleScrub(e.nativeEvent.locationX)}
            accessibilityRole="adjustable"
            accessibilityLabel={`Playback progress, ${formatTime(playback.elapsed)} of ${formatTime(playback.duration)}`}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(playback.progress * 100) }}
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
            <LEDReadout value={formatTime(playback.elapsed)} variant="ice" size="sm" />
            <LEDReadout value={`-${formatTime(Math.max(0, playback.duration - playback.elapsed))}`} variant="ice" size="sm" />
          </View>
        </View>

        {/* Transport Controls — Chrome hardware buttons */}
        <View style={styles.transport}>
          {/* Restart / Previous */}
          <TouchableOpacity style={styles.transportBtn} onPress={() => seekTo(0)} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel="Restart track">
            <Ionicons name="play-skip-back" size={28} color={palette.silver} />
          </TouchableOpacity>

          {/* Play/Pause — large circle, ice fill */}
          <TouchableOpacity
            style={styles.playPauseBtn}
            onPress={togglePlayPause}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={playback.isPlaying ? 'Pause' : 'Play'}
          >
            <Ionicons
              name={playback.isPlaying ? 'pause' : 'play'}
              size={32}
              color={palette.void}
              style={!playback.isPlaying ? { marginLeft: 3 } : undefined}
            />
          </TouchableOpacity>

          {/* Skip */}
          <TouchableOpacity
            style={styles.transportBtn}
            onPress={canSkip ? onSkip : undefined}
            activeOpacity={canSkip ? 0.6 : 1}
            disabled={!canSkip}
            accessibilityRole="button"
            accessibilityLabel="Skip to next track"
            accessibilityState={{ disabled: !canSkip }}
          >
            <Ionicons
              name="play-skip-forward"
              size={28}
              color={canSkip ? palette.silver : palette.slate}
            />
          </TouchableOpacity>
        </View>

        {/* Reaction Bar — §3.3, replaces scattered fire/vibe */}
        <View style={styles.reactionSection}>
          <ReactionBar onReact={handleReaction} disabled={false} />
        </View>

        {/* Queue context hint */}
        <View style={styles.queueHint}>
          <Text variant="labelSmall" color={palette.slate} align="center">
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
    backgroundColor: palette.void,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    // Chrome divider bottom
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(192, 223, 255, 0.06)',
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.slate,
    opacity: 0.5,
  },

  // Album art hero
  artContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  artImage: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 0,
    // Chrome frame
    borderWidth: 1,
    borderColor: 'rgba(192, 223, 255, 0.15)',
  },
  artPlaceholder: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 0,
    backgroundColor: palette.midnight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 223, 255, 0.10)',
  },

  // Track info
  trackInfo: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.lg,
  },

  // Scrubber — hardware groove
  scrubberSection: {
    paddingHorizontal: spacing.screenPadding,
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
    borderRadius: 0,
    backgroundColor: 'rgba(192, 223, 255, 0.08)',
  },
  scrubberFill: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: 0,
    backgroundColor: palette.ice,
  },
  scrubberThumb: {
    position: 'absolute',
    width: 6,
    height: 16,
    borderRadius: 0,
    backgroundColor: palette.ice,
    marginLeft: -3,
    top: 4,
    // Ice glow on thumb
    shadowColor: palette.ice,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },

  // Transport
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  transportBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 56,
    height: 56,
    borderRadius: 0,
    backgroundColor: palette.ice,
    alignItems: 'center',
    justifyContent: 'center',
    // Ice glow shadow
    shadowColor: palette.ice,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
    // Chrome rim
    borderWidth: 1,
    borderColor: 'rgba(192, 223, 255, 0.30)',
  },

  // Reaction bar section
  reactionSection: {
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
  },

  // Queue hint
  queueHint: {
    paddingVertical: spacing.md,
  },
});

export default NowPlayingSheet;
