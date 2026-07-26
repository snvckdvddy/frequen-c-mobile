import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
  /** Host-output model: only the host's device has transport over the
   *  audio. Guests get a live state indicator instead of a play/pause
   *  button that would silently do nothing. */
  isHost: boolean;
  canSkip: boolean;
  isVoteSkipMode: boolean;
  hasVotedToSkip: boolean;
  skipVoteState: SkipVoteState | null;
  onQueueOpen: () => void;
  onChatOpen: () => void;
  onPlayPause: () => void;
  onSkip: () => void;
  /** Messages received while the chat panel was closed */
  chatUnreadCount?: number;
}

export function TacticalTransportDeck({
  hasCurrentTrack,
  isPlaying,
  isLoading = false,
  isHost,
  canSkip,
  isVoteSkipMode,
  hasVotedToSkip,
  skipVoteState,
  onQueueOpen,
  onChatOpen,
  onPlayPause,
  onSkip,
  chatUnreadCount = 0,
}: TacticalTransportDeckProps) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const skipText = isVoteSkipMode && skipVoteState
    ? `${skipVoteState.votes}/${skipVoteState.threshold}`
    : null;
  const idle = !hasCurrentTrack;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.transportRow, compact && styles.transportRowCompact]}>
        <Pressable
          onPress={onQueueOpen}
          style={({ pressed }) => [styles.systemButton, compact && styles.systemButtonCompact, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open signal chain"
        >
          <Text style={styles.systemText}>QUEUE</Text>
        </Pressable>

        <View style={[styles.playGroup, compact && styles.playGroupCompact]}>
          <View style={[styles.transportButton, compact && styles.transportButtonCompact, idle && styles.disabledTransport]}>
            <Ionicons
              name="play-skip-back-outline"
              size={18}
              color={idle ? '#6A6A6A' : tacticalTokens.colors.white}
            />
          </View>

          {isHost ? (
            <Pressable
              onPress={onPlayPause}
              disabled={!hasCurrentTrack}
              style={({ pressed }) => [
                styles.playButton,
                compact && styles.playButtonCompact,
                (!hasCurrentTrack || isLoading) && styles.disabledTransport,
                pressed && hasCurrentTrack && styles.playPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause playback' : 'Play playback'}
              accessibilityState={{ disabled: !hasCurrentTrack }}
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
          ) : (
            <View
              style={[
                styles.playButton,
                styles.hostOutputIndicator,
                compact && styles.playButtonCompact,
                idle && styles.disabledTransport,
              ]}
              accessibilityRole="text"
              accessibilityLabel={
                isPlaying
                  ? 'Audio is playing from the host device'
                  : 'Host playback is paused'
              }
            >
              <Ionicons
                name="radio-outline"
                size={18}
                color={isPlaying ? tacticalTokens.colors.white : '#6A6A6A'}
              />
              <Text style={[styles.hostOutputText, !isPlaying && styles.hostOutputTextPaused]}>
                {isPlaying ? 'HOST OUTPUT' : 'HOST PAUSED'}
              </Text>
            </View>
          )}

          <Pressable
            onPress={onSkip}
            disabled={!canSkip || !hasCurrentTrack}
            style={({ pressed }) => [
              styles.transportButton,
              compact && styles.transportButtonCompact,
              (!canSkip || !hasCurrentTrack) && styles.disabledTransport,
              isVoteSkipMode && hasVotedToSkip && styles.skipVoted,
              pressed && canSkip && hasCurrentTrack && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isVoteSkipMode ? 'Vote to skip' : 'Skip track'}
            accessibilityState={{ disabled: !canSkip || !hasCurrentTrack }}
          >
            <Ionicons
              name={isVoteSkipMode ? 'hand-right-outline' : 'play-skip-forward-outline'}
              size={18}
              color={
                !hasCurrentTrack
                  ? '#6A6A6A'
                  : isVoteSkipMode && hasVotedToSkip
                    ? tacticalTokens.colors.orange
                    : tacticalTokens.colors.white
              }
            />
            {skipText ? <Text style={styles.skipText}>{skipText}</Text> : null}
          </Pressable>
        </View>

        <Pressable
          onPress={onChatOpen}
          style={({ pressed }) => [styles.systemButton, compact && styles.systemButtonCompact, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={
            chatUnreadCount > 0
              ? `Open chat, ${chatUnreadCount} unread`
              : 'Open chat'
          }
        >
          <Text style={styles.systemText}>CHAT</Text>
          {chatUnreadCount > 0 ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadPillText}>
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {idle && (
        <View style={styles.idleCenter}>
          <Text style={[styles.idleCaption, compact && styles.idleCaptionCompact]}>PATCH TO ARM PLAYBACK</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tacticalTokens.spacing.xs + 2,
    marginHorizontal: tacticalTokens.spacing.xl,
    marginBottom: tacticalTokens.spacing.xs,
  },
  containerCompact: {
    marginHorizontal: tacticalTokens.spacing.lg,
  },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  transportRowCompact: {
    gap: tacticalTokens.spacing.xs,
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
  systemButtonCompact: {
    width: 60,
    height: 48,
  },
  systemText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys + 1,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
  },
  playGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: tacticalTokens.spacing.xs,
    height: 52,
  },
  playGroupCompact: {
    height: 48,
  },
  idleCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  transportButtonCompact: {
    minWidth: 44,
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
  playButtonCompact: {
    flex: 1.7,
  },
  idleCaption: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1.5,
  },
  idleCaptionCompact: {
    fontSize: tacticalTokens.fontSize.sys - 1,
    letterSpacing: 1.2,
  },
  playPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  hostOutputIndicator: {
    backgroundColor: '#161616',
    borderColor: tacticalTokens.colors.border,
    flexDirection: 'row',
    gap: 8,
  },
  hostOutputText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys + 1,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.2,
  },
  hostOutputTextPaused: {
    color: '#6A6A6A',
  },
  unreadPill: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: tacticalTokens.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadPillText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 9,
    color: tacticalTokens.colors.void,
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
