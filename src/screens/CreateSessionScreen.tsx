/**
 * Create Session Screen — "Initialize Patch" (Gemini V7)
 *
 * Visual: Signal routing diagram
 *   SIGNAL OUT ─ ─ ─ → CV IN
 *   [SOURCE]           [VIBE]
 *
 * + Room name input
 * + Mode selector (CAMPFIRE / SPOTLIGHT / OPEN FLOOR)
 * + EXECUTE PATCH big orange button
 */

import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, ADSRTransition } from '../components/ui';
import { sessionApi } from '../services/api';
import { spacing } from '../theme/spacing';
import { VoidSurface, ModuleFaceplate, ChromeButton } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, fontWeight, letterSpacing as ls } from '../design/tokens/typography';
import type { RoomMode, RoomBehaviors } from '../types';
import { DEFAULT_BEHAVIORS, BEHAVIOR_PRESETS } from '../types';

// ─── Sources & Vibes ────────────────────────────────────────

const SOURCES = ['SPOTIFY', 'SNDCLOUD', 'YOUTUBE', 'LOCAL'] as const;
const VIBES = ['CHILL', 'HYPE', 'CHAOS', 'FOCUS', 'AMBIENT'] as const;

const ROOM_PRESETS: { key: RoomMode; label: string; desc: string }[] = [
  { key: 'campfire', label: 'CAMPFIRE', desc: 'Equal turns. Round-robin queue.' },
  { key: 'spotlight', label: 'SPOTLIGHT', desc: 'Host curates. Approval required.' },
  { key: 'openFloor', label: 'OPEN FLOOR', desc: 'Votes reorder the queue.' },
];

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

// ─── Component ──────────────────────────────────────────────

export function CreateSessionScreen() {
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('Mixed');
  const [roomMode, setRoomMode] = useState<RoomMode>('campfire');
  const [behaviors, setBehaviors] = useState<RoomBehaviors>({
    ...DEFAULT_BEHAVIORS,
    ...BEHAVIOR_PRESETS.campfire,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [source, setSource] = useState<typeof SOURCES[number]>('SPOTIFY');
  const [vibe, setVibe] = useState<typeof VIBES[number]>('CHILL');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  /** Select a preset template — applies its defaults but keeps user overrides. */
  function selectPreset(preset: RoomMode) {
    setRoomMode(preset);
    setBehaviors({ ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS[preset] });
  }

  /** Toggle a single boolean behavior. */
  function toggleBehavior(key: keyof RoomBehaviors) {
    setBehaviors((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Name your patch', 'Give your session a signal name.');
      return;
    }
    setLoading(true);
    try {
      const { session } = await sessionApi.create({
        name: name.trim(),
        genre,
        roomMode,
        isPublic,
        behaviors,
        source,
        vibe,
      });
      navigation.replace('SessionRoom', { sessionId: session.id });
    } catch (err: any) {
      Alert.alert('Patch failed', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ADSRTransition preset="modalReveal" slideFrom="bottom" slideDistance={30}>
      <SafeScreen>
        <VoidSurface style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                accessibilityHint="Double tap to close this session creation dialog"
              >
                <Ionicons name="close" size={20} color={palette.silver} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Initialize Patch</Text>
                <Text style={styles.subtitle}>Build your room signal flow first, then execute.</Text>
              </View>
            </View>

            {/* Session Name */}
            <Text style={styles.inputLabel}>SIGNAL NAME</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Friday Night Vibes..."
              placeholderTextColor={palette.slate}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              autoCapitalize="words"
              accessibilityLabel="Session name input"
              accessibilityHint="Enter a name for your session"
            />

            {/* Signal Routing Diagram */}
            <View style={styles.routingDiagram}>
              {/* SIGNAL OUT */}
              <ModuleFaceplate label="SIGNAL OUT" style={styles.routingNodeCard}>
                <View style={styles.routingJack}>
                  <View style={styles.jackHole} />
                </View>
                <View style={styles.sourceRow}>
                  {SOURCES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sourceChip, source === s && styles.sourceChipActive]}
                      onPress={() => setSource(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`Source: ${s}`}
                      accessibilityState={{ selected: source === s }}
                    >
                      <Text style={[styles.sourceText, source === s && styles.sourceTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ModuleFaceplate>

              {/* Cable bridge */}
              <View style={styles.cableLine}>
                <Ionicons name="arrow-down" size={14} color={palette.orange} />
                <View style={styles.cableDashRow}>
                  <View style={styles.cableDash} />
                  <View style={styles.cableDash} />
                  <View style={styles.cableDash} />
                  <View style={styles.cableDash} />
                </View>
              </View>

              {/* CV IN */}
              <ModuleFaceplate label="CV IN" style={[styles.routingNodeCard, styles.routingNodeCardDest]}>
                <View style={styles.routingJack}>
                  <View style={[styles.jackHole, { borderColor: palette.orange }]} />
                </View>
                <View style={styles.sourceRow}>
                  {VIBES.map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.sourceChip, vibe === v && styles.vibeChipActive]}
                      onPress={() => setVibe(v)}
                      accessibilityRole="button"
                      accessibilityLabel={`Vibe: ${v}`}
                      accessibilityState={{ selected: vibe === v }}
                    >
                      <Text style={[styles.sourceText, vibe === v && styles.vibeTextActive]}>
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ModuleFaceplate>
            </View>

            {/* Preset Templates */}
            <Text style={styles.sectionLabel}>PRESET TEMPLATE</Text>
            <View style={styles.modeRow}>
              {ROOM_PRESETS.map((mode) => {
                const isActive = roomMode === mode.key;
                return (
                  <TouchableOpacity
                    key={mode.key}
                    style={[styles.modePill, isActive && styles.modePillActive]}
                    onPress={() => selectPreset(mode.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Room mode: ${mode.label}`}
                    accessibilityState={{ selected: isActive }}
                    accessibilityHint={mode.desc}
                  >
                    <Text style={[styles.modePillText, isActive && styles.modePillTextActive]}>
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.modeDesc}>
              {ROOM_PRESETS.find((m) => m.key === roomMode)?.desc}
            </Text>

            {/* Advanced Toggles (expandable) */}
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
              accessibilityRole="button"
              accessibilityLabel="Customize behaviors"
              accessibilityState={{ expanded: showAdvanced }}
              accessibilityHint="Double tap to expand advanced behavior options"
            >
              <Text style={styles.advancedToggleText}>CUSTOMIZE BEHAVIORS</Text>
              <Ionicons
                name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={palette.silver}
              />
            </TouchableOpacity>

            {showAdvanced && (
              <ModuleFaceplate label="ADVANCED" style={styles.advancedSection}>
                {/* Queue Ordering */}
                <Text style={styles.toggleSectionLabel}>QUEUE ORDERING</Text>
                <View style={styles.modeRow}>
                  {QUEUE_ORDERING_OPTIONS.map((opt) => {
                    const isActive = behaviors.queueOrdering === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.modePill, isActive && styles.modePillActive]}
                        onPress={() => setBehaviors((b) => ({ ...b, queueOrdering: opt.key }))}
                        accessibilityRole="button"
                        accessibilityLabel={`Queue ordering: ${opt.label}`}
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text style={[styles.modePillText, isActive && styles.modePillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Skip Access */}
                <Text style={styles.toggleSectionLabel}>SKIP ACCESS</Text>
                <View style={styles.modeRow}>
                  {SKIP_ACCESS_OPTIONS.map((opt) => {
                    const isActive = behaviors.skipAccess === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.modePill, isActive && styles.modePillActive]}
                        onPress={() => setBehaviors((b) => ({ ...b, skipAccess: opt.key }))}
                        accessibilityRole="button"
                        accessibilityLabel={`Skip access: ${opt.label}`}
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text style={[styles.modePillText, isActive && styles.modePillTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Boolean Toggles */}
                {([
                  { key: 'voteReordersQueue' as const, label: 'Votes Reorder Queue', desc: 'Higher-voted tracks rise to the top.' },
                  { key: 'requiresApproval' as const, label: 'Require Approval', desc: 'Non-host additions need host OK.' },
                  { key: 'allowOverdrive' as const, label: 'Allow Overdrive', desc: 'Force a track to the top (25 CV).' },
                  { key: 'allowPhaseCancel' as const, label: 'Allow Phase Cancel', desc: 'Block the next skip (15 CV).' },
                  { key: 'allowPhantomPower' as const, label: 'Allow Phantom Power', desc: 'Boost a track +48V (5 CV).' },
                  { key: 'forecastEnabled' as const, label: 'Frequency Forecast', desc: 'Predict the next track for CV.' },
                  { key: 'duelEnabled' as const, label: 'Crossfader Duel', desc: 'Head-to-head track battles.' },
                ]).map((toggle) => (
                  <View key={toggle.key} style={styles.behaviorToggleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.behaviorToggleLabel}>{toggle.label}</Text>
                      <Text style={styles.behaviorToggleDesc}>{toggle.desc}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.toggle, behaviors[toggle.key] && styles.toggleActive]}
                      onPress={() => toggleBehavior(toggle.key)}
                      accessibilityRole="switch"
                      accessibilityLabel={toggle.label}
                      accessibilityState={{ checked: behaviors[toggle.key] }}
                      accessibilityHint={toggle.desc}
                    >
                      <View style={[styles.toggleKnob, behaviors[toggle.key] && styles.toggleKnobActive]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ModuleFaceplate>
            )}

            {/* Public/Private toggle */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>
                  {isPublic ? 'Public Signal' : 'Private Signal'}
                </Text>
                <Text style={styles.toggleDesc}>
                  {isPublic
                    ? 'Visible on Live Sonar. Anyone can patch in.'
                    : 'Invite-only. Share the join code to connect.'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, isPublic && styles.toggleActive]}
                onPress={() => setIsPublic(!isPublic)}
                accessibilityRole="switch"
                accessibilityLabel="Public or private signal"
                accessibilityState={{ checked: isPublic }}
                accessibilityHint={isPublic ? "Signal is public. Double tap to make it private." : "Signal is private. Double tap to make it public."}
              >
                <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            {/* EXECUTE PATCH — big orange CTA */}
            <ChromeButton
              variant="glowing"
              size="lg"
              onPress={handleCreate}
              disabled={loading}
              style={styles.executePatch}
            >
              {loading ? 'PATCHING...' : 'EXECUTE PATCH'}
            </ChromeButton>
          </ScrollView>
        </VoidSurface>
      </SafeScreen>
    </ADSRTransition>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.xl,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 0,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['2xl'],
    color: '#39FF14',
    letterSpacing: ls.normal,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.slate,
  },

  // Name input
  inputLabel: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.slate,
    letterSpacing: ls.wide,
    marginBottom: 6,
  },
  nameInput: {
    height: 48,
    backgroundColor: '#111111',
    borderRadius: 0,
    paddingHorizontal: 14,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.lg,
    color: palette.frost,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: spacing.xl,
  },

  // Signal routing diagram
  routingDiagram: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: spacing.xl,
    paddingVertical: 12,
    gap: 10,
  },
  routingNodeCard: {
    alignItems: 'center',
  },
  routingNodeCardDest: {
    borderColor: '#00E5FF',
  },
  routingNodeLabel: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.silver,
    letterSpacing: ls.wide,
    marginBottom: 8,
  },
  routingJack: {
    width: 44,
    height: 44,
    borderRadius: 0,
    backgroundColor: '#0A0A0A',
    borderWidth: 2,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  jackHole: {
    width: 16,
    height: 16,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#39FF14',
    backgroundColor: 'transparent',
  },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    rowGap: 6,
  },
  sourceChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#111111',
  },
  sourceChipActive: {
    borderColor: '#39FF14',
    backgroundColor: 'transparent',
  },
  sourceText: {
    fontFamily: fontFamily.mono,
    fontSize: 8,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  sourceTextActive: {
    color: '#39FF14',
  },
  vibeChipActive: {
    borderColor: '#00E5FF',
    backgroundColor: 'transparent',
  },
  vibeTextActive: {
    color: '#00E5FF',
  },

  // Cable
  cableLine: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  cableDashRow: {
    flexDirection: 'row',
    gap: 4,
  },
  cableDash: {
    width: 8,
    height: 2,
    borderRadius: 0,
    backgroundColor: '#333333',
  },

  // Mode selector
  sectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.slate,
    letterSpacing: ls.wide,
    marginBottom: 10,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  modePill: {
    minWidth: 98,
    flexGrow: 1,
    paddingVertical: 10,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#111111',
    alignItems: 'center',
  },
  modePillActive: {
    borderColor: '#39FF14',
    backgroundColor: 'transparent',
  },
  modePillText: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    letterSpacing: ls.wide,
  },
  modePillTextActive: {
    color: '#39FF14',
  },
  modeDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.silver,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  // Advanced toggles section
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  advancedToggleText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.silver,
    letterSpacing: ls.wide,
  },
  advancedSection: {
    marginBottom: spacing.lg,
  },
  toggleSectionLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    color: palette.slate,
    letterSpacing: ls.wide,
    marginBottom: 8,
    marginTop: 12,
  },
  behaviorToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333333',
  },
  behaviorToggleLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.base,
    color: palette.frost,
  },
  behaviorToggleDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.slate,
    marginTop: 1,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  toggleLabel: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: palette.frost,
  },
  toggleDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: palette.slate,
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 0,
    backgroundColor: '#000000',
    padding: 2,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  toggleActive: {
    backgroundColor: '#39FF14',
    borderColor: '#39FF14',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 0,
    backgroundColor: '#333333',
  },
  toggleKnobActive: {
    backgroundColor: '#000000',
    alignSelf: 'flex-end',
  },

  // Execute button
  executePatch: {
    height: 56,
    // Orange glow
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
});

export default CreateSessionScreen;
