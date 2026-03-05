/**
 * CVPill — Expandable Control Voltage balance + power moves tray.
 *
 * Compact: shows ⚡ balance as a pill badge.
 * Expanded: reveals 3 power moves with cost, availability, and cooldown.
 *
 * Phase 3 convergence: Replaces long-press-only power move access
 * with a persistent, tappable affordance in the session UI.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontSize, letterSpacing as ls } from '../../design/tokens/typography';
import { useTheme } from '../../contexts/ThemeContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Power Move Config ───────────────────────────────────────

interface PowerMoveConfig {
  id: string;
  label: string;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  cost: number;
  color: string;
}

const POWER_MOVES: PowerMoveConfig[] = [
  {
    id: 'overdrive',
    label: 'Overdrive',
    shortLabel: 'OD',
    icon: 'flash',
    cost: 25,
    color: palette.orange,
  },
  {
    id: 'phase_cancel',
    label: 'Phase Cancel',
    shortLabel: 'PC',
    icon: 'shield',
    cost: 15,
    color: palette.ice,
  },
  {
    id: 'phantom_power',
    label: 'Phantom +48V',
    shortLabel: '+48V',
    icon: 'pulse',
    cost: 5,
    color: palette.green,
  },
];

// ─── Props ───────────────────────────────────────────────────

interface CVPillProps {
  balance: number;
  /** Check if a power move is usable (balance + cooldown) */
  canUse: (moveType: string) => boolean;
  /** Get remaining cooldown in ms */
  getCooldownRemaining: (moveType: string) => number;
  /** Fire a power move */
  onPowerMove: (moveType: string) => void;
  /** Whether the room allows each move (from behaviors) */
  allowOverdrive?: boolean;
  allowPhaseCancel?: boolean;
  allowPhantomPower?: boolean;
}

// ─── Component ───────────────────────────────────────────────

export function CVPill({
  balance,
  canUse,
  getCooldownRemaining,
  onPowerMove,
  allowOverdrive = true,
  allowPhaseCancel = true,
  allowPhantomPower = true,
}: CVPillProps) {
  const { isVoltageSag, accent } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  // Filter to only allowed moves
  const allowedMoves = POWER_MOVES.filter((m) => {
    if (m.id === 'overdrive' && !allowOverdrive) return false;
    if (m.id === 'phase_cancel' && !allowPhaseCancel) return false;
    if (m.id === 'phantom_power' && !allowPhantomPower) return false;
    return true;
  });

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [expanded]);

  const pillColor = isVoltageSag ? accent : palette.green;

  /** Format cooldown as "Xs" or "Xm" */
  const formatCooldown = (ms: number): string => {
    if (ms <= 0) return '';
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}s`;
    return `${Math.ceil(sec / 60)}m`;
  };

  return (
    <View style={styles.wrapper}>
      {/* ═══ COMPACT PILL ═══════════════════════════════════ */}
      <TouchableOpacity
        onPress={toggle}
        style={[styles.pill, { borderColor: pillColor }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Control Voltage: ${balance}. Tap to ${expanded ? 'collapse' : 'expand'} power moves.`}
      >
        <Ionicons name="flash" size={12} color={pillColor} />
        <Text style={[styles.pillValue, { color: pillColor }]}>{balance}</Text>
        <Animated.View style={{
          transform: [{
            rotate: expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '180deg'],
            }),
          }],
        }}>
          <Ionicons name="chevron-up" size={10} color={pillColor} />
        </Animated.View>
      </TouchableOpacity>

      {/* ═══ EXPANDED TRAY ══════════════════════════════════ */}
      {expanded && (
        <View style={styles.tray}>
          {allowedMoves.map((move) => {
            const available = canUse(move.id);
            const cooldownMs = getCooldownRemaining(move.id);
            const cooldownLabel = formatCooldown(cooldownMs);
            const insufficientCV = balance < move.cost;

            return (
              <TouchableOpacity
                key={move.id}
                style={[
                  styles.moveBtn,
                  !available && styles.moveBtnDisabled,
                ]}
                onPress={() => {
                  if (available) onPowerMove(move.id);
                }}
                disabled={!available}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={`${move.label}: ${move.cost} CV${!available ? ' (unavailable)' : ''}`}
                accessibilityState={{ disabled: !available }}
              >
                <Ionicons
                  name={move.icon}
                  size={16}
                  color={available ? move.color : palette.slate}
                />
                <View style={styles.moveMeta}>
                  <Text style={[
                    styles.moveLabel,
                    { color: available ? palette.frost : palette.slate },
                  ]}>
                    {move.shortLabel}
                  </Text>
                  <Text style={[
                    styles.moveCost,
                    { color: available ? move.color : palette.slate },
                  ]}>
                    {cooldownLabel || `${move.cost}`}
                  </Text>
                </View>
                {/* Cooldown indicator */}
                {cooldownMs > 0 && (
                  <View style={styles.cooldownDot} />
                )}
                {/* Insufficient CV indicator */}
                {insufficientCV && cooldownMs <= 0 && (
                  <Ionicons name="lock-closed" size={8} color={palette.slate} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-end',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  pillValue: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: ls.wide,
  },
  // ─── Expanded tray ──────────────────────────────────
  tray: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  moveBtn: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    minWidth: 54,
  },
  moveBtnDisabled: {
    opacity: 0.4,
  },
  moveMeta: {
    alignItems: 'center',
    gap: 1,
  },
  moveLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    letterSpacing: ls.wide,
    fontWeight: '600',
  },
  moveCost: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    letterSpacing: ls.normal,
  },
  cooldownDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.orange,
  },
});

export default CVPill;
