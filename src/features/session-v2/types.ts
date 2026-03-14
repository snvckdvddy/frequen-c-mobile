import type { QueueTrack } from '../../types';

export type SignalChainVisualMode = 'campfire' | 'spotlight' | 'openFloor';

export interface TacticalReadoutValues {
  bpmLabel: string;
  keyLabel: string;
  formatLabel: string;
}

export type SignalVoteHeat = 'high' | 'neutral' | 'low';

export interface SignalChainItem {
  track: QueueTrack;
  indexLabel: string;
  isCurrent: boolean;
  isPending: boolean;
  showApprovalActions: boolean;
  showVoteTower: boolean;
  voteHeat: SignalVoteHeat;
  showCampfireCable: boolean;
}
