/**
 * Create Session Screen
 *
 * "Open a room" — select room mode, name it, set visibility.
 * Room modes map directly to the research: authority distribution models.
 */

import React, { useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Alert, Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Input } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { RoomMode } from '../types';

const GENRES = [
  'Mixed', 'Hip-Hop', 'R&B', 'Pop', 'Rock', 'Electronic',
  'Indie', 'Jazz', 'Lo-Fi', 'Latin', 'Country', 'Classical',
  'Metal', 'Punk', 'Soul', 'Reggae', 'House', 'Techno',
];

const ROOM_MODES: { key: RoomMode; label: string; iconName: string; desc: string }[] = [
  {
    key: 'campfire',
    label: 'Campfire',
    iconName: 'people-outline',
    desc: 'Equal turns. Everyone gets a voice. Round-robin queue.',
  },
  {
    key: 'spotlight',
    label: 'Spotlight',
    iconName: 'mic-outline',
    desc: 'Host curates. You control the vibe, others suggest.',
  },
  {
    key: 'openFloor',
    label: 'Open Floor',
    iconName: 'flash-outline',
    desc: 'First come, first served. Queue is a free-for-all.',
  },
];

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
      Alert.alert('Name your room', 'Give your session a name so people can find it.');
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
      Alert.alert('Failed to create', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text.muted} />
          </TouchableOpacity>
          <Text variant="h1" color={colors.text.primary}>Open a Room</Text>
          <Text variant="body" color={colors.text.secondary} style={styles.subtitle}>
            Choose how the room runs. You can change this later.
          </Text>
        </View>

        {/* Room Name */}
        <Input
          label="Room Name"
          placeholder="Friday Night Vibes..."
          value={name}
          onChangeText={setName}
          returnKeyType="done"
        />

        {/* Genre / Vibe */}
        <Text variant="label" color={colors.text.secondary} style={styles.sectionLabel}>
          Genre / Vibe
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.genreScroll}>
          {GENRES.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genreChip, genre === g && styles.genreChipActive]}
              onPress={() => setGenre(g)}
              activeOpacity={0.7}
            >
              <Text
                variant="labelSmall"
                color={genre === g ? colors.text.primary : colors.text.muted}
              >
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Room Mode Selection */}
        <Text variant="label" color={colors.text.secondary} style={styles.sectionLabel}>
          Room Mode
        </Text>
        <View style={styles.modeGrid}>
          {ROOM_MODES.map((mode) => {
            const isSelected = roomMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={[
                  styles.modeCard,
                  isSelected && { borderColor: colors.action.primary, backgroundColor: colors.action.primary + '10' },
                ]}
                onPress={() => setRoomMode(mode.key)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={mode.iconName as any}
                  size={24}
                  color={isSelected ? colors.action.primary : colors.text.muted}
                  style={styles.modeIcon}
                />
                <Text variant="labelLarge" color={isSelected ? colors.action.primary : colors.text.primary}>
                  {mode.label}
                </Text>
                <Text variant="bodySmall" color={colors.text.muted} style={styles.modeDesc}>
                  {mode.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Visibility Toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text variant="labelLarge" color={colors.text.primary}>Public Room</Text>
            <Text variant="bodySmall" color={colors.text.muted}>
              {isPublic ? 'Anyone can discover and join' : 'Invite-only via code or link'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, isPublic && styles.toggleActive]}
            onPress={() => setIsPublic(!isPublic)}
          >
            <View style={[styles.toggleKnob, isPublic && styles.toggleKnobActive]} />
          </TouchableOpacity>
        </View>

        {/* Create Button */}
        <Button
          title="Create Room"
          onPress={handleCreate}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.createBtn}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },
  header: { marginBottom: spacing.xl },
  closeBtn: { marginBottom: spacing.md },
  subtitle: { marginTop: spacing.xs },
  sectionLabel: { marginBottom: spacing.sm, marginTop: spacing.sm },
  modeGrid: { gap: spacing.sm, marginBottom: spacing.xl },
  modeCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: spacing.radius.lg,
    padding: spacing.cardPadding,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
  },
  modeIcon: { marginBottom: spacing.xs },
  modeDesc: { marginTop: spacing.xs },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.xl,
  },
  toggle: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg.input,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: { backgroundColor: colors.action.primary },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text.muted,
  },
  toggleKnobActive: {
    backgroundColor: colors.text.primary,
    alignSelf: 'flex-end',
  },
  genreScroll: {
    marginBottom: spacing.lg,
  },
  genreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginRight: spacing.xs,
  },
  genreChipActive: {
    backgroundColor: colors.action.primary + '20',
    borderColor: colors.action.primary,
  },
  createBtn: { marginTop: spacing.sm },
});

export default CreateSessionScreen;
