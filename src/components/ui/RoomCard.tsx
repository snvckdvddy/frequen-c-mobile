/**
 * Room Card — Discover feed room entry.
 *
 * Convergence Strategy §4.2:
 * Height: 160pt
 * Background: Blurred album art at 30% opacity over palette.steel
 * Room mode badge: Top-left pill
 * LIVE indicator: Top-right, neonGreen dot + listener count
 * Room name: 18pt bold frost
 * Curator: 14pt silver
 * Now playing: 12pt ice
 * Join button: ice fill, void text, pill shape, 36pt height
 * Corner radius: 12pt
 */

import React from 'react';
import { View, StyleSheet, Image, ImageBackground, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { RoomModeBadge } from './RoomModeBadge';
import { LivePulse } from './LivePulse';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';
import type { RoomMode } from '../../types';

interface RoomCardProps {
  roomName: string;
  hostUsername: string;
  roomMode: RoomMode;
  isLive: boolean;
  listenerCount: number;
  genre?: string;
  currentTrack?: { title: string; artist: string; albumArt?: string };
  onJoin: () => void;
  onPress?: () => void;
}

export function RoomCard({
  roomName,
  hostUsername,
  roomMode,
  isLive,
  listenerCount,
  genre,
  currentTrack,
  onJoin,
  onPress,
}: RoomCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${roomName} by ${hostUsername}, ${roomMode} mode${isLive ? `, live with ${listenerCount} listeners` : ''}${currentTrack ? `, playing ${currentTrack.title} by ${currentTrack.artist}` : ''}`}
    >
      {/* Background: album art blurred if available */}
      {currentTrack?.albumArt && (
        <Image
          source={{ uri: currentTrack.albumArt }}
          style={styles.bgImage}
          blurRadius={40}
        />
      )}
      {/* Overlay for readability */}
      <View style={styles.overlay} />

      {/* Content */}
      <View style={styles.content}>
        {/* Top row: Mode badge + Live indicator */}
        <View style={styles.topRow}>
          <RoomModeBadge mode={roomMode} variant="full" />
          {isLive && (
            <View style={styles.liveIndicator}>
              <LivePulse size={6} showLabel={false} />
              <Text variant="label" color={palette.frost} style={{ fontSize: 12 }}>
                {listenerCount}
              </Text>
            </View>
          )}
        </View>

        {/* Room info */}
        <View style={styles.roomInfo}>
          <Text variant="h3" color={palette.frost} numberOfLines={1}>
            {roomName}
          </Text>
          <Text variant="bodySmall" color={palette.silver} numberOfLines={1}>
            @{hostUsername}{genre ? ` · ${genre}` : ''}
          </Text>
          {currentTrack && (
            <View style={styles.nowPlayingRow}>
              <Ionicons name="musical-note" size={12} color={palette.orange} />
              <Text variant="label" color={palette.orange} numberOfLines={1} style={{ fontSize: 12 }}>
                {currentTrack.artist} – {currentTrack.title}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom row: avatars placeholder + join button */}
        <View style={styles.bottomRow}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={styles.joinBtn} onPress={onJoin} activeOpacity={0.75} accessibilityRole="button" accessibilityLabel={`Join ${roomName}`}>
            <Text variant="labelLarge" color={palette.void} style={{ fontSize: 13 }}>
              Join
            </Text>
            <Ionicons name="arrow-forward" size={14} color={palette.void} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 160,
    borderRadius: 12,
    backgroundColor: palette.midnight,
    overflow: 'hidden',
    marginHorizontal: spacing.screenPadding,
    marginBottom: spacing.sm,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(22, 27, 40, 0.75)', // steel at 75%
  },
  content: {
    flex: 1,
    padding: spacing.cardPadding,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // liveDot replaced by <LivePulse /> component — §7 animated pulse
  roomInfo: {
    gap: 2,
  },
  nowPlayingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 16,
    borderRadius: spacing.radius.full,
    backgroundColor: palette.ice,
    gap: 4,
  },
});

export default RoomCard;
