/**
 * usePauseSettle: the play/pause button's displayed state, with a tapped pause
 * held against late "playing" reports. The reasoning lives in
 * adapters/pauseSettle.ts.
 *
 * Call `notePlayPauseTap` from the button's onPress, next to the call that
 * actually toggles playback. Show `displayedPlaying` on the button instead of
 * the raw `isPlaying`.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  beginPauseHold,
  holdAfterLoadState,
  resolveDisplayedPlaying,
  type PauseHold,
} from '../adapters/pauseSettle';

export function usePauseSettle(
  actualPlaying: boolean,
  isLoading: boolean,
): {
  displayedPlaying: boolean;
  notePlayPauseTap: () => void;
} {
  const [hold, setHold] = useState<PauseHold>(null);

  // The window ends on its own, so a pause that never took effect shows as
  // playing again instead of staying wrong.
  useEffect(() => {
    if (hold === null) return;
    const timer = setTimeout(() => setHold(null), Math.max(0, hold - Date.now()));
    return () => clearTimeout(timer);
  }, [hold]);

  // A track load ends the hold: audio that starts afterwards is a different track.
  useEffect(() => {
    setHold((current) => holdAfterLoadState(current, isLoading));
  }, [isLoading]);

  const displayedPlaying = resolveDisplayedPlaying({ actualPlaying, hold, now: Date.now() });

  // The engine's toggle decides from its own latest report, so the tap is read
  // the same way: a pause while the engine says playing, a play otherwise.
  const notePlayPauseTap = useCallback(() => {
    setHold(beginPauseHold(actualPlaying, Date.now()));
  }, [actualPlaying]);

  return { displayedPlaying, notePlayPauseTap };
}
