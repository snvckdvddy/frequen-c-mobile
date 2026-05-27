/**
 * DevPanel — operator quick-test surface.
 *
 * Rendered as a Modal sheet by DevModeRoot when the floating DEV
 * button is tapped. Contains globally-executable test actions —
 * deliberately no per-screen plumbing in V1. Add actions that need
 * screen context (e.g. force-room-mode, fill queue with mocks) when
 * we have a clear pattern for it (likely a global action bus that
 * screens register handlers on).
 *
 * V1 actions (all globally executable, no screen dependencies):
 *   1. Toggle isHost UI override (null -> true -> false -> null cycle)
 *      — the headliner: lets one operator preview both host AND
 *        non-host UI without needing a second device + account
 *   2. Reset first-time-visit flags (clears every screen's "seen" state)
 *   3. Reset Read Manual toggle (turns the global toggle back off)
 *   4. Disable Dev Mode (clean exit)
 *
 * Visual design: borrows from TacticalSystemPreferencesPanel pattern
 * (dark Modal with sectioned content) but with deliberately-distinct
 * styling (acid accent, "DEV" prefixes) so it never gets confused for
 * a production surface. If a user somehow stumbles into this they
 * should immediately know it's not the real app UI.
 */

import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';
import { useAuth } from '../../contexts/AuthContext';
import { useDevMode } from '../../hooks/useDevMode';
import { useDevOverrides } from '../../contexts/DevOverridesContext';
import { useManualMode } from '../../hooks/useManualMode';

interface DevPanelProps {
  visible: boolean;
  onClose: () => void;
}

// Storage keys we know how to reset. Kept here as the dev-panel's
// canonical list — if a new persisted state key gets added that the
// operator might want to reset for testing, add it here.
const MANUAL_SEEN_STORAGE_KEY = 'frequenc.manualSeen';

function formatHostOverride(value: boolean | null): string {
  if (value === null) return 'OFF (real)';
  return value ? 'FORCED HOST' : 'FORCED GUEST';
}

function nextHostOverride(value: boolean | null): boolean | null {
  // Cycle: null (real) -> true (forced host) -> false (forced guest) -> null
  if (value === null) return true;
  if (value === true) return false;
  return null;
}

export function DevPanel({ visible, onClose }: DevPanelProps) {
  const { user } = useAuth();
  const { setDevMode } = useDevMode();
  const { isHostOverride, setIsHostOverride, resetOverrides } = useDevOverrides();
  const { setReadManual } = useManualMode();

  const handleCycleHostOverride = useCallback(() => {
    setIsHostOverride(nextHostOverride(isHostOverride));
  }, [isHostOverride, setIsHostOverride]);

  const handleResetFirstTimeVisit = useCallback(() => {
    AsyncStorage.removeItem(MANUAL_SEEN_STORAGE_KEY).catch(() => {});
    // Note: useFirstTimeVisit's in-memory map won't reset until next
    // app launch. That's acceptable — operator can also fully relaunch
    // to see the effect. Could improve by adding a reset broadcast to
    // the hook later if it becomes a real friction.
  }, []);

  const handleResetReadManual = useCallback(() => {
    setReadManual(false);
  }, [setReadManual]);

  const handleDisableDevMode = useCallback(() => {
    // Also clear any active overrides so we don't leave hidden state
    // affecting the app after dev mode is turned off.
    resetOverrides();
    setDevMode(false);
    onClose();
  }, [resetOverrides, setDevMode, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>DEV PANEL</Text>
              <Text style={styles.title}>OPERATOR TEST SURFACE</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close dev panel"
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={20} color={tacticalTokens.colors.white} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status readout */}
            <Text style={styles.sectionLabel}>STATUS</Text>
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusKey}>USER</Text>
                <Text style={styles.statusValue}>
                  {user?.username ? `@${user.username}` : '— (not signed in)'}
                </Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusKey}>HOST OVERRIDE</Text>
                <Text style={[styles.statusValue, isHostOverride !== null && styles.statusValueActive]}>
                  {formatHostOverride(isHostOverride)}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <Text style={styles.sectionLabel}>ACTIONS</Text>

            <Pressable
              onPress={handleCycleHostOverride}
              accessibilityRole="button"
              accessibilityLabel="Cycle isHost override"
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <View style={styles.actionHeader}>
                <Ionicons name="person-circle-outline" size={18} color={tacticalTokens.colors.acid} />
                <Text style={styles.actionLabel}>CYCLE HOST OVERRIDE</Text>
              </View>
              <Text style={styles.actionDescription}>
                {'Cycle: OFF → FORCED HOST → FORCED GUEST → OFF. Preview the non-host UI without needing a second device.'}
              </Text>
              <Text style={styles.actionCurrent}>
                Currently: {formatHostOverride(isHostOverride)}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleResetFirstTimeVisit}
              accessibilityRole="button"
              accessibilityLabel="Reset first-time-visit flags"
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <View style={styles.actionHeader}>
                <Ionicons name="refresh-outline" size={18} color={tacticalTokens.colors.acid} />
                <Text style={styles.actionLabel}>RESET FIRST-TIME-VISIT FLAGS</Text>
              </View>
              <Text style={styles.actionDescription}>
                Clears every screen's "manual auto-shown once" memory. Re-launch the app to see manual auto-open again on first room entry / login screen / etc.
              </Text>
            </Pressable>

            <Pressable
              onPress={handleResetReadManual}
              accessibilityRole="button"
              accessibilityLabel="Reset Read Manual toggle"
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <View style={styles.actionHeader}>
                <Ionicons name="book-outline" size={18} color={tacticalTokens.colors.acid} />
                <Text style={styles.actionLabel}>RESET READ MANUAL TOGGLE</Text>
              </View>
              <Text style={styles.actionDescription}>
                Turns the global "Read Manual" toggle (Profile setting) back off. Useful for testing the gated-by-toggle vs first-time-visit paths separately.
              </Text>
            </Pressable>

            <Pressable
              onPress={handleDisableDevMode}
              accessibilityRole="button"
              accessibilityLabel="Disable dev mode"
              style={({ pressed }) => [styles.actionButton, styles.actionDanger, pressed && styles.pressed]}
            >
              <View style={styles.actionHeader}>
                <Ionicons name="power-outline" size={18} color={tacticalTokens.colors.orange} />
                <Text style={[styles.actionLabel, styles.actionLabelDanger]}>DISABLE DEV MODE</Text>
              </View>
              <Text style={styles.actionDescription}>
                Turn off the dev panel, clear all overrides, and hide the floating DEV button. Re-enable by tapping the BUILD row in Profile 5 times.
              </Text>
            </Pressable>

            <Text style={styles.footer}>
              Dev Mode is operator-only. Hidden from normal users.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: tacticalTokens.colors.void,
    borderTopWidth: 2,
    borderTopColor: tacticalTokens.colors.acid,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82, 240, 58, 0.16)', // acid alpha
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 2,
    color: tacticalTokens.colors.acid,
  },
  title: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  scrollContent: {
    padding: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.xl,
  },
  sectionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 2,
    color: tacticalTokens.colors.textDim,
    marginBottom: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.md,
  },
  statusCard: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matteGhost,
    padding: tacticalTokens.spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  statusKey: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  statusValue: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
  },
  statusValueActive: {
    color: tacticalTokens.colors.acid,
  },
  actionButton: {
    marginBottom: tacticalTokens.spacing.sm,
    padding: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  actionDanger: {
    borderColor: 'rgba(255, 122, 69, 0.4)', // orange alpha
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  actionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.acid,
    letterSpacing: 1.2,
  },
  actionLabelDanger: {
    color: tacticalTokens.colors.orange,
  },
  actionDescription: {
    marginTop: 6,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    lineHeight: 16,
    color: tacticalTokens.colors.textSoft,
  },
  actionCurrent: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1,
  },
  footer: {
    marginTop: tacticalTokens.spacing.lg,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    textAlign: 'center',
    letterSpacing: 1,
  },
});

export default DevPanel;
