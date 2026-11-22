import {
  PAUSE_SETTLE_MS,
  beginPauseHold,
  holdAfterLoadState,
  resolveDisplayedPlaying,
  type PauseHold,
} from '../pauseSettle';

const TAP_AT = 1_000_000;

/** What the button shows for an engine report arriving `afterMs` after the tap. */
function shown(actualPlaying: boolean, hold: PauseHold, afterMs: number): boolean {
  return resolveDisplayedPlaying({ actualPlaying, hold, now: TAP_AT + afterMs });
}

describe('beginPauseHold', () => {
  it('opens a window when the engine reports playing (the tap is a pause)', () => {
    expect(beginPauseHold(true, TAP_AT)).toBe(TAP_AT + PAUSE_SETTLE_MS);
  });

  it('opens nothing when the engine reports paused (the tap is a play)', () => {
    expect(beginPauseHold(false, TAP_AT)).toBeNull();
  });

  it('renews the window for a second tap made before the engine caught up', () => {
    // The engine still reports playing, so its toggle pauses again.
    expect(beginPauseHold(true, TAP_AT + 120)).toBe(TAP_AT + 120 + PAUSE_SETTLE_MS);
  });
});

describe('resolveDisplayedPlaying', () => {
  it('follows the engine when no pause was tapped', () => {
    expect(shown(true, null, 0)).toBe(true);
    expect(shown(false, null, 0)).toBe(false);
  });

  it('shows paused for the whole window, even while the engine still says playing', () => {
    const hold = beginPauseHold(true, TAP_AT);
    expect(shown(true, hold, 0)).toBe(false);
    expect(shown(true, hold, PAUSE_SETTLE_MS - 1)).toBe(false);
  });

  it('trusts the engine again once the window ends, so a pause that failed shows as playing', () => {
    const hold = beginPauseHold(true, TAP_AT);
    expect(shown(true, hold, PAUSE_SETTLE_MS)).toBe(true);
    expect(shown(true, hold, PAUSE_SETTLE_MS + 400)).toBe(true);
  });

  it('never invents "playing": a paused report shows as paused, window or not', () => {
    const hold = beginPauseHold(true, TAP_AT);
    expect(shown(false, hold, 0)).toBe(false);
    expect(shown(false, hold, PAUSE_SETTLE_MS + 400)).toBe(false);
    expect(shown(false, null, 0)).toBe(false);
  });

  it('hands the display back to the engine when a play tap clears the hold', () => {
    // Pause tapped, the engine catches up and reports paused, then the host taps
    // play: the engine reports paused, so that tap is a play and opens no window.
    const hold = beginPauseHold(true, TAP_AT);
    expect(shown(false, hold, 300)).toBe(false);

    const afterPlayTap = beginPauseHold(false, TAP_AT + 300);
    expect(afterPlayTap).toBeNull();
    expect(shown(true, afterPlayTap, 500)).toBe(true);
  });

  it('keeps showing paused through a second tap made before the engine caught up', () => {
    // The engine still reports playing, so it pauses again; the button agrees.
    const renewed = beginPauseHold(true, TAP_AT + 120);
    expect(shown(true, renewed, 120)).toBe(false);
    expect(shown(true, renewed, 120 + PAUSE_SETTLE_MS - 1)).toBe(false);
    expect(shown(true, renewed, 120 + PAUSE_SETTLE_MS)).toBe(true);
  });
});

describe('a host pause, as the button sees the bridge\'s reports', () => {
  // The order the SoundCloud bridge can produce around a pause: reports already
  // in flight, the first paused report, a late playing report, then paused.
  const reports: ReadonlyArray<{ afterMs: number; playing: boolean }> = [
    { afterMs: 0, playing: true },     // the tap: the engine has not heard back yet
    { afterMs: 80, playing: true },    // PLAY_PROGRESS already in flight
    { afterMs: 260, playing: false },  // first paused report (PAUSE event or poll)
    { afterMs: 330, playing: true },   // late playing report
    { afterMs: 520, playing: false },  // next poll
    { afterMs: 770, playing: false },
  ];

  it('goes straight to paused and stays there', () => {
    const hold = beginPauseHold(true, TAP_AT);
    const displayed = reports.map((r) => shown(r.playing, hold, r.afterMs));
    expect(displayed).toEqual([false, false, false, false, false, false]);
  });

  it('flickers without the hold (the behavior this replaces)', () => {
    const displayed = reports.map((r) => shown(r.playing, null, r.afterMs));
    expect(displayed).toEqual([true, true, false, true, false, false]);
  });

  it('shows playing again if the engine is still playing when the window ends', () => {
    const hold = beginPauseHold(true, TAP_AT);
    const stillPlaying = [0, 500, 1000, PAUSE_SETTLE_MS, PAUSE_SETTLE_MS + 250];
    expect(stillPlaying.map((afterMs) => shown(true, hold, afterMs))).toEqual([
      false, false, false, true, true,
    ]);
  });
});

describe('holdAfterLoadState', () => {
  it('drops the hold when a track starts loading', () => {
    expect(holdAfterLoadState(TAP_AT + PAUSE_SETTLE_MS, true)).toBeNull();
  });

  it('keeps the hold while nothing is loading', () => {
    expect(holdAfterLoadState(TAP_AT + PAUSE_SETTLE_MS, false)).toBe(TAP_AT + PAUSE_SETTLE_MS);
  });

  it('leaves "no hold" alone either way', () => {
    expect(holdAfterLoadState(null, true)).toBeNull();
    expect(holdAfterLoadState(null, false)).toBeNull();
  });

  it('lets the next track show as playing at once after a pause then skip', () => {
    // Pause tapped, then skip: the load clears the hold, so audio that starts
    // inside the old window is not hidden.
    const hold = holdAfterLoadState(beginPauseHold(true, TAP_AT), true);
    expect(shown(true, hold, 600)).toBe(true);
  });
});
