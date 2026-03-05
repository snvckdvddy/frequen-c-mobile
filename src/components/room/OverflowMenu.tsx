/**
 * OverflowMenu — Room settings bottom sheet.
 *
 * Actions: Share, Copy Code, Chat, Lyrics, QR Code, Leave/End.
 * Extracted from SessionRoomScreen for modularity.
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { LEDReadout } from '../../design/components';
import { VoidSurface } from '../../design/components';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';

interface OverflowMenuProps {
  visible: boolean;
  joinCode?: string;
  isHost: boolean;
  hasCurrentTrack: boolean;
  onClose: () => void;
  onShare: () => void;
  onCopyCode: () => void;
  onChatOpen: () => void;
  onLyricsOpen: () => void;
  onQRShow: () => void;
  onLeaveRoom: () => void;
  /** Host-only: open room settings panel */
  onRoomSettings?: () => void;
}

export function OverflowMenu({
  visible,
  joinCode,
  isHost,
  hasCurrentTrack,
  onClose,
  onShare,
  onCopyCode,
  onChatOpen,
  onLyricsOpen,
  onQRShow,
  onLeaveRoom,
  onRoomSettings,
}: OverflowMenuProps) {
  const handleAction = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop} accessibilityViewIsModal>
        <TouchableOpacity style={styles.sheetBackdropTouch} onPress={onClose} activeOpacity={1} accessible={false} />
        <VoidSurface style={[styles.sheetContainer, { maxHeight: '50%' }]} grain={false}>
          <View style={styles.sheetHandle} />
          <View style={{ padding: spacing.md, gap: 4 }} accessibilityRole="menu" accessibilityLabel="Room options">
            {/* Share */}
            <TouchableOpacity style={styles.overflowRow} onPress={() => handleAction(onShare)} accessibilityRole="menuitem" accessibilityLabel="Share room">
              <Ionicons name="share-outline" size={20} color={palette.frost} />
              <Text variant="body" color={palette.frost}>Share Room</Text>
            </TouchableOpacity>
            {/* Copy Code */}
            <TouchableOpacity style={styles.overflowRow} onPress={() => handleAction(onCopyCode)} accessibilityRole="menuitem" accessibilityLabel={joinCode ? `Copy room code ${joinCode}` : 'Copy room code'}>
              <Ionicons name="copy-outline" size={20} color={palette.frost} />
              <Text variant="body" color={palette.frost}>Copy Room Code</Text>
              {joinCode && (
                <LEDReadout value={joinCode} variant="amber" size="sm" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>
            {/* Chat */}
            <TouchableOpacity style={styles.overflowRow} onPress={() => handleAction(onChatOpen)} accessibilityRole="menuitem" accessibilityLabel="Open chat">
              <Ionicons name="chatbubble-outline" size={20} color={palette.frost} />
              <Text variant="body" color={palette.frost}>Chat</Text>
            </TouchableOpacity>
            {/* Lyrics */}
            {hasCurrentTrack && (
              <TouchableOpacity style={styles.overflowRow} onPress={() => handleAction(onLyricsOpen)} accessibilityRole="menuitem" accessibilityLabel="Show lyrics">
                <Ionicons name="musical-notes-outline" size={20} color={palette.frost} />
                <Text variant="body" color={palette.frost}>Lyrics</Text>
              </TouchableOpacity>
            )}
            {/* QR Code */}
            <TouchableOpacity style={styles.overflowRow} onPress={() => handleAction(onQRShow)} accessibilityRole="menuitem" accessibilityLabel="Show QR code">
              <Ionicons name="qr-code-outline" size={20} color={palette.frost} />
              <Text variant="body" color={palette.frost}>Show QR Code</Text>
            </TouchableOpacity>
            {/* Room Settings (host only) */}
            {isHost && onRoomSettings && (
              <TouchableOpacity style={styles.overflowRow} onPress={() => handleAction(onRoomSettings)} accessibilityRole="menuitem" accessibilityLabel="Room settings">
                <Ionicons name="settings-outline" size={20} color={palette.frost} />
                <Text variant="body" color={palette.frost}>Room Settings</Text>
              </TouchableOpacity>
            )}
            {/* Divider */}
            <View style={styles.overflowDivider} />
            {/* Leave / End */}
            <TouchableOpacity style={styles.overflowRow} onPress={() => handleAction(onLeaveRoom)} accessibilityRole="menuitem" accessibilityLabel={isHost ? 'End session' : 'Leave room'}>
              <Ionicons
                name={isHost ? 'close-circle-outline' : 'exit-outline'}
                size={20}
                color={palette.red}
              />
              <Text variant="body" color={palette.red}>
                {isHost ? 'End Session' : 'Leave Room'}
              </Text>
            </TouchableOpacity>
          </View>
        </VoidSurface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: palette.iceGlow,
  },
  sheetHandle: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: palette.iceGlow,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  overflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  overflowDivider: {
    height: 1,
    backgroundColor: palette.iceGlow,
    marginVertical: 4,
  },
});

export default OverflowMenu;
