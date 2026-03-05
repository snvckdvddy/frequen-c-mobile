/**
 * RoomSettingsPanel — Host-only live behavior editor.
 *
 * Full-screen bottom sheet modal allowing the host to modify
 * room behaviors while the session is active. Changes emit
 * via the updateBehaviors socket event and propagate to all clients.
 *
 * UI mirrors the Advanced section from CreateSessionScreen:
 *   - Queue Ordering pill selector
 *   - Skip Access pill selector
 *   - Boolean toggle rows for each feature flag
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { VoidSurface, LEDReadout } from '../../design/components';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontSize } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';
import type { RoomBehaviors } from '../../types';

// ─── Option Data ─────────────────────────────────────────────

const QUEUE_ORDERING_OPTIONS: { key: RoomBehaviors['queueOrdering']; label: string }[] = [
  { key: 'fifo', label: 'FIFO' },
  { key: 'roundRobin', label: 'ROUND ROBIN' },
  { key: 'voteWeighted', label: 'VOTE WEIGHTED' },
];

const SKIP_ACCESS_OPTIONS: { key: RoomBehaviors['skipAccess']; label: string }[] = [
  { key: 'anyone', label: 'ANYONE' },
  { key: 'hostOnly', label: 'HOST ONLY' },
  { key: 'voteRequired', label: 'VOTE REQ.' },
];

const BEHAVIOR_TOGGLES: {
  key: keyof Pick<
    RoomBehaviors,
    'voteReordersQueue' | 'requiresApproval' | 'allowOverdrive' |
    'allowPhaseCancel' | 'allowPhantomPower' | 'forecastEnabled' | 'duelEnabled'
  >;
  label: string;
  desc: string;
}[] = [
  { key: 'voteReordersQueue', label: 'Votes Reorder Queue', desc: 'Higher-voted tracks rise to the top.' },
  { key: 'requiresApproval', label: 'Require Approval', desc: 'Non-host additions need host OK.' },
  { key: 'allowOverdrive', label: 'Allow Overdrive', desc: 'Force a track to the top (25 CV).' },
  { key: 'allowPhaseCancel', label: 'Allow Phase Cancel', desc: 'Block the next skip (15 CV).' },
  { key: 'allowPhantomPower', label: 'Allow Phantom Power', desc: 'Boost a track +48V (5 CV).' },
  { key: 'forecastEnabled', label: 'Frequency Forecast', desc: 'Predict the next track for CV.' },
  { key: 'duelEnabled', label: 'Crossfader Duel', desc: 'Head-to-head track battles.' },
];

// ─── Props ───────────────────────────────────────────────────

interface RoomSettingsPanelProps {
  visible: boolean;
  behaviors: RoomBehaviors;
  onClose: () => void;
  /** Emits partial behavior update to all clients via socket */
  onUpdateBehaviors: (partial: Partial<RoomBehaviors>) => void;
}

// ─── Component ───────────────────────────────────────────────

export function RoomSettingsPanel({
  visible,
  behaviors,
  onClose,
  onUpdateBehaviors,
}: RoomSettingsPanelProps) {
  // Local copy for immediate UI feedback
  const [local, setLocal] = useState<RoomBehaviors>(behaviors);

  // Sync with external state when panel opens or behaviors change
  useEffect(() => {
    setLocal(behaviors);
  }, [behaviors, visible]);

  // Emit change and update local state simultaneously
  const update = useCallback((partial: Partial<RoomBehaviors>) => {
    setLocal((prev) => ({ ...prev, ...partial }));
    onUpdateBehaviors(partial);
  }, [onUpdateBehaviors]);

  const toggleBool = useCallback((key: keyof RoomBehaviors) => {
    const current = local[key];
    if (typeof current === 'boolean') {
      update({ [key]: !current } as Partial<RoomBehaviors>);
    }
  }, [local, update]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop} accessibilityViewIsModal>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} accessible={false} />
        <VoidSurface style={styles.sheet} grain={false}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <LEDReadout value="ROOM SETTINGS" variant="amber" size="md" />
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close room settings"
            >
              <Ionicons name="close" size={24} color={palette.slate} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* ═══ QUEUE ORDERING ═════════════════════════════ */}
            <Text style={styles.sectionLabel}>QUEUE ORDERING</Text>
            <View style={styles.pillRow}>
              {QUEUE_ORDERING_OPTIONS.map((opt) => {
                const isActive = local.queueOrdering === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.pill, isActive && styles.pillActive]}
                    onPress={() => update({ queueOrdering: opt.key })}
                    accessibilityRole="button"
                    accessibilityLabel={`Queue ordering: ${opt.label}`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══ SKIP ACCESS ════════════════════════════════ */}
            <Text style={styles.sectionLabel}>SKIP ACCESS</Text>
            <View style={styles.pillRow}>
              {SKIP_ACCESS_OPTIONS.map((opt) => {
                const isActive = local.skipAccess === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.pill, isActive && styles.pillActive]}
                    onPress={() => update({ skipAccess: opt.key })}
                    accessibilityRole="button"
                    accessibilityLabel={`Skip access: ${opt.label}`}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ═══ FEATURE TOGGLES ════════════════════════════ */}
            <Text style={styles.sectionLabel}>FEATURES</Text>
            {BEHAVIOR_TOGGLES.map((toggle) => {
              const isOn = !!local[toggle.key];
              return (
                <View key={toggle.key} style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>{toggle.label}</Text>
                    <Text style={styles.toggleDesc}>{toggle.desc}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggle, isOn && styles.toggleActive]}
                    onPress={() => toggleBool(toggle.key)}
                    accessibilityRole="switch"
                    accessibilityLabel={toggle.label}
                    accessibilityState={{ checked: isOn }}
                    accessibilityHint={toggle.desc}
                  >
                    <View style={[styles.toggleKnob, isOn && styles.toggleKnobActive]} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Bottom padding for scroll */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </VoidSurface>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: palette.iceGlow,
  },
  handle: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.iceGlow,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },

  // Section labels
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.slate,
    letterSpacing: 2,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },

  // Pill selectors
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  pill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.slate,
    alignItems: 'center',
  },
  pillActive: {
    borderColor: palette.amber,
    backgroundColor: 'rgba(255, 191, 0, 0.1)',
  },
  pillText: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: palette.slate,
    letterSpacing: 1,
  },
  pillTextActive: {
    color: palette.amber,
    fontWeight: '700',
  },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  toggleLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.frost,
    fontWeight: '600',
  },
  toggleDesc: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.slate,
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    paddingHorizontal: 2,
    marginLeft: spacing.sm,
  },
  toggleActive: {
    backgroundColor: 'rgba(255, 191, 0, 0.25)',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.slate,
  },
  toggleKnobActive: {
    backgroundColor: palette.amber,
    alignSelf: 'flex-end',
  },
});
