/**
 * RoomHeader — Session room top bar.
 *
 * Layout: [← back]  [mode badge + room name]  [settings + status]
 * Extracted from SessionRoomScreen for modularity.
 *
 * Voltage Sag: Orange accents shift to warm amber, LOW VOLTAGE badge appears.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { StatusLight } from '../../design/components';
import { CVPill } from '../ui/CVPill';
import { palette } from '../../design/tokens/materials';
import { colors } from '../../design/tokens/colors';
import { fontFamily, fontSize, letterSpacing as ls } from '../../design/tokens/typography';
import { useTheme } from '../../contexts/ThemeContext';
import type { RoomMode } from '../../types';

interface RoomHeaderProps {
  roomName: string;
  roomMode: RoomMode;
  isHost: boolean;
  onBack: () => void;
  onSettingsPress: () => void;
  onModePress?: () => void;
  /** CV economy props for the expandable power moves pill */
  cvBalance?: number;
  cvCanUse?: (moveType: string) => boolean;
  cvGetCooldown?: (moveType: string) => number;
  onPowerMove?: (moveType: string) => void;
  allowOverdrive?: boolean;
  allowPhaseCancel?: boolean;
  allowPhantomPower?: boolean;
}

export function RoomHeader({
  roomName,
  roomMode,
  isHost,
  onBack,
  onSettingsPress,
  onModePress,
  cvBalance,
  cvCanUse,
  cvGetCooldown,
  onPowerMove,
  allowOverdrive,
  allowPhaseCancel,
  allowPhantomPower,
}: RoomHeaderProps) {
  const { isVoltageSag, accent } = useTheme();

  return (
    <>
      {/* ═══ HEADER — Gemini V7 Layout ═══════════════════ */}
      <View style={styles.header}>
        {/* ← Back (chevron down) */}
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-down" size={24} color={palette.silver} />
        </TouchableOpacity>

        {/* Center: Mode Badge + Room Name stacked */}
        <View style={styles.headerCenter}>
          <TouchableOpacity
            onPress={isHost ? onModePress : undefined}
            activeOpacity={isHost ? 0.6 : 1}
            style={[styles.modeBadgeBtn, { borderColor: accent }]}
            accessibilityRole={isHost ? 'button' : 'text'}
            accessibilityLabel={`Room mode: ${roomMode}`}
            accessibilityHint={isHost ? 'Tap to change room mode' : undefined}
          >
            <Text style={[styles.modeBadgeText, { color: accent }]}>
              {(roomMode || 'campfire').toUpperCase().replace(/([a-z])([A-Z])/g, '$1 $2')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {roomName}
          </Text>
        </View>

        {/* Right: Settings icon + status dot + optional voltage sag badge */}
        <View style={styles.headerRight}>
          {/* LOW VOLTAGE indicator */}
          {isVoltageSag && (
            <View style={styles.sagBadge} accessibilityLabel="Low battery mode active">
              <Ionicons name="flash" size={10} color={palette.amber} />
              <Text style={styles.sagBadgeText}>LOW V</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={onSettingsPress}
            style={styles.overflowBtn}
            accessibilityRole="button"
            accessibilityLabel="Room settings"
          >
            <Ionicons name="options-outline" size={22} color={palette.silver} />
          </TouchableOpacity>
          <StatusLight variant="pulse" color="green" size="sm" />
        </View>
      </View>

      {/* SIGNAL FLOW info row */}
      <View style={styles.signalFlowRow}>
        <View style={styles.signalFlowLeft}>
          <Ionicons name="git-network-outline" size={14} color={palette.slate} />
          <Text style={styles.signalFlowLabel}>SIGNAL FLOW</Text>
        </View>
        <View style={styles.signalFlowRight}>
          <View style={[styles.codecBadge, { borderColor: accent }]}>
            <Text style={[styles.codecText, { color: accent }]}>
              {isVoltageSag ? 'MONO | 128KBPS' : 'STEREO | 320KBPS'}
            </Text>
          </View>
          {cvBalance != null && cvCanUse && cvGetCooldown && onPowerMove && (
            <CVPill
              balance={cvBalance}
              canUse={cvCanUse}
              getCooldownRemaining={cvGetCooldown}
              onPowerMove={onPowerMove}
              allowOverdrive={allowOverdrive}
              allowPhaseCancel={allowPhaseCancel}
              allowPhantomPower={allowPhantomPower}
            />
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modeBadgeBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  modeBadgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: ls.wide,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.displayBold,
    color: palette.frost,
    letterSpacing: ls.normal,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overflowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ─── LOW VOLTAGE badge ────────────────────────────────
  sagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 179, 71, 0.40)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
  },
  sagBadgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    color: palette.amber,
    letterSpacing: ls.wide,
    fontWeight: '700',
  },
  // ─── Signal Flow row ──────────────────────────────────
  signalFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  signalFlowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalFlowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signalFlowLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  codecBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codecText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: ls.wide,
  },
});

export default RoomHeader;
