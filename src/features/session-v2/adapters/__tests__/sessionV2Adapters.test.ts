import { buildSignalChainItems } from '../buildSignalChainItems';
import { buildTacticalReadout } from '../buildTacticalReadout';
import { deriveVisualMode } from '../deriveVisualMode';
import type { QueueTrack, RoomBehaviors } from '../../../../types';

const baseBehaviors: RoomBehaviors = {
  queueOrdering: 'fifo',
  voteReordersQueue: false,
  skipAccess: 'anyone',
  requiresApproval: false,
  allowOverdrive: true,
  allowPhaseCancel: true,
  allowPhantomPower: true,
  forecastEnabled: true,
  duelEnabled: true,
  reverbTailSeconds: 300,
};

function makeTrack(id: string, votes = 0): QueueTrack {
  return {
    id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    duration: 180,
    source: 'spotify',
    previewUrl: 'https://example.com/sample.mp3',
    addedById: `user-${id}`,
    addedBy: { userId: `user-${id}`, username: `user${id}` },
    addedAt: '2026-03-13T00:00:00.000Z',
    votes,
    reactions: [],
  };
}

describe('deriveVisualMode', () => {
  it('maps approval rooms to spotlight', () => {
    expect(deriveVisualMode({ ...baseBehaviors, requiresApproval: true })).toBe('spotlight');
  });

  it('maps vote-reorder rooms to openFloor', () => {
    expect(deriveVisualMode({ ...baseBehaviors, voteReordersQueue: true })).toBe('openFloor');
  });

  it('defaults to campfire', () => {
    expect(deriveVisualMode(baseBehaviors)).toBe('campfire');
  });
});

describe('buildTacticalReadout', () => {
  it('keeps the lcd rows rigid with fallbacks', () => {
    expect(buildTacticalReadout(undefined)).toEqual({
      bpmLabel: '---.-',
      keyLabel: 'N/A',
      formatLabel: 'STRM',
    });
  });

  it('uses real values when available', () => {
    expect(buildTacticalReadout({
      id: 'track-1',
      title: 'Track 1',
      artist: 'Artist 1',
      duration: 180,
      source: 'spotify',
      previewUrl: 'https://example.com/sample.wav',
      addedById: 'user-1',
      addedAt: '2026-03-13T00:00:00.000Z',
      bpm: 128.4,
      key: 'Fm',
    } as QueueTrack & { bpm: number; key: string })).toEqual({
      bpmLabel: '128.4',
      keyLabel: 'Fm',
      formatLabel: 'WAV',
    });
  });
});

describe('buildSignalChainItems', () => {
  it('connects campfire tracks as a routed chain', () => {
    const items = buildSignalChainItems({
      mode: 'campfire',
      queue: [makeTrack('a'), makeTrack('b')],
      suggestedQueue: [],
      isHost: false,
    });

    expect(items).toHaveLength(2);
    expect(items[0].showCampfireCable).toBe(true);
    expect(items[1].showCampfireCable).toBe(false);
    expect(items[0].isCurrent).toBe(true);
  });

  it('appends spotlight suggestions as pending ghost items', () => {
    const items = buildSignalChainItems({
      mode: 'spotlight',
      queue: [makeTrack('a')],
      suggestedQueue: [makeTrack('b')],
      isHost: true,
    });

    expect(items).toHaveLength(2);
    expect(items[1].isPending).toBe(true);
    expect(items[1].showApprovalActions).toBe(true);
    expect(items[1].showVoteTower).toBe(false);
  });

  it('makes spotlight pending items read-only for listeners', () => {
    const items = buildSignalChainItems({
      mode: 'spotlight',
      queue: [makeTrack('a')],
      suggestedQueue: [makeTrack('b')],
      isHost: false,
    });

    expect(items[1].isPending).toBe(true);
    expect(items[1].showApprovalActions).toBe(false);
  });

  it('assigns vote heat in open floor mode', () => {
    const items = buildSignalChainItems({
      mode: 'openFloor',
      queue: [makeTrack('a', 42), makeTrack('b', 12), makeTrack('c', -4)],
      suggestedQueue: [],
      isHost: false,
    });

    expect(items[0].voteHeat).toBe('high');
    expect(items[1].voteHeat).toBe('neutral');
    expect(items[2].voteHeat).toBe('low');
    expect(items.every((item) => item.showVoteTower)).toBe(true);
  });
});
