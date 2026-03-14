import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tacticalTokens } from '../theme/tacticalTokens';

interface SkipVoteState {
  votes: number;
  threshold: number;
}

interface TacticalTransportDeckProps {
  hasCurrentTrack: boolean;
  isPlaying: boolean;
  isLoading?: boolean;
  canSkip: boolean;
  isVoteSkipMode: boolean;
  hasVotedToSkip: boolean;
  skipVoteState: SkipVoteState | null;
  onQueueOpen: () => void;
  onChatOpen: () => void;
  onPlayPause: () => void;
  onSkip: () => void;
}

export function TacticalTransportDeck({
  hasCurrentTrack,
  isPlaying,
  isLoading = false,
  canSkip,
  isVoteSkipMode,
  hasVotedToSkip,
  skipVoteState,
  onQueueOpen,
  onChatOpen,
  onPlayPause,
  onSkip,
}: TacticalTransportDeckProps) {
  const skipText = isVoteSkipMode && skipVoteState
    ? `${skipVoteState.votes}/${skipVoteState.threshold}`
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.transportRow}>
        <Pressable
          onPress={onQueueOpen}
          style={({ pressed }) => [styles.systemButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open signal chain"
        >
          <Text style={styles.systemText}>QUEUE</Text>
        </Pressable>

        <View style={styles.playGroup}>
          <View style={[styles.transportButton, styles.disabledTransport]}>
            <Ionicons name="play-skip-back-outline" size={18} color={tacticalTokens.colors.white} />
          </View>

          <Pressable
            onPress={onPlayPause}
            disabled={!hasCurrentTrack}
            style={({ pressed }) => [
              styles.playButton,
              (!hasCurrentTrack || isLoading) && styles.disabledTransport,
              pressed && hasCurrentTrack && styles.playPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause playback' : 'Play playback'}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={tacticalTokens.colors.void} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={30}
                color={tacticalTokens.colors.void}
                style={!isPlaying ? { marginLeft: 3 } : undefined}
              />
            )}
          </Pressable>

          <Pressable
            onPress={onSkip}
            disabled={!canSkip || !hasCurrentTrack}
            style={({ pressed }) => [
              styles.transportButton,
              (!canSkip || !hasCurrentTrack) && styles.disabledTransport,
              isVoteSkipMode && hasVotedToSkip && styles.skipVoted,
              pressed && canSkip && hasCurrentTrack && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isVoteSkipMode ? 'Vote to skip' : 'Skip track'}
          >
            <Ionicons
              name={isVoteSkipMode ? 'hand-right-outline' : 'play-skip-forward-outline'}
              size={18}
              color={
                isVoteSkipMode && hasVotedToSkip
                  ? tacticalTokens.colors.orange
                  : tacticalTokens.colors.white
              }
            />
            {skipText ? <Text style={styles.skipText}>{skipText}</Text> : null}
          </Pressable>
        </View>

        <Pressable
          onPress={onChatOpen}
          style={({ pressed }) => [styles.systemButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open chat"
        >
          <Text style={styles.systemText}>CHAT</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tacticalTokens.spacing.sm,
    marginHorizontal: tacticalTokens.spacing.xl,
    marginBottom: tacticalTokens.spacing.xs,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  systemButton: {
    width: 64,
    height: 52,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    borderRadius: tacticalTokens.radius.sharp,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: '#8A8A8A',
    letterSpacing: 1.2,
  },
  playGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: tacticalTokens.spacing.xs,
    height: 52,
  },
  transportButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: '#161616',
    borderRadius: tacticalTokens.radius.sharp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledTransport: {
    opacity: 0.7,
  },
  playButton: {
    flex: 2,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.white,
    borderRadius: tacticalTokens.radius.sharp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  skipVoted: {
    borderColor: tacticalTokens.colors.orange,
  },
  skipText: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
  },
});

export default TacticalTransportDeck;
