import type { ManualContent } from '../types';
import { tacticalTokens } from '../../../features/session-v2/theme/tacticalTokens';

/**
 * OPEN FLR — manual content shown when the user is in (or switches
 * into) an OPEN FLR room. Positioned as "the crowd decides" —
 * vote-weighted ordering, anyone-can-skip, no host gatekeeping.
 *
 * Content design intent:
 *   - Lead with the FEELING ("the crowd decides" / "votes are the
 *     game"), not the mechanics (voteWeighted ordering,
 *     voteReordersQueue: true).
 *   - Describe what EXISTS today: vote-weighted queue ordering
 *     (BEHAVIOR_PRESETS), anyone can skip (skipAccess: 'anyone'),
 *     no approval gate, votes reorder the queue in real time.
 *   - Do NOT overpromise C-Phase-4 elevation features (crowd
 *     energy meter, real-time vote heatmap, end-of-night recap) —
 *     those get written into the manual when they actually ship.
 *   - Accent color matches the mode badge: acid (neon green
 *     #52F03A), which is also designated "Open Floor mode
 *     indicator" in the design tokens.
 */
export const openFloorModeManual: ManualContent = {
  contextLabel: 'OPEN FLR',
  title: 'THE CROWD DECIDES',
  subtitle:
    'OPEN FLR is pure democracy. Tracks bubble up the queue based on votes. Anyone can skip. The room collectively drives what plays next.',
  steps: [
    { tag: 'PATCH', text: 'Anyone can patch in a track. New tracks join the queue at the bottom.' },
    { tag: 'VOTE', text: 'Upvote tracks you want to hear sooner. Downvote tracks you want to push back. Votes reorder the queue in real time.' },
    { tag: 'SKIP', text: 'Anyone can skip the current track. The most-voted track plays next.' },
  ],
  callouts: [
    { label: 'VOTES REORDER', value: 'The queue is NOT first-in-first-out here. Top-voted tracks bubble to the top continuously.' },
    { label: 'OPEN SKIP', value: 'Anyone can skip the current track. Use the existing vote-skip mechanic if your room behaviors require consensus.' },
    { label: 'GOOD FOR', value: 'Bigger groups, party energy, when the room should drive itself. The "club crowd" mode.' },
  ],
  footer:
    'Want shared rotation without voting, or a host-curated experience? Switch to CAMPFIRE or SPOTLIGHT from System Preferences (host only).',
  accent: tacticalTokens.colors.acid,
};
