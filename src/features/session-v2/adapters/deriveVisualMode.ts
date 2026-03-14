import { DEFAULT_BEHAVIORS, type RoomBehaviors } from '../../../types';
import type { SignalChainVisualMode } from '../types';

export function deriveVisualMode(
  behaviors?: Partial<RoomBehaviors> | null,
): SignalChainVisualMode {
  const resolved = { ...DEFAULT_BEHAVIORS, ...(behaviors || {}) };

  if (resolved.requiresApproval) return 'spotlight';
  if (resolved.voteReordersQueue) return 'openFloor';
  return 'campfire';
}
