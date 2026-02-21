/**
 * Create Session Screen — Patch In Modal
 *
 * "Initialize a new signal" — select waveform mode (room mode),
 * name the session, set frequency band (genre), toggle visibility.
 * Uses WaveformIcon SVGs instead of generic Ionicons.
 */

import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen, Text, Button, Input, WaveformIcon, ADSRTransition } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { RoomMode } from '../types';

// ─── Frequency Bands (Genre) ────────────────────────────────

const FREQ_BANDS = [
  'Mixed', 'Hip-Hop', 'R&B', 'Pop', 'Rock', 'Electronic',
  'Indie', 'Jazz', 'Lo-Fi', 'Latin', 'Country', 'Classical',
  'Metal', 'Punk', 'Soul', 'Reggae', 'House', 'Techno',
];

// ─── Signal Types (Room Modes) ──────────────────────────────

const SIGNAL_TYPES: {
  key: RoomMode;
  label: string;
  waveform: string;
  desc: string;
}[] = [
  {
    key: 'campfire',
    label: 'Sine',
    waveform: 'CAMPFIRE',
    desc: 'Equal turns. Round-robin queue. Everyone gets a voice.',
  },
  {
    key: 'spotlight',
    label: 'Square',
    waveform: 'SPOTLIGHT',
    desc: 'Host curates. You control the signal, others suggest.',
  },
  {
    key: 'openFloor',
    label: 'Sawtooth',
    waveform: 'OPEN FLOOR',
    desc: 'Democratic queue. Votes move tracks up. Free-for-all.',
  },
];

// ─── Component ──────────────────────────────────────────────

export function CreateSessionScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('Mixed');
  const [roomMode, setRoomMode] = useState<RoomMode>('campfire');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert('Name your signal', 'Give your session a name so others can find it.');
      return;
    }
    setLoading(true);
    try {
      const { session } = await sessionApi.create({
        name: name.trim(),
        genre,
        roomMode,
        isPublic,
      });
      navigation.replace('SessionRoom', { sessionId: session.id });
    } catch (err: any) {
      Alert.alert('Signal failed', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ADSRTransition preset="modalReveal" slideFrom="bottom" slideDistance={30}>
    <SafeScreen style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.text.muted} />
          </TouchableOpacity>
          <Text variant="h1" color={colors.text.primary}>
            Initialize Signal
          </Text>
          <Text variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
            Configure your session parameters.
          </Text>
        </View>

        {/* Session Name */}
        <Input
          label="Signal Name"
          placeholder="Friday Night Vibes..."
          value={name}
          onChangeText={setName}
          returnKeyType="done"
        />

        {/* Frequency Band (Genre) */}
        <Text variant="label" color={colors.text.secondary} style={styles.sectionLabel}>
          FREQUENCY BAND
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bandScroll}>
          {FREQ_BANDS.map((band) => {
            const isActive = genre === band;
            return (
              <TouchableOpacity
                key={band}
                style={[styles.bandChip, isActive && styles.bandChipActive]}
                onPress={() => setGenre(band)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${band} genre${isActive ? ', selected' : ''}`}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  variant="labelSmall"
                  color={isActive ? colors.text.primary : colors.text.muted}
                  style={styles.bandText}
                >
                  {band.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Signal Type (Room Mode) */}
        <Text variant="label" color={colors.text.secondary} style={styles.sectionLabel}>
          WAVEFORM MODE
        </Text>
        <View style={styles.modeGrid}>
          {SIGNAL_TYPES.map((mode) => {
            const isSelected = roomMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[styles.modeCard, isSelected && styles.modeCardActive]}
                onPress={() => setRoomMode(mode.key)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${mode.label} mode, ${mode.waveform}. ${mode.desc}${isSelected ? ', selected' : ''}`}
                accessibilityState={{ selected: isSelected }}
              >
                {/* Waveform header strip */}
                <View style={[styles.modeHeader, isSelected && styles.modeHeaderActive]}>
                  <WaveformIcon mode={mode.key} size={18} />
                  <Text
                    variant="labelLarge"
                    color={isSelected ? colors.action.primary : colors.text.primary}
                    style={styles.modeLabel}
                  >
                    {mode.label}
                  </Text>
                  <Text
                    variant="labelSmall"
                    color={colors.chrome.text}
                    style={styles.modeTag}
                  >
                    {mode.waveform}
                  </Text>
                </View>
                {/* Description */}
                <Text variant="bodySmall" color={colors.text.muted} style={styles.modeDesc}>
                  {mode.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Visibility — Public/Private toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text variant="labelLarge" color={colors.text.primary}>
              {isPublic ? 'Public Signal' : 'Private Signal'}
            </Text>
            <Text variant="bodySmall" color={colors.text.muted}>
              {isPublic
                ? 'Visible on the Patch Bay. Anyone can connect.'
                : 'Invite-only. Share the join code to connect.'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, isPublic && styles.toggleActive]}
            onPress={() => setIsPublic(!isPublic)}
            accessibilityRole="switch"
            accessibilityLabel={isPublic ? 'Public signal' : 'Private signal'}
            accessibilityState={{ checked: isPublic }}
          >
            <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
          </TouchableOpacity>
        </View>

        {/* Create */}
        <Button
          title="Patch In"
          onPress={handleCreate}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.createBtn}
        />
      </ScrollView>
    </SafeScreen>
    </ADSRTransition>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  header: {
    marginBottom: spacing.xl,
  },
  closeBtn: {
    marginBottom: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    letterSpacing: 1.5,
    fontSize: 10,
  },
  // ─── Frequency Band Chips ───
  bandScroll: {
    marginBottom: spacing.md,
  },
  bandChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    marginRight: 6,
  },
  bandChipActive: {
    backgroundColor: colors.highlight.iceSubtle,
    borderColor: colors.action.primary,
  },
  bandText: {
    fontSize: 9,
    letterSpacing: 1,
  },
  // ─── Mode Cards ───
  modeGrid: {
    gap: 10,
    marginBottom: spacing.xl,
  },
  modeCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    backgroundColor: colors.bg.elevated,
    overflow: 'hidden',
  },
  modeCardActive: {
    borderColor: colors.action.primary,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.chrome.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
  },
  modeHeaderActive: {
    backgroundColor: colors.highlight.iceFaint,
  },
  modeLabel: {
    fontSize: 13,
  },
  modeTag: {
    marginLeft: 'auto',
    fontSize: 8,
    letterSpacing: 1.5,
    opacity: 0.7,
  },
  modeDesc: {
    padding: 14,
    lineHeight: 18,
  },
  // ─── Toggle ───
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    marginBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.chrome.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bg.input,
    padding: 2,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
  toggleActive: {
    backgroundColor: colors.action.primary,
    borderColor: colors.action.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.text.muted,
  },
  toggleKnobActive: {
    backgroundColor: colors.text.primary,
    alignSelf: 'flex-end',
  },
  createBtn: {
    marginTop: spacing.sm,
  },
});

export default CreateSessionScreen;
