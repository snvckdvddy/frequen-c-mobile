/**
 * NowPlayingCard — Album art, track info, progress, transport controls.
 *
 * Extracted from SessionRoomScreen. This is the central visual player block:
 *   - Vinyl album art (grid + concentric circles + glow)
 *   - Track title + artist
 *   - Progress bar with LED readouts
 *   - Transport: mic | play/pause | skip (with vote badge + phase cancel shield)
 *   - Reaction bar
 */

import React from 'react';
import {
  View, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, ReactionBar } from '../ui';
import { LEDReadout } from '../../design/components';
import { SonicLineageCard } from './SonicLineageCard';
import { TransitionMatrixCard } from './TransitionMatrixCard';
import { palette } from '../../design/tokens/materials';
import { colors } from '../../design/tokens/colors';
import { fontFamily, fontWeight, letterSpacing as ls } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';
import type { QueueTrack } from '../../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const ALBUM_ART_SIZE = SCREEN_WIDTH - 48;

// ─── Types ──────────────────────────────────────────────────

interface PlaybackState {
  isPlaying: boolean;
  isLoading?: boolean;
  elapsed: number;
  duration: number;
  progress: number;
}

interface SkipVoteState {
  votes: number;
  threshold: number;
  voters: string[];
}

interface NowPlayingCardProps {
  currentTrack: QueueTrack | null;
  /** Next track in queue (for Transition Matrix AI) */
  nextTrack?: QueueTrack | null;
  playback: PlaybackState;
  accent: string;
  /** Whether skip is vote-required mode */
  isVoteSkipMode: boolean;
  /** Whether user can skip at all */
  canSkip: boolean;
  /** Whether user already voted to skip */
  hasVotedToSkip: boolean;
  /** Skip vote state (vote count, threshold) */
  skipVoteState: SkipVoteState | null;
  /** Phase Cancel shield active */
  phaseCancelShield: { userId: string; username: string } | null;

  onPlayPause: () => void;
  onSkip: () => void;
  onChatOpen: () => void;
  onReact: (trackId: string, type: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────

export function NowPlayingCard({
  currentTrack,
  nextTrack,
  playback,
  accent,
  isVoteSkipMode,
  canSkip,
  hasVotedToSkip,
  skipVoteState,
  phaseCancelShield,
  onPlayPause,
  onSkip,
  onChatOpen,
  onReact,
}: NowPlayingCardProps) {
  return (
    <View style={styles.container}>
      {/* ─── Album Art — Gemini V7: vinyl + grid + orange glow ── */}
      <View style={styles.albumArtContainer}>
        <View style={styles.albumArtFrame}>
          <View style={styles.albumArtGlow} />
          <View style={styles.albumArtSurface}>
            <View style={styles.gridH} />
            <View style={styles.gridV} />
            <View style={styles.vinylOuter}>
              <View style={styles.vinylMiddle}>
                <View style={styles.vinylInner}>
                  <View style={styles.vinylDot} />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* ─── Track Info ─────────────────────────────────── */}
      <View style={styles.trackInfo}>
        <Text
          variant="h3"
          color={palette.frost}
          numberOfLines={1}
          align="center"
          style={styles.trackTitle}
        >
          {currentTrack?.title || 'Add a track to start'}
        </Text>
        <Text variant="body" color={palette.silver} numberOfLines={1} align="center">
          {currentTrack
            ? `${currentTrack.artist}${currentTrack.addedBy ? ` · Added by @${currentTrack.addedBy.username}` : ''}`
            : 'Search to add tracks to the queue'}
        </Text>
      </View>

      {/* ─── Sonic Lineage (AI) ───────────────────────────── */}
      <SonicLineageCard
        trackTitle={currentTrack?.title || null}
        trackArtist={currentTrack?.artist || null}
      />

      {/* ─── Transition Matrix (AI) ─────────────────────── */}
      <TransitionMatrixCard
        currentTitle={currentTrack?.title || null}
        currentArtist={currentTrack?.artist || null}
        nextTitle={nextTrack?.title || null}
        nextArtist={nextTrack?.artist || null}
      />

      {/* ─── Progress Bar ───────────────────────────────── */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${(playback.progress || 0) * 100}%`,
                backgroundColor: accent,
                shadowColor: accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 4,
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <LEDReadout value={formatTime(playback.elapsed || 0)} variant="ice" size="sm" />
          <LEDReadout value={formatTime(playback.duration || 0)} variant="ice" size="sm" />
        </View>
      </View>

      {/* ─── Transport Controls ─────────────────────────── */}
      <View style={styles.transport}>
        {/* Mic button (chat) */}
        <TouchableOpacity
          style={styles.transportCircle}
          onPress={onChatOpen}
          accessibilityRole="button"
          accessibilityLabel="Open chat"
        >
          <Ionicons name="mic-outline" size={22} color={palette.silver} />
        </TouchableOpacity>

        {/* Play / Pause — BIG ORANGE button */}
        <TouchableOpacity
          onPress={onPlayPause}
          disabled={!currentTrack}
          style={styles.playPauseBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={playback.isPlaying ? 'Pause' : 'Play'}
        >
          {playback.isLoading ? (
            <ActivityIndicator color={palette.void} size="small" />
          ) : (
            <Ionicons
              name={playback.isPlaying ? 'pause' : 'play'}
              size={30}
              color={palette.void}
              style={!playback.isPlaying ? { marginLeft: 3 } : undefined}
            />
          )}
        </TouchableOpacity>

        {/* Skip / Vote-skip */}
        <TouchableOpacity
          style={[
            styles.transportCircle,
            isVoteSkipMode && hasVotedToSkip && { borderColor: palette.orange, borderWidth: 1.5 },
          ]}
          onPress={onSkip}
          disabled={!canSkip || !currentTrack}
          accessibilityRole="button"
          accessibilityLabel={isVoteSkipMode ? 'Vote to skip' : 'Skip track'}
        >
          <Ionicons
            name={isVoteSkipMode ? 'hand-right' : 'play-forward'}
            size={22}
            color={
              isVoteSkipMode && hasVotedToSkip
                ? palette.orange
                : canSkip && currentTrack
                  ? palette.silver
                  : palette.slate
            }
          />
          {isVoteSkipMode && skipVoteState && (
            <View style={styles.skipVoteBadge}>
              <Text variant="labelSmall" color={palette.frost} style={styles.skipVoteText}>
                {skipVoteState.votes}/{skipVoteState.threshold}
              </Text>
            </View>
          )}
          {phaseCancelShield && (
            <View style={styles.phaseCancelBadge}>
              <Text variant="labelSmall" color={palette.frost} style={styles.phaseCancelBadgeText}>
                🛡️
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Reaction Bar ───────────────────────────────── */}
      {currentTrack && (
        <ReactionBar
          onReact={(type) => onReact(currentTrack.id, type)}
          disabled={!currentTrack}
        />
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
  },
  albumArtContainer: {
    width: ALBUM_ART_SIZE,
    height: ALBUM_ART_SIZE,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  albumArtFrame: {
    width: ALBUM_ART_SIZE - 24,
    height: ALBUM_ART_SIZE - 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArtGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: 'transparent',
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 12,
  },
  albumArtSurface: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: colors.accentPrimarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: colors.accentPrimarySubtle,
    top: '50%',
  },
  gridV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: colors.accentPrimarySubtle,
    left: '50%',
  },
  vinylOuter: {
    width: 130, height: 130, borderRadius: 65,
    borderWidth: 2, borderColor: palette.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  vinylMiddle: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 1.5, borderColor: palette.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  vinylInner: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 1, borderColor: colors.accentPrimaryGlow,
    alignItems: 'center', justifyContent: 'center',
  },
  vinylDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: palette.orange,
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 6,
  },
  trackInfo: {
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: 8,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamily.displayBold,
    letterSpacing: ls.normal,
  },
  progressContainer: {
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  progressTrack: {
    height: 3,
    backgroundColor: palette.iceGlow,
    borderRadius: 2,
    overflow: 'hidden',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomWidth: 0.5,
    borderBottomColor: palette.iceGlow,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    paddingVertical: spacing.xl,
  },
  transportCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.borderSubtle,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  skipVoteBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: palette.midnight,
    borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: palette.orange,
    minWidth: 22, alignItems: 'center',
  },
  skipVoteText: {
    fontSize: 8, letterSpacing: ls.normal, fontWeight: fontWeight.bold,
  },
  phaseCancelBadge: {
    position: 'absolute', top: -4, left: -4,
    backgroundColor: palette.steel,
    borderRadius: 8, paddingHorizontal: 2, paddingVertical: 1,
    borderWidth: 1, borderColor: palette.green,
    minWidth: 18, alignItems: 'center',
  },
  phaseCancelBadgeText: {
    fontSize: 9,
  },
  playPauseBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: palette.orange,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 16,
    elevation: 10,
  },
});

export default NowPlayingCard;
