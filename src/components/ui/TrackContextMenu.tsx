/**
 * TrackContextMenu — Bottom sheet action menu for long-press on tracks.
 *
 * Convergence Strategy §5.1:
 * Long press track → Open context menu sheet (Source: Spotify, SoundCloud)
 *
 * §7 Animation:
 * Bottom sheet: 350ms Spring (damping 0.75) appear / 250ms Ease-in dismiss
 *
 * Actions vary by context (queue vs. search vs. library).
 */

import React, { useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Modal, Animated,
  Dimensions, Image, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Track, QueueTrack } from '../../types';

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Action definitions ────────────────────────────────────

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Destructive actions render in Hot Pink */
  destructive?: boolean;
}

/** Pre-built action sets for common contexts */
export const QUEUE_ACTIONS: ContextMenuAction[] = [
  { id: 'addToLibrary', label: 'Add to Library', icon: 'add-circle-outline' },
  { id: 'viewArtist', label: 'View Artist', icon: 'person-outline' },
  { id: 'viewAlbum', label: 'View Album', icon: 'disc-outline' },
  { id: 'share', label: 'Share Track', icon: 'share-outline' },
  { id: 'removeFromQueue', label: 'Remove from Queue', icon: 'trash-outline', destructive: true },
];

export const SEARCH_ACTIONS: ContextMenuAction[] = [
  { id: 'addToQueue', label: 'Add to Queue', icon: 'add-circle-outline' },
  { id: 'addToLibrary', label: 'Add to Library', icon: 'heart-outline' },
  { id: 'viewArtist', label: 'View Artist', icon: 'person-outline' },
  { id: 'viewAlbum', label: 'View Album', icon: 'disc-outline' },
  { id: 'share', label: 'Share Track', icon: 'share-outline' },
];

export const LIBRARY_ACTIONS: ContextMenuAction[] = [
  { id: 'addToQueue', label: 'Add to Queue', icon: 'add-circle-outline' },
  { id: 'viewArtist', label: 'View Artist', icon: 'person-outline' },
  { id: 'viewAlbum', label: 'View Album', icon: 'disc-outline' },
  { id: 'share', label: 'Share Track', icon: 'share-outline' },
  { id: 'removeFromLibrary', label: 'Remove from Library', icon: 'heart-dislike-outline', destructive: true },
];

// ─── Component ─────────────────────────────────────────────

interface TrackContextMenuProps {
  visible: boolean;
  track: Track | QueueTrack | null;
  actions: ContextMenuAction[];
  onAction: (actionId: string, track: Track) => void;
  onClose: () => void;
}

export function TrackContextMenu({
  visible, track, actions, onAction, onClose,
}: TrackContextMenuProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      // §7: 350ms Spring (damping 0.75) appear
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,  // ~0.75 damping ratio
      }).start();
    } else {
      // §7: 250ms Ease-in dismiss
      Animated.timing(slideAnim, {
        toValue: SCREEN_H,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!track) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Scrim */}
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View
          style={[
            styles.sheet,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Prevent scrim press from closing when tapping inside sheet */}
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Handle */}
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            {/* Track Preview */}
            <View style={styles.trackPreview}>
              {track.albumArt ? (
                <Image source={{ uri: track.albumArt }} style={styles.artThumb} />
              ) : (
                <View style={[styles.artThumb, styles.artPlaceholder]}>
                  <Ionicons name="musical-notes" size={20} color={colors.text.muted} />
                </View>
              )}
              <View style={styles.trackMeta}>
                <Text variant="body" color={colors.text.primary} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text variant="labelSmall" color={colors.text.secondary} numberOfLines={1}>
                  {track.artist}{track.album ? ` · ${track.album}` : ''}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Actions */}
            {actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionRow}
                onPress={() => {
                  onAction(action.id, track);
                  onClose();
                }}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Ionicons
                  name={action.icon}
                  size={22}
                  color={action.destructive ? colors.action.destructive : colors.text.secondary}
                />
                <Text
                  variant="body"
                  color={action.destructive ? colors.action.destructive : colors.text.primary}
                  style={styles.actionLabel}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Cancel */}
            <TouchableOpacity style={styles.cancelRow} onPress={onClose} activeOpacity={0.6} accessibilityRole="button" accessibilityLabel="Cancel">
              <Text variant="body" color={colors.text.muted} align="center">
                Cancel
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.elevated,
    borderTopLeftRadius: spacing.radius.lg,
    borderTopRightRadius: spacing.radius.lg,
    paddingBottom: 34, // safe area
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.muted,
    opacity: 0.5,
  },

  // Track preview
  trackPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  artThumb: {
    width: 48,
    height: 48,
    borderRadius: spacing.radius.sm,
  },
  artPlaceholder: {
    backgroundColor: colors.bg.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  trackMeta: {
    flex: 1,
    marginLeft: spacing.sm,
    gap: 2,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginHorizontal: spacing.screenPadding,
  },

  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.md,
  },
  actionLabel: {
    flex: 1,
  },

  cancelRow: {
    paddingVertical: 16,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
});

export default TrackContextMenu;
