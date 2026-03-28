import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ADSRTransition, SafeScreen, showToast } from '../components/ui';
import { ManualPanel } from '../components/manual/ManualPanel';
import { sessionApi } from '../services/api';
import { VoidSurface } from '../design/components';
import { useManualMode } from '../hooks/useManualMode';
import type { RoomBehaviors, RoomMode } from '../types';
import { BEHAVIOR_PRESETS, DEFAULT_BEHAVIORS } from '../types';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { formatModeLabel, getModeBlockColors, tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { notifyError, notifyWarning, tapLight, tapMedium } from '../utils/haptics';

const SOURCES = ['SPOTIFY', 'SNDCLOUD', 'YOUTUBE', 'LOCAL'] as const;
const VIBES = ['CHILL', 'HYPE', 'CHAOS', 'FOCUS', 'AMBIENT'] as const;

const ROOM_PRESETS: { key: RoomMode; label: string; desc: string }[] = [
  { key: 'campfire', label: 'CAMPFIRE', desc: 'Equal turns. Round-robin queue.' },
  { key: 'spotlight', label: 'SPOTLIGHT', desc: 'Host curates. Approval required.' },
  { key: 'openFloor', label: 'OPEN FLR', desc: 'Votes reorder the queue.' },
];

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

const ADVANCED_TOGGLES: Array<{
  key: keyof Pick<
    RoomBehaviors,
    'voteReordersQueue' | 'requiresApproval' | 'allowOverdrive' |
    'allowPhaseCancel' | 'allowPhantomPower' | 'forecastEnabled' | 'duelEnabled'
  >;
  label: string;
  description: string;
}> = [
  { key: 'voteReordersQueue', label: 'Votes Reorder Queue', description: 'Higher-voted tracks rise to the top.' },
  { key: 'requiresApproval', label: 'Require Approval', description: 'Non-host additions need approval.' },
  { key: 'allowOverdrive', label: 'Allow Overdrive', description: 'Force a track to the top for CV.' },
  { key: 'allowPhaseCancel', label: 'Allow Phase Cancel', description: 'Block the next skip for CV.' },
  { key: 'allowPhantomPower', label: 'Allow Phantom Power', description: 'Boost the active track with +48V.' },
  { key: 'forecastEnabled', label: 'Frequency Forecast', description: 'Enable prediction rounds for CV.' },
  { key: 'duelEnabled', label: 'Crossfader Duel', description: 'Enable head-to-head battles.' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

type ManualHotspotKey = 'mode' | 'routing' | 'visibility';

function ManualHotspot({
  active,
  onPress,
  accent,
  accessibilityLabel,
}: {
  active: boolean;
  onPress: () => void;
  accent: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.manualHotspot,
        { borderColor: accent },
        active && styles.manualHotspotActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.manualHotspotDot, { backgroundColor: accent }]} />
    </Pressable>
  );
}

export function CreateSessionScreen() {
  const navigation = useNavigation<any>();
  const { readManual } = useManualMode();
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('MIXED');
  const [roomMode, setRoomMode] = useState<RoomMode>('campfire');
  const [behaviors, setBehaviors] = useState<RoomBehaviors>({
    ...DEFAULT_BEHAVIORS,
    ...BEHAVIOR_PRESETS.campfire,
  });
  const [source, setSource] = useState<typeof SOURCES[number]>('SPOTIFY');
  const [vibe, setVibe] = useState<typeof VIBES[number]>('CHILL');
  const [isPublic, setIsPublic] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [activeManualHotspot, setActiveManualHotspot] = useState<ManualHotspotKey | null>(null);

  const activeModeColors = useMemo(() => getModeBlockColors(roomMode), [roomMode]);

  useEffect(() => {
    if (!readManual) {
      setActiveManualHotspot(null);
    }
  }, [readManual]);

  function toggleManualHotspot(key: ManualHotspotKey) {
    tapLight();
    setActiveManualHotspot((prev) => (prev === key ? null : key));
  }

  function selectPreset(preset: RoomMode) {
    tapLight();
    setRoomMode(preset);
    setBehaviors({ ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS[preset] });
  }

  function toggleBehavior(key: keyof typeof behaviors) {
    setBehaviors((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleCreate() {
    const finalName = name.trim();
    if (!finalName) {
      notifyWarning();
      setInlineError('NAME YOUR PATCH BEFORE EXECUTION.');
      showToast('Give the room a signal name first.', 'warning', '!');
      return;
    }

    tapMedium();
    setLoading(true);
    setInlineError(null);
    try {
      const { session } = await sessionApi.create({
        name: finalName,
        genre,
        roomMode,
        isPublic,
        behaviors,
        source,
        vibe,
      });
      navigation.replace('SessionRoom', { sessionId: session.id });
    } catch (err: any) {
      notifyError();
      setInlineError((err?.message || 'PATCH EXECUTION FAILED.').toUpperCase());
      showToast('Patch execution failed.', 'error', '!');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ADSRTransition preset="modalReveal" slideFrom="bottom" slideDistance={30}>
      <SafeScreen>
        <VoidSurface style={{ flex: 1 }}>
          <View style={styles.screen}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <TacticalGridBackground opacity={0.58} />
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.eyebrow}>SYS.FREQ // INIT BUS</Text>
                  <Text style={styles.title}>INITIALIZE PATCH</Text>
                  <Text style={styles.subtitle}>
                    Build the room route, choose the mode, then execute the patch.
                  </Text>
                </View>
                <Pressable
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="Close create room screen"
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={20} color={tacticalTokens.colors.white} />
                </Pressable>
              </View>

              {readManual ? (
                <ManualPanel
                  contextLabel="INIT BUS"
                  variant="compact"
                  style={styles.manualRailInline}
                  title="ROOM BUILD ORDER"
                  subtitle="Build the room in order, then execute the patch once the labels and mode feel right."
                  steps={[
                    { tag: 'NAME', text: 'Start with a room name people can recognize quickly.' },
                    { tag: 'MODE', text: 'Choose how control should feel: shared turns, host-led, or vote-driven.' },
                    { tag: 'EXEC', text: 'EXECUTE PATCH creates the room and moves you directly into the session.' },
                  ]}
                  callouts={[
                    { label: 'SAFE DEFAULT', value: 'Campfire is still the easiest first room for demos.' },
                    { label: 'ADVANCED', value: 'You can ignore advanced behaviors on a first pass.' },
                    { label: 'PRIVATE ROOM', value: 'Turn off visibility if you want host-invite only access.' },
                  ]}
                  footer="Create is the host path. If you only need to enter an existing room, use Join instead."
                />
              ) : null}

              <View style={styles.panel}>
                <SectionLabel>SIGNAL NAME</SectionLabel>
                <View style={styles.inputFrame}>
                  <View style={styles.inputPrefix} />
                  <TextInput
                    style={styles.nameInput}
                    placeholder="FRIDAY NIGHT PATCH"
                    placeholderTextColor={tacticalTokens.colors.textMuted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="done"
                    selectionColor={tacticalTokens.colors.ice}
                  />
                </View>

                <SectionLabel>GENRE / TAG</SectionLabel>
                <View style={[styles.inputFrame, styles.compactInputFrame]}>
                  <TextInput
                    style={styles.metaInput}
                    placeholder="MIXED"
                    placeholderTextColor={tacticalTokens.colors.textMuted}
                    value={genre}
                    onChangeText={(text) => setGenre(text.toUpperCase())}
                    autoCapitalize="characters"
                    selectionColor={tacticalTokens.colors.ice}
                  />
                </View>

                {inlineError ? (
                  <View style={styles.errorRail}>
                    <Ionicons name="alert-circle-outline" size={16} color={tacticalTokens.colors.orange} />
                    <Text style={styles.errorText}>{inlineError}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.panel}>
                <View style={styles.sectionHeaderRow}>
                  <SectionLabel>ROOM MODE</SectionLabel>
                  {readManual ? (
                    <ManualHotspot
                      active={activeManualHotspot === 'mode'}
                      onPress={() => toggleManualHotspot('mode')}
                      accent={tacticalTokens.colors.guide}
                      accessibilityLabel="Toggle room mode guide"
                    />
                  ) : null}
                </View>
                {readManual && activeManualHotspot === 'mode' ? (
                  <View style={styles.manualHintRail}>
                    <Text style={styles.manualHintTitle}>
                      {roomMode === 'campfire'
                        ? 'CAMPFIRE = SHARED TURNS'
                        : roomMode === 'spotlight'
                          ? 'SPOTLIGHT = HOST CURATION'
                          : 'OPEN FLR = VOTE ENERGY'}
                    </Text>
                    <Text style={styles.manualHintText}>
                      {roomMode === 'campfire'
                        ? 'Best default for demos. Everyone adds normally and the room rotates fairly.'
                        : roomMode === 'spotlight'
                          ? 'Best when one person leads. Non-host additions can wait for approval.'
                          : 'Best when you want visible competition. Votes move tracks up and down the queue.'}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.modeStack}>
                  {ROOM_PRESETS.map((preset) => {
                    const isActive = roomMode === preset.key;
                    const colors = getModeBlockColors(preset.key);
                    return (
                      <Pressable
                        key={preset.key}
                        onPress={() => selectPreset(preset.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`Room mode ${preset.label}`}
                        accessibilityHint={preset.desc}
                        style={({ pressed }) => [
                          styles.modeCard,
                          isActive && [styles.modeCardActive, { borderColor: colors.borderColor }],
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.modeCardHeader}>
                          <Text style={styles.modeCardTitle}>{preset.label}</Text>
                          <View style={[styles.modeCardBadge, { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }]}>
                            <Text style={[styles.modeCardBadgeText, { color: colors.color }]}>
                              {formatModeLabel(preset.key)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.modeCardDescription}>{preset.desc}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.panel}>
                <View style={styles.sectionHeaderRow}>
                  <SectionLabel>SOURCE / VIBE ROUTING</SectionLabel>
                  {readManual ? (
                    <ManualHotspot
                      active={activeManualHotspot === 'routing'}
                      onPress={() => toggleManualHotspot('routing')}
                      accent={tacticalTokens.colors.guide}
                      accessibilityLabel="Toggle source and vibe guide"
                    />
                  ) : null}
                </View>
                {readManual && activeManualHotspot === 'routing' ? (
                  <View style={styles.manualHintRail}>
                    <Text style={styles.manualHintTitle}>ROUTING LABELS</Text>
                    <Text style={styles.manualHintText}>
                      Source and vibe work like labels for the room. They tell people what kind of session they are stepping into before they join.
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.helperText}>INPUT SOURCE</Text>
                <View style={styles.chipWrap}>
                  {SOURCES.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setSource(item)}
                      style={({ pressed }) => [
                        styles.routeChip,
                        source === item && styles.routeChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.routeChipText, source === item && styles.routeChipTextActive]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.helperText, { marginTop: tacticalTokens.spacing.md }]}>ROOM VIBE</Text>
                <View style={styles.chipWrap}>
                  {VIBES.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => setVibe(item)}
                      style={({ pressed }) => [
                        styles.routeChip,
                        vibe === item && styles.vibeChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.routeChipText, vibe === item && styles.vibeChipTextActive]}>{item}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.panel}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextWrap}>
                    <View style={styles.sectionHeaderRow}>
                      <SectionLabel>ROOM VISIBILITY</SectionLabel>
                      {readManual ? (
                        <ManualHotspot
                          active={activeManualHotspot === 'visibility'}
                          onPress={() => toggleManualHotspot('visibility')}
                          accent={tacticalTokens.colors.guide}
                          accessibilityLabel="Toggle room visibility guide"
                        />
                      ) : null}
                    </View>
                    {readManual && activeManualHotspot === 'visibility' ? (
                      <View style={styles.manualHintRail}>
                        <Text style={styles.manualHintTitle}>
                          VISIBILITY ROUTE
                        </Text>
                        <Text style={styles.manualHintText}>
                          Public rooms surface on Live Sonar and room discovery. Private rooms stay off the radar and rely on direct handoff through code or QR.
                        </Text>
                      </View>
                    ) : null}
                    <Text style={styles.toggleDescription}>
                      {isPublic ? 'VISIBLE ON LIVE RADAR. ANYONE CAN PATCH IN.' : 'PRIVATE SIGNAL. SHARE THE ROOM CODE TO CONNECT.'}
                    </Text>
                  </View>
                  <Switch
                    value={isPublic}
                    onValueChange={(value) => {
                      tapLight();
                      setIsPublic(value);
                    }}
                    trackColor={{ false: tacticalTokens.colors.border, true: tacticalTokens.colors.orange }}
                    thumbColor={tacticalTokens.colors.white}
                  />
                </View>
              </View>

              <Pressable
                onPress={() => {
                  tapLight();
                  setShowAdvanced((prev) => !prev);
                }}
                style={({ pressed }) => [styles.advancedToggle, pressed && styles.pressed]}
              >
                <Text style={styles.advancedToggleText}>ADVANCED BEHAVIORS</Text>
                <Ionicons
                  name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={tacticalTokens.colors.textSoft}
                />
              </Pressable>

              {showAdvanced ? (
                <View style={styles.panel}>
                  <SectionLabel>QUEUE ORDERING</SectionLabel>
                  <View style={styles.chipWrap}>
                    {QUEUE_ORDERING_OPTIONS.map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => setBehaviors((prev) => ({ ...prev, queueOrdering: option.key }))}
                        style={({ pressed }) => [
                          styles.routeChip,
                          behaviors.queueOrdering === option.key && styles.routeChipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.routeChipText, behaviors.queueOrdering === option.key && styles.routeChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <SectionLabel>SKIP ACCESS</SectionLabel>
                  <View style={styles.chipWrap}>
                    {SKIP_ACCESS_OPTIONS.map((option) => (
                      <Pressable
                        key={option.key}
                        onPress={() => setBehaviors((prev) => ({ ...prev, skipAccess: option.key }))}
                        style={({ pressed }) => [
                          styles.routeChip,
                          behaviors.skipAccess === option.key && styles.routeChipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.routeChipText, behaviors.skipAccess === option.key && styles.routeChipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <SectionLabel>FEATURE FLAGS</SectionLabel>
                  {ADVANCED_TOGGLES.map((toggle) => (
                    <View key={toggle.key} style={styles.behaviorRow}>
                      <View style={styles.behaviorCopy}>
                        <Text style={styles.behaviorLabel}>{toggle.label.toUpperCase()}</Text>
                        <Text style={styles.behaviorDescription}>{toggle.description.toUpperCase()}</Text>
                      </View>
                      <Switch
                        value={!!behaviors[toggle.key]}
                        onValueChange={() => toggleBehavior(toggle.key)}
                        trackColor={{ false: tacticalTokens.colors.border, true: activeModeColors.borderColor }}
                        thumbColor={tacticalTokens.colors.white}
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable
                onPress={() => void handleCreate()}
                accessibilityRole="button"
                accessibilityLabel="Execute patch and create room"
                disabled={loading}
                style={({ pressed }) => [
                  styles.executeButton,
                  loading && styles.disabledAction,
                  pressed && !loading && styles.pressed,
                ]}
              >
                <Text style={styles.executeButtonText}>{loading ? 'PATCHING...' : 'EXECUTE PATCH'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </VoidSurface>
      </SafeScreen>
    </ADSRTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.lg,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
  },
  subtitle: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 18,
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
  manualRailInline: {
    marginTop: -tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.sm,
  },
  panel: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(6, 6, 6, 0.92)',
    padding: tacticalTokens.spacing.lg,
    marginBottom: tacticalTokens.spacing.lg,
  },
  sectionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.8,
    marginBottom: tacticalTokens.spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    paddingRight: tacticalTokens.spacing.xs,
  },
  manualHotspot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.matte,
    marginTop: 2,
    marginRight: 2,
    marginBottom: tacticalTokens.spacing.sm,
  },
  manualHotspotActive: {
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  manualHotspotDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inputFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.md,
    marginBottom: tacticalTokens.spacing.sm,
  },
  compactInputFrame: {
    minHeight: 48,
  },
  inputPrefix: {
    width: 14,
    height: 30,
    backgroundColor: tacticalTokens.colors.white,
    marginRight: tacticalTokens.spacing.md,
  },
  nameInput: {
    flex: 1,
    color: tacticalTokens.colors.white,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label + 4,
    letterSpacing: 1.4,
    paddingVertical: 0,
  },
  metaInput: {
    flex: 1,
    color: tacticalTokens.colors.white,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.body,
    letterSpacing: 1.1,
    paddingVertical: 0,
  },
  errorRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1,
  },
  modeStack: {
    gap: tacticalTokens.spacing.sm,
  },
  modeCard: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    padding: tacticalTokens.spacing.md,
  },
  modeCardActive: {
    backgroundColor: 'rgba(12, 12, 12, 0.96)',
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
  },
  modeCardTitle: {
    flex: 1,
    minWidth: 0,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.body + 1,
    color: tacticalTokens.colors.white,
  },
  modeCardBadge: {
    minWidth: 92,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: tacticalTokens.spacing.sm,
  },
  modeCardBadgeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.4,
  },
  modeCardDescription: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  helperText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1.1,
    marginBottom: tacticalTokens.spacing.sm,
    lineHeight: 16,
  },
  manualHintRail: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.guideSoft,
    backgroundColor: 'rgba(10, 10, 10, 0.88)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.md,
  },
  manualHintTitle: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guide,
    letterSpacing: 1.5,
    marginBottom: tacticalTokens.spacing.xs,
  },
  manualHintText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tacticalTokens.spacing.sm,
  },
  routeChip: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  routeChipActive: {
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: '#0D1409',
  },
  routeChipText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
  },
  routeChipTextActive: {
    color: tacticalTokens.colors.acid,
  },
  vibeChipActive: {
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#081218',
  },
  vibeChipTextActive: {
    color: tacticalTokens.colors.ice,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.md,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleDescription: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
    marginBottom: tacticalTokens.spacing.lg,
  },
  advancedToggleText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.3,
  },
  behaviorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderGhost,
  },
  behaviorCopy: {
    flex: 1,
    minWidth: 0,
  },
  behaviorLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.white,
    letterSpacing: 1,
  },
  behaviorDescription: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 0.9,
    lineHeight: 18,
  },
  executeButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: tacticalTokens.colors.orange,
    marginTop: tacticalTokens.spacing.sm,
  },
  executeButtonText: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label + 2,
    color: tacticalTokens.colors.void,
    letterSpacing: 1.2,
  },
  disabledAction: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
});

export default CreateSessionScreen;
