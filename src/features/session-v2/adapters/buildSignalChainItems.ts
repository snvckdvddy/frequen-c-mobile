import type { QueueTrack } from '../../../types';
import type { SignalChainItem, SignalChainVisualMode, SignalVoteHeat } from '../types';

interface BuildSignalChainItemsArgs {
  mode: SignalChainVisualMode;
  queue: QueueTrack[];
  suggestedQueue: QueueTrack[];
  isHost: boolean;
}

function formatIndex(index: number): string {
  return String(index + 1).padStart(2, '0');
}

function resolveVoteHeat(mode: SignalChainVisualMode, queue: QueueTrack[]): Map<string, SignalVoteHeat> {
  const heat = new Map<string, SignalVoteHeat>();
  if (mode !== 'openFloor') return heat;

  const maxPositive = queue.reduce((acc, track) => {
    const votes = track.votes ?? 0;
    return votes > acc ? votes : acc;
  }, 0);

  queue.forEach((track) => {
    const votes = track.votes ?? 0;
    if (votes < 0) {
      heat.set(track.id, 'low');
    } else if (maxPositive > 0 && votes === maxPositive) {
      heat.set(track.id, 'high');
    } else {
      heat.set(track.id, 'neutral');
    }
  });

  return heat;
}

export function buildSignalChainItems({
  mode,
  queue,
  suggestedQueue,
  isHost,
}: BuildSignalChainItemsArgs): SignalChainItem[] {
  const visibleQueue = queue.map((track) => ({
    ...track,
    status: track.status || 'approved',
  }));
  const voteHeat = resolveVoteHeat(mode, visibleQueue);

  const items: SignalChainItem[] = visibleQueue.map((track, index) => ({
    track,
    indexLabel: formatIndex(index),
    isCurrent: index === 0,
    isPending: false,
    showApprovalActions: false,
    showVoteTower: mode === 'openFloor',
    voteHeat: voteHeat.get(track.id) || 'neutral',
    showCampfireCable: false,
  }));

  if (mode === 'spotlight') {
    const pendingItems = suggestedQueue.map((track, pendingIndex) => ({
      track: {
        ...track,
        status: 'pending' as const,
      },
      indexLabel: formatIndex(items.length + pendingIndex),
      isCurrent: false,
      isPending: true,
      showApprovalActions: isHost,
      showVoteTower: false,
      voteHeat: 'neutral' as const,
      showCampfireCable: false,
    }));

    items.push(...pendingItems);
  }

  if (mode === 'campfire') {
    return items.map((item, index) => ({
      ...item,
      showCampfireCable: index < items.length - 1,
    }));
  }

  return items;
}
