/**
 * Pause settle: what the play/pause button shows right after the host taps pause.
 *
 * The button reads the engine's `isPlaying`, and the engine copies it from every
 * report the playback backend sends. Reports already in flight when a pause lands
 * still say "playing" (the SoundCloud bridge's PLAY_PROGRESS listener hard-codes
 * isPlaying: true, and its 250 ms poll can straddle the pause), and togglePlayPause
 * changes no state on the tap itself. So the button sat on "pause" until the first
 * "paused" report, and a late "playing" report could flip it back before it settled.
 *
 * The fix is on the display: the tap shows "paused" at once, and "playing" reports
 * are ignored for a short window. After the window the engine is trusted again, so a
 * pause that never took effect shows as playing again instead of staying wrong.
 *
 * Plain TS with no React or native imports, so it is unit-testable.
 */

/**
 * How long a tapped pause outranks "playing" reports. Long enough for the bridge's
 * slowest stray report (a few 250 ms polls plus WebView message delay); short enough
 * that a pause which failed still shows up within about a second and a half.
 */
export const PAUSE_SETTLE_MS = 1500;

/** When (ms since epoch) a tapped pause stops outranking reports, or null when none is active. */
export type PauseHold = number | null;

/**
 * The hold a tap opens. togglePlayPause decides from the engine's latest report,
 * so a tap while the engine reports "playing" is a pause (even if the button
 * already shows "paused" from an earlier tap, in which case the hold is renewed),
 * and a tap while it reports "paused" is a play, which leaves nothing to hold.
 */
export function beginPauseHold(enginePlaying: boolean, now: number): PauseHold {
  return enginePlaying ? now + PAUSE_SETTLE_MS : null;
}

/**
 * A track load ends the hold: audio that starts afterwards is not the audio the
 * host paused, so it must show as playing straight away.
 */
export function holdAfterLoadState(hold: PauseHold, isLoading: boolean): PauseHold {
  return isLoading ? null : hold;
}

export interface DisplayedPlayingInput {
  /** `isPlaying` as the engine reports it. */
  actualPlaying: boolean;
  hold: PauseHold;
  now: number;
}

/**
 * Whether the button should show "playing". It only ever withholds "playing";
 * a report of "paused" is always shown as paused.
 */
export function resolveDisplayedPlaying({ actualPlaying, hold, now }: DisplayedPlayingInput): boolean {
  if (!actualPlaying) return false;
  const holding = hold !== null && now < hold;
  return !holding;
}
