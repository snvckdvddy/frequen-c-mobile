/**
 * AddToRoomSheet — Bottom sheet for adding a track to a live session queue.
 *
 * If user is in a live session → "Add to [Room Name]?" + Confirm → addToQueue()
 * If not in a session → "You're not in a room" + "Browse Rooms"
 */

import React from 'react';
import {
  View, Modal, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Pressable, Image,
} from 'react-native';
import { Text, Button, showToast } from '../ui';
import { useActiveSession } from '../../contexts/ActiveSessionContext';
import { addToQueue } from '../../services/socket';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { notifySuccess } from '../../utils/haptics';
import type { Track, QueueTrack } from '../../types';

interface AddToRoomSheetProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onBrowseRooms: () => void;
  onCreateRoom?: () => void;
}

export function AddToRoomSheet({
  visible,
  track,
  onClose,
  onBrowseRooms,
  onCreateRoom,
}: AddToRoomSheetProps) {
  const { activeSession } = useActiveSession();
  const { user } = useAuth();

  const handleConfirm = () => {
    if (!track || !user || !activeSession) return;

    const queueTrack: QueueTrack = {
      ...track,
      addedBy: { userId: user.id, username: user.username },
      addedById: user.id,
      addedAt: new Date().toISOString(),
      votes: 0,
      voltageBoost: 0,
      reactions: [],
    };

    addToQueue(activeSession.sessionId, queueTrack);
    notifySuccess();
    showToast('Added to queue');
    onClose();
  };

  const handleBrowse = () => {
    onClose();
    onBrowseRooms();
  };

  const handleCreate = () => {
    onClose();
    onCreateRoom?.();
  };

  if (!track) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Track preview */}
              <View style={styles.trackPreview}>
                {track.albumArt ? (
                  <Image source={{ uri: track.albumArt }} style={styles.art} />
                ) : (
                  <View style={[styles.art, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text variant="labelSmall" color={colors.text.muted}>
                      {track.artist.charAt(0)}
                    </Text>
                  </View>
                )}
                <View style={styles.trackInfo}>
                  <Text variant="label" color={colors.text.primary} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {activeSession ? (
                <>
                  <Text variant="body" color={colors.text.primary} align="center" style={styles.prompt}>
                    Add to {activeSession.sessionName}?
                  </Text>
                  <Button
                    title="Add to Queue"
                    onPress={handleConfirm}
                    style={styles.confirmBtn}
                  />
                </>
              ) : (
                <>
                  <Text variant="body" color={colors.text.muted} align="center" style={styles.prompt}>
                    You're not in a room
                  </Text>
                  <Button
                    title="Create a Room"
                    onPress={handleCreate}
                    style={styles.confirmBtn}
                  />
                  <Button
                    title="Join a Room"
                    onPress={handleBrowse}
                    variant="secondary"
                    style={styles.confirmBtn}
                  />
                </>
              )}

              <Pressable onPress={onClose} style={styles.cancelRow}>
                <Text variant="label" color={colors.text.muted}>Cancel</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: spacing.radius.lg,
    borderTopRightRadius: spacing.radius.lg,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  trackPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  prompt: {
    marginBottom: spacing.md,
  },
  confirmBtn: {
    marginBottom: spacing.sm,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});

export default AddToRoomSheet;
