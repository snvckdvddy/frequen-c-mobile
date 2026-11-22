/**
 * Transport controls, decided in one place so the mini player and the in-room
 * transport deck agree.
 *
 * Host-output model: audio plays on the host's device, so only the host has
 * transport over it. A guest gets a read-only status of the host's output, never
 * a pause or skip button that would do nothing (or the wrong thing).
 *
 * Plain TS with no React or native imports, so it is unit-testable.
 */

export interface HostOutputStatus {
  label: 'HOST OUTPUT' | 'HOST PAUSED';
  accessibilityLabel: string;
}

/** The status a guest sees in place of the host's play/pause control. */
export function getHostOutputStatus(isPlaying: boolean): HostOutputStatus {
  return isPlaying
    ? { label: 'HOST OUTPUT', accessibilityLabel: 'Audio is playing from the host device' }
    : { label: 'HOST PAUSED', accessibilityLabel: 'Host playback is paused' };
}

export interface MiniPlayerControlsInput {
  isHost: boolean;
  /** The caller supplied a play/pause handler. */
  hasPlayPause: boolean;
  canSkip: boolean;
}

export interface MiniPlayerControls {
  showPlayPause: boolean;
  showSkip: boolean;
  /** The read-only host status that stands in for the controls on a guest's device. */
  showHostStatus: boolean;
}

/**
 * Which controls the mini player renders. A guest never gets play/pause or skip,
 * whatever handlers or `canSkip` the caller passes; a host gets what was supplied.
 */
export function deriveMiniPlayerControls({
  isHost,
  hasPlayPause,
  canSkip,
}: MiniPlayerControlsInput): MiniPlayerControls {
  if (!isHost) {
    return { showPlayPause: false, showSkip: false, showHostStatus: true };
  }
  return { showPlayPause: hasPlayPause, showSkip: canSkip, showHostStatus: false };
}
