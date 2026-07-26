/**
 * SessionRoomPrompts — the three TacticalActionPrompt overlays
 * ─────────────────────────────────────────────────────────────
 * Extracted from SessionRoomScreen to reduce line count.
 * Pure render component — no hooks, no side effects.
 *
 * Prompts:
 *   1. Share Room (QR code + share link)
 *   2. Leave / End Session (host vs guest copy)
 *   3. Confirm Power Move (Overdrive / Phase Cancel)
 */

import React from 'react';
import TacticalActionPrompt from './TacticalActionPrompt';
import type { PendingPowerPrompt } from '../../../hooks/useGameLayer';

interface SessionRoomPromptsProps {
  /** Share prompt */
  sharePromptOpen: boolean;
  onCloseShare: () => void;
  onShowQR: () => void;
  onShareLink: () => void;

  /** Leave/End prompt */
  leavePromptOpen: boolean;
  isHost: boolean;
  sessionName: string;
  onCloseLeave: () => void;
  onConfirmLeave: () => void;
  /** Host only: exit the screen while the session keeps playing */
  onMinimize: () => void;

  /** Power move confirm prompt */
  pendingPowerPrompt: PendingPowerPrompt | null;
  onClosePower: () => void;
  onConfirmPower: () => void;
}

export default function SessionRoomPrompts({
  sharePromptOpen,
  onCloseShare,
  onShowQR,
  onShareLink,
  leavePromptOpen,
  isHost,
  sessionName,
  onCloseLeave,
  onConfirmLeave,
  onMinimize,
  pendingPowerPrompt,
  onClosePower,
  onConfirmPower,
}: SessionRoomPromptsProps) {
  return (
    <>
      {sharePromptOpen && (
        <TacticalActionPrompt
          visible
          eyebrow="SYS.FREQ // SHARE BUS"
          title="SHARE ROOM"
          description="Distribute the room link or open an in-room QR handoff."
          onClose={onCloseShare}
          actions={[
            {
              label: 'Show QR Code',
              description: 'Display the room join code as a tactical QR overlay.',
              icon: 'qr-code-outline',
              onPress: () => {
                onCloseShare();
                onShowQR();
              },
            },
            {
              label: 'Share Link',
              description: 'Open the native share sheet with the room deep link.',
              icon: 'share-social-outline',
              onPress: onShareLink,
            },
          ]}
        />
      )}

      {leavePromptOpen && (
        <TacticalActionPrompt
          visible
          eyebrow={isHost ? 'SYS.FREQ // HOST EXIT' : 'SYS.FREQ // EXIT BUS'}
          title={isHost ? 'EXIT ROOM' : 'LEAVE ROOM'}
          description={
            isHost
              ? 'Minimize to keep the music playing, or end the session for everyone.'
              : `Exit "${sessionName}" and return to the room list.`
          }
          onClose={onCloseLeave}
          actions={[
            {
              label: isHost ? 'Stay Online' : 'Stay In Room',
              description: 'Dismiss this prompt and continue in the session.',
              icon: 'arrow-undo-outline',
              onPress: onCloseLeave,
            },
            // Hosts get a middle path: their device is the room's audio
            // output, so leaving the SCREEN must not mean ending the
            // PARTY. Playback survives because the WebView lives at the
            // provider level, not this screen.
            ...(isHost
              ? [
                  {
                    label: 'Minimize Room',
                    description: 'Keep the music playing. Rejoin anytime from ACTIVE PATCH on Home.',
                    icon: 'chevron-down-outline' as const,
                    onPress: onMinimize,
                  },
                ]
              : []),
            {
              label: isHost ? 'End Session' : 'Leave Room',
              description: isHost
                ? 'Close the room for everyone connected right now.'
                : 'Disconnect from this session and leave the room.',
              icon: 'exit-outline',
              tone: 'danger',
              onPress: onConfirmLeave,
            },
          ]}
        />
      )}

      {pendingPowerPrompt && (
        <TacticalActionPrompt
          visible
          eyebrow={pendingPowerPrompt.type === 'overdrive' ? 'SYS.FREQ // POWER ROUTE' : 'SYS.FREQ // SHIELD BUS'}
          title={pendingPowerPrompt.type === 'overdrive' ? 'CONFIRM OVERDRIVE' : 'CONFIRM PHASE CANCEL'}
          description={
            pendingPowerPrompt.type === 'overdrive'
              ? 'Spend 25 CV to force the targeted track to the top of the queue.'
              : 'Spend 15 CV to block the next skip in this room.'
          }
          onClose={onClosePower}
          actions={[
            {
              label: 'Cancel',
              description: 'Dismiss this power route request.',
              icon: 'close-outline',
              onPress: onClosePower,
            },
            {
              label: pendingPowerPrompt.type === 'overdrive' ? 'Spend 25 CV' : 'Spend 15 CV',
              description: pendingPowerPrompt.type === 'overdrive'
                ? 'Execute Overdrive on the targeted track.'
                : 'Activate Phase Cancel for the room.',
              icon: pendingPowerPrompt.type === 'overdrive' ? 'flash-outline' : 'shield-outline',
              tone: 'danger',
              onPress: onConfirmPower,
            },
          ]}
        />
      )}
    </>
  );
}
