import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomMode } from '../../../types';
import { formatModeLabel, getModeBlockColors, tacticalTokens } from '../theme/tacticalTokens';

interface TacticalRoomHeaderProps {
  roomName: string;
  systemId: string;
  roomMode: RoomMode;
  onBack: () => void;
  onSettingsPress: () => void;
}

export function TacticalRoomHeader({
  roomName,
  systemId,
  roomMode,
  onBack,
  onSettingsPress,
}: TacticalRoomHeaderProps) {
  const modeColors = getModeBlockColors(roomMode);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.iconBlock, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={tacticalTokens.colors.white} />
        </Pressable>

        <View style={styles.textWrap}>
          <Text style={styles.systemLabel}>SYS.FREQ // {systemId}</Text>
          <Text style={styles.roomName} numberOfLines={1}>
            {roomName.toUpperCase()}
          </Text>
        </View>

        <View style={styles.rightCluster}>
          <View
            style={[
              styles.modeBlock,
              {
                backgroundColor: modeColors.backgroundColor,
                borderColor: modeColors.borderColor,
              },
            ]}
          >
            <Text style={[styles.modeText, { color: modeColors.color }]}>
              {formatModeLabel(roomMode)}
            </Text>
          </View>
          <Pressable
            onPress={onSettingsPress}
            style={({ pressed }) => [styles.iconBlock, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Room settings"
          >
            <Ionicons name="options-outline" size={20} color={tacticalTokens.colors.white} />
          </Pressable>
        </View>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.xs,
    backgroundColor: tacticalTokens.colors.void,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  iconBlock: {
    width: 38,
    height: 38,
    borderRadius: tacticalTokens.radius.sharp,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  systemLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    letterSpacing: 1.8,
    color: tacticalTokens.colors.textSoft,
    marginBottom: 3,
  },
  roomName: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title + 2,
    lineHeight: tacticalTokens.fontSize.title + 4,
    color: tacticalTokens.colors.white,
  },
  rightCluster: {
    alignItems: 'flex-end',
    gap: 6,
  },
  modeBlock: {
    minWidth: 82,
    minHeight: 28,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: tacticalTokens.radius.sharp,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  rule: {
    marginTop: tacticalTokens.spacing.sm,
    height: 2,
    backgroundColor: tacticalTokens.colors.guideSoft,
  },
});

export default TacticalRoomHeader;
