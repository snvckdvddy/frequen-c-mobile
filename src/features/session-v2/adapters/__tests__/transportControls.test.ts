import {
  deriveMiniPlayerControls,
  getHostOutputStatus,
  type MiniPlayerControlsInput,
} from '../transportControls';

describe('getHostOutputStatus', () => {
  it('says the host is outputting audio while playing', () => {
    expect(getHostOutputStatus(true)).toEqual({
      label: 'HOST OUTPUT',
      accessibilityLabel: 'Audio is playing from the host device',
    });
  });

  it('says the host is paused otherwise', () => {
    expect(getHostOutputStatus(false)).toEqual({
      label: 'HOST PAUSED',
      accessibilityLabel: 'Host playback is paused',
    });
  });
});

describe('deriveMiniPlayerControls', () => {
  it('gives a host play/pause and skip, no status (the host mini player is unchanged)', () => {
    expect(deriveMiniPlayerControls({ isHost: true, hasPlayPause: true, canSkip: true })).toEqual({
      showPlayPause: true,
      showSkip: true,
      showHostStatus: false,
    });
  });

  it('keeps the optional pieces optional for a host', () => {
    expect(deriveMiniPlayerControls({ isHost: true, hasPlayPause: false, canSkip: true })).toEqual({
      showPlayPause: false,
      showSkip: true,
      showHostStatus: false,
    });
    expect(deriveMiniPlayerControls({ isHost: true, hasPlayPause: true, canSkip: false })).toEqual({
      showPlayPause: true,
      showSkip: false,
      showHostStatus: false,
    });
  });

  it('gives a guest the host status only, even with handlers and canSkip supplied', () => {
    expect(deriveMiniPlayerControls({ isHost: false, hasPlayPause: true, canSkip: true })).toEqual({
      showPlayPause: false,
      showSkip: false,
      showHostStatus: true,
    });
  });

  it('never shows a guest any control, whatever the other inputs are', () => {
    const bools = [true, false];
    const inputs: MiniPlayerControlsInput[] = bools.flatMap((hasPlayPause) =>
      bools.map((canSkip) => ({ isHost: false, hasPlayPause, canSkip })),
    );
    for (const input of inputs) {
      const controls = deriveMiniPlayerControls(input);
      expect(controls.showPlayPause).toBe(false);
      expect(controls.showSkip).toBe(false);
      expect(controls.showHostStatus).toBe(true);
    }
  });

  it('never shows the host status on the host\'s own device', () => {
    const bools = [true, false];
    for (const hasPlayPause of bools) {
      for (const canSkip of bools) {
        expect(deriveMiniPlayerControls({ isHost: true, hasPlayPause, canSkip }).showHostStatus).toBe(false);
      }
    }
  });
});
