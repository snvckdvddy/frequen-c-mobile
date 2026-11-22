/**
 * The add-track sheet's LIBRARY tab: which source it shows (services or the
 * host's local files) and the action text on a result row.
 */

import { getRowActionLabel, resolveLibrarySource } from '../librarySource';

describe('resolveLibrarySource', () => {
  const counts = [0, 1, 4];

  it('shows services only when Local is not offered (a guest), however many are connected', () => {
    for (const connectedServiceCount of counts) {
      for (const localPicked of [false, true]) {
        expect(
          resolveLibrarySource({ localAvailable: false, localPicked, connectedServiceCount }),
        ).toBe('service');
      }
    }
  });

  it('shows Local when a host picked it, whatever is connected', () => {
    for (const connectedServiceCount of counts) {
      expect(
        resolveLibrarySource({ localAvailable: true, localPicked: true, connectedServiceCount }),
      ).toBe('local');
    }
  });

  it('lands a host with no connected service on Local instead of an empty services panel', () => {
    expect(
      resolveLibrarySource({ localAvailable: true, localPicked: false, connectedServiceCount: 0 }),
    ).toBe('local');
  });

  it('keeps the connected service as the default for a host who has one', () => {
    expect(
      resolveLibrarySource({ localAvailable: true, localPicked: false, connectedServiceCount: 1 }),
    ).toBe('service');
    expect(
      resolveLibrarySource({ localAvailable: true, localPicked: false, connectedServiceCount: 4 }),
    ).toBe('service');
  });
});

describe('getRowActionLabel', () => {
  it('reads ADD for a row that can be added', () => {
    expect(getRowActionLabel({ inQueue: false, patched: false })).toBe('ADD');
  });

  it('reads ADDED while the tap is going through', () => {
    expect(getRowActionLabel({ inQueue: false, patched: true })).toBe('ADDED ✓');
  });

  it('reads IN QUEUE once the track is in the room, and that wins over a pending tap', () => {
    expect(getRowActionLabel({ inQueue: true, patched: false })).toBe('IN QUEUE');
    expect(getRowActionLabel({ inQueue: true, patched: true })).toBe('IN QUEUE');
  });
});
