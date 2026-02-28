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
import { VoidSurface } from '../design/components';
import { palette } from '../design/tokens/materials';
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
            />

            {/* Signal Routing Diagram */}
            <View style={styles.routingDiagram}>
              {/* SIGNAL OUT */}
              <View style={styles.routingNodeCard}>
                <Text style={styles.routingNodeLabel}>SIGNAL OUT</Text>
                <View style={styles.routingJack}>
                  <View style={styles.jackHole} />
                </View>
                <View style={styles.sourceRow}>
                  {SOURCES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.sourceChip, source === s && styles.sourceChipActive]}
                      onPress={() => setSource(s)}
                    >
                      <Text style={[styles.sourceText, source === s && styles.sourceTextActive]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

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
              <View style={[styles.routingNodeCard, styles.routingNodeCardDest]}>
                <Text style={styles.routingNodeLabel}>CV IN</Text>
                <View style={styles.routingJack}>
                  <View style={[styles.jackHole, { borderColor: palette.orange }]} />
                </View>
                <View style={styles.sourceRow}>
                  {VIBES.map((v) => (
                    <TouchableOpacity
                      key={v}
                      style={[styles.sourceChip, vibe === v && styles.vibeChipActive]}
                      onPress={() => setVibe(v)}
                    >
                      <Text style={[styles.sourceText, vibe === v && styles.vibeTextActive]}>
                        {v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
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
            >
              <Text style={styles.advancedToggleText}>CUSTOMIZE BEHAVIORS</Text>
              <Ionicons
                name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={palette.silver}
              />
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedSection}>
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
                    >
                      <View style={[styles.toggleKnob, behaviors[toggle.key] && styles.toggleKnobActive]} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
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
              >
                <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
              </TouchableOpacity>
            </View>

            {/* EXECUTE PATCH — big orange CTA */}
            <TouchableOpacity
              style={[styles.executePatch, loading && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.executePatchText}>
                {loading ? 'PATCHING...' : 'EXECUTE PATCH'}
              </Text>
            </TouchableOpacity>
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
    borderRadius: 18,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'ChakraPetch-Bold',
    fontSize: 22,
    color: palette.frost,
    letterSpacing: 0.5,
  },
  subtitle: {
    marginTop: 3,
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 12,
    color: palette.slate,
  },

  // Name input
  inputLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  nameInput: {
    height: 48,
    backgroundColor: palette.steel,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 16,
    color: palette.frost,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
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
    backgroundColor: palette.midnight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  routingNodeCardDest: {
    borderColor: 'rgba(255, 107, 53, 0.26)',
  },
  routingNodeLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.silver,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  routingJack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.midnight,
    borderWidth: 2,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  jackHole: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: palette.ice,
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
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  sourceChipActive: {
    borderColor: palette.ice,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  sourceText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 8,
    color: palette.slate,
    letterSpacing: 1,
  },
  sourceTextActive: {
    color: palette.ice,
  },
  vibeChipActive: {
    borderColor: palette.orange,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  vibeTextActive: {
    color: palette.orange,
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
    borderRadius: 1,
    backgroundColor: 'rgba(255, 107, 53, 0.30)',
  },

  // Mode selector
  sectionLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
    letterSpacing: 1.5,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
    alignItems: 'center',
  },
  modePillActive: {
    borderColor: palette.orange,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
  },
  modePillText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.slate,
    letterSpacing: 1,
  },
  modePillTextActive: {
    color: palette.orange,
  },
  modeDesc: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 13,
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
    borderTopColor: palette.chromeBorder,
  },
  advancedToggleText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.silver,
    letterSpacing: 1.5,
  },
  advancedSection: {
    marginBottom: spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  toggleSectionLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.slate,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 12,
  },
  behaviorToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148, 163, 184, 0.08)',
  },
  behaviorToggleLabel: {
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 13,
    color: palette.frost,
  },
  behaviorToggleDesc: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 11,
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
    borderTopColor: palette.chromeBorder,
    borderBottomWidth: 1,
    borderBottomColor: palette.chromeBorder,
  },
  toggleLabel: {
    fontFamily: 'ChakraPetch-SemiBold',
    fontSize: 14,
    color: palette.frost,
  },
  toggleDesc: {
    fontFamily: 'ChakraPetch-Regular',
    fontSize: 12,
    color: palette.slate,
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.steel,
    padding: 2,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.chromeBorder,
  },
  toggleActive: {
    backgroundColor: palette.orange,
    borderColor: palette.orange,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.slate,
  },
  toggleKnobActive: {
    backgroundColor: palette.frost,
    alignSelf: 'flex-end',
  },

  // Execute button
  executePatch: {
    height: 56,
    borderRadius: 8,
    backgroundColor: palette.orange,
    alignItems: 'center',
    justifyContent: 'center',
    // Orange glow
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  executePatchText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 14,
    color: palette.void,
    letterSpacing: 2,
    fontWeight: '700',
  },
});

export default CreateSessionScreen;
