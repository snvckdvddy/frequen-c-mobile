import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RoomBehaviors, RoomMode } from '../../../types';
import { tacticalTokens } from '../theme/tacticalTokens';
import SignalChainModeSwitch from './SignalChainModeSwitch';

const QUEUE_ORDERING_OPTIONS: { key: RoomBehaviors['queueOrdering']; label: string }[] = [
  { key: 'fifo', label: 'FIFO' },
  { key: 'roundRobin', label: 'ROUND ROBIN' },
  { key: 'voteWeighted', label: 'VOTE WEIGHTED' },
];

const SKIP_ACCESS_OPTIONS: { key: RoomBehaviors['skipAccess']; label: string }[] = [
  { key: 'anyone', label: 'ANYONE' },
  { key: 'hostOnly', label: 'HOST ONLY' },
  { key: 'voteRequired', label: 'VOTE REQUIRED' },
];

const BEHAVIOR_TOGGLES: {
  key: keyof Pick<
    RoomBehaviors,
    'voteReordersQueue' | 'requiresApproval' | 'allowOverdrive' |
    'allowPhaseCancel' | 'allowPhantomPower' | 'forecastEnabled' | 'duelEnabled'
  >;
  label: string;
  description: string;
}[] = [
  { key: 'voteReordersQueue', label: 'Votes Reorder Queue', description: 'Higher-voted tracks rise to the top.' },
  { key: 'requiresApproval', label: 'Require Approval', description: 'Non-host additions need host approval.' },
  { key: 'allowOverdrive', label: 'Allow Overdrive', description: 'Force a track to the top for CV.' },
  { key: 'allowPhaseCancel', label: 'Allow Phase Cancel', description: 'Block the next skip for CV.' },
  { key: 'allowPhantomPower', label: 'Allow Phantom Power', description: 'Boost the active track with +48V.' },
  { key: 'forecastEnabled', label: 'Frequency Forecast', description: 'Enable prediction rounds for CV.' },
  { key: 'duelEnabled', label: 'Crossfader Duel', description: 'Enable head-to-head track battles.' },
];

interface TacticalSystemPreferencesPanelProps {
  visible: boolean;
  isHost: boolean;
  hasCurrentTrack: boolean;
  roomCode?: string;
  /**
   * Current room mode. Drives the ROOM MODE selector at the top of
   * host controls. Relocated from SignalChainSheetV2 (queue sheet)
   * 2026-05-13 — System Preferences is the canonical home for room
   * configuration, not the queue.
   */
  roomMode: RoomMode;
  /**
   * Mode change handler. Host-only — non-hosts won't see the selector
   * (SignalChainModeSwitch returns null for non-hosts). Caller is
   * responsible for the no-op-if-same-mode check + behavior preset
   * application + socket broadcast.
   */
  onSelectMode: (mode: RoomMode) => void;
  behaviors: RoomBehaviors;
  onClose: () => void;
  onShare: () => void | Promise<void>;
  onCopyCode: () => void | Promise<void>;
  onOpenChat: () => void;
  onOpenLyrics: () => void;
  onShowQrCode: () => void;
  onLeaveRoom: () => void;
  duelActionEnabled: boolean;
  duelActionDescription: string;
  onStartDuel: () => boolean | void | Promise<boolean | void>;
  canStartForecast: boolean;
  forecastActionDescription: string;
  onStartForecast: () => boolean | void | Promise<boolean | void>;
  onUpdateBehaviors: (partial: Partial<RoomBehaviors>) => void;
}

function ActionButton({
  label,
  description,
  icon,
  onPress,
  disabled = false,
  tone = 'default',
}: {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      style={({ pressed }) => [
        styles.actionButton,
        tone === 'danger' && styles.actionButtonDanger,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}
    >
      <View style={styles.actionHeader}>
        <Ionicons
          name={icon}
          size={18}
          color={tone === 'danger' ? tacticalTokens.colors.orange : tacticalTokens.colors.acid}
        />
        <Text style={[styles.actionLabel, tone === 'danger' && styles.actionLabelDanger]}>
          {label}
        </Text>
      </View>
      <Text style={styles.actionDescription}>{description}</Text>
    </Pressable>
  );
}

export function TacticalSystemPreferencesPanel({
  visible,
  isHost,
  hasCurrentTrack,
  roomCode,
  roomMode,
  onSelectMode,
  behaviors,
  onClose,
  onShare,
  onCopyCode,
  onOpenChat,
  onOpenLyrics,
  onShowQrCode,
  onLeaveRoom,
  duelActionEnabled,
  duelActionDescription,
  onStartDuel,
  canStartForecast,
  forecastActionDescription,
  onStartForecast,
  onUpdateBehaviors,
}: TacticalSystemPreferencesPanelProps) {
  const [hostControlsOpen, setHostControlsOpen] = useState(false);
  const [localBehaviors, setLocalBehaviors] = useState<RoomBehaviors>(behaviors);

  useEffect(() => {
    if (visible) {
      setLocalBehaviors(behaviors);
    }
  }, [behaviors, visible]);

  useEffect(() => {
    if (!visible) {
      setHostControlsOpen(false);
    }
  }, [visible]);

  const roomCodeLabel = useMemo(() => (roomCode ? roomCode.toUpperCase() : '----'), [roomCode]);

  const updateBehaviors = (partial: Partial<RoomBehaviors>) => {
    setLocalBehaviors((prev) => ({ ...prev, ...partial }));
    onUpdateBehaviors(partial);
  };

  const toggleBehavior = (key: keyof typeof localBehaviors) => {
    const value = localBehaviors[key];
    if (typeof value === 'boolean') {
      updateBehaviors({ [key]: !value } as Partial<RoomBehaviors>);
    }
  };

  const closeThen = (action: () => void | Promise<void>) => () => {
    onClose();
    void action();
  };

  const closeAfterSuccess = (action: () => boolean | void | Promise<boolean | void>) => async () => {
    const result = await action();
    if (result !== false) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>SYSTEM PREFERENCES</Text>
              <Text style={styles.roomCode}>ROOM // {roomCodeLabel}</Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close system preferences"
              style={({ pressed }) => [styles.closeButton, pressed && styles.actionPressed]}
            >
              <Ionicons name="close" size={20} color={tacticalTokens.colors.white} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>ROOM ACTIONS</Text>
            <View style={styles.actionGrid}>
              <ActionButton
                label="Share Room"
                description="Share the room link or QR handoff."
                icon="share-social-outline"
                onPress={closeThen(onShare)}
              />
              <ActionButton
                label="Copy Room Code"
                description="Copy the join code to the clipboard."
                icon="copy-outline"
                onPress={closeThen(onCopyCode)}
              />
              <ActionButton
                label="Chat"
                description="Open the room chat overlay."
                icon="chatbubble-ellipses-outline"
                onPress={closeThen(onOpenChat)}
              />
              <ActionButton
                label="Lyrics"
                description={hasCurrentTrack ? 'Open the lyrics overlay.' : 'Lyrics need an active track.'}
                icon="document-text-outline"
                onPress={closeThen(onOpenLyrics)}
                disabled={!hasCurrentTrack}
              />
              <ActionButton
                label="Show QR Code"
                description="Display the room QR code in-session."
                icon="qr-code-outline"
                onPress={closeThen(onShowQrCode)}
              />
              <ActionButton
                label="Leave Room"
                description={isHost ? 'End the session for everyone.' : 'Exit the current session.'}
                icon="exit-outline"
                onPress={closeThen(onLeaveRoom)}
                tone="danger"
              />
            </View>

            <Text style={styles.sectionLabel}>CONTROL PLANE</Text>
            {isHost && (
              <>
                <ActionButton
                  label="Start Duel"
                  description={duelActionDescription}
                  icon="git-compare-outline"
                  onPress={closeAfterSuccess(onStartDuel)}
                  disabled={!duelActionEnabled}
                />
                <ActionButton
                  label="Start Forecast"
                  description={forecastActionDescription}
                  icon="radio-outline"
                  onPress={closeAfterSuccess(onStartForecast)}
                  disabled={!canStartForecast}
                />
              </>
            )}
            <ActionButton
              label="Room Settings"
              description={isHost ? 'Open host behavior controls.' : 'Host-only behavior controls.'}
              icon="options-outline"
              onPress={() => {
                if (isHost) {
                  setHostControlsOpen((prev) => !prev);
                }
              }}
              disabled={!isHost}
            />

            {isHost && hostControlsOpen && (
              <View style={styles.hostControls}>
                {/*
                  ROOM MODE selector is the highest-level control because
                  picking a mode applies a preset that overrides queue
                  ordering, skip access, and approval requirements below.
                  Relocated from SignalChainSheetV2 (queue sheet) on
                  2026-05-13 — System Preferences is the canonical home
                  for room configuration; the queue sheet should be
                  about the queue, not host config.
                */}
                <SignalChainModeSwitch
                  mode={roomMode}
                  isHost={isHost}
                  onSelectMode={onSelectMode}
                />

                <Text style={styles.sectionLabel}>QUEUE ORDERING</Text>
                <View style={styles.pillRow}>
                  {QUEUE_ORDERING_OPTIONS.map((option) => {
                    const active = localBehaviors.queueOrdering === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => updateBehaviors({ queueOrdering: option.key })}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => [
                          styles.pill,
                          active && styles.pillActive,
                          pressed && styles.actionPressed,
                        ]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.sectionLabel}>SKIP ACCESS</Text>
                <View style={styles.pillRow}>
                  {SKIP_ACCESS_OPTIONS.map((option) => {
                    const active = localBehaviors.skipAccess === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => updateBehaviors({ skipAccess: option.key })}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => [
                          styles.pill,
                          active && styles.pillActive,
                          pressed && styles.actionPressed,
                        ]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.sectionLabel}>FEATURE FLAGS</Text>
                <View style={styles.toggleList}>
                  {BEHAVIOR_TOGGLES.map((toggle) => {
                    const enabled = !!localBehaviors[toggle.key];
                    return (
                      <Pressable
                        key={toggle.key}
                        onPress={() => toggleBehavior(toggle.key)}
                        accessibilityRole="switch"
                        accessibilityLabel={toggle.label}
                        accessibilityHint={toggle.description}
                        accessibilityState={{ checked: enabled }}
                        style={({ pressed }) => [
                          styles.toggleRow,
                          pressed && styles.actionPressed,
                        ]}
                      >
                        <View style={styles.toggleTextWrap}>
                          <Text style={styles.toggleLabel}>{toggle.label}</Text>
                          <Text style={styles.toggleDescription}>{toggle.description}</Text>
                        </View>
                        <View style={[styles.toggleTrack, enabled && styles.toggleTrackEnabled]}>
                          <View style={[styles.toggleKnob, enabled && styles.toggleKnobEnabled]} />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: tacticalTokens.colors.overlay,
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: tacticalTokens.colors.void,
    borderTopWidth: 1,
    borderColor: tacticalTokens.colors.acid,
    paddingTop: tacticalTokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 2,
    color: tacticalTokens.colors.acid,
    marginBottom: tacticalTokens.spacing.xs,
  },
  roomCode: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  content: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xxxl,
    paddingTop: tacticalTokens.spacing.lg,
  },
  sectionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 2,
    color: tacticalTokens.colors.textDim,
    marginBottom: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.sm,
  },
  actionGrid: {
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.md,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
    gap: tacticalTokens.spacing.xs,
  },
  actionButtonDanger: {
    borderColor: tacticalTokens.colors.orange,
  },
  actionButtonDisabled: {
    opacity: 0.42,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  actionLabel: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  actionLabelDanger: {
    color: tacticalTokens.colors.orange,
  },
  actionDescription: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textDim,
    lineHeight: 18,
  },
  hostControls: {
    marginTop: tacticalTokens.spacing.sm,
    paddingTop: tacticalTokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderSoft,
    gap: tacticalTokens.spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tacticalTokens.spacing.sm,
  },
  pill: {
    minWidth: 108,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  pillActive: {
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: '#0B1907',
  },
  pillText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    letterSpacing: 1.2,
    color: tacticalTokens.colors.white,
  },
  pillTextActive: {
    color: tacticalTokens.colors.acid,
  },
  toggleList: {
    gap: tacticalTokens.spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
    gap: tacticalTokens.spacing.md,
  },
  toggleTextWrap: {
    flex: 1,
    gap: tacticalTokens.spacing.xs,
  },
  toggleLabel: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.white,
  },
  toggleDescription: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    lineHeight: 18,
    color: tacticalTokens.colors.textDim,
  },
  toggleTrack: {
    width: 46,
    height: 24,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleTrackEnabled: {
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: '#0B1907',
  },
  toggleKnob: {
    width: 16,
    height: 16,
    backgroundColor: tacticalTokens.colors.textDim,
  },
  toggleKnobEnabled: {
    backgroundColor: tacticalTokens.colors.acid,
    alignSelf: 'flex-end',
  },
  actionPressed: {
    opacity: 0.84,
  },
});

export default TacticalSystemPreferencesPanel;
