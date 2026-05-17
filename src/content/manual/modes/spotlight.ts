import type { ManualContent } from '../types';
import { tacticalTokens } from '../../../features/session-v2/theme/tacticalTokens';

/**
 * SPOTLIGHT — manual content shown when the user is in (or switches
 * into) a SPOTLIGHT room. Positioned as "the host runs the show" —
 * guests request, host curates, host controls the flow.
 *
 * Content design intent:
 *   - Lead with the FEELING ("host runs the show" / "DJ at the
 *     booth"), not the mechanics (FIFO ordering, requiresApproval).
 *     The mechanics live in the callouts.
 *   - Describe what EXISTS today: request flow (handled via
 *     handleApproveTrack/handleRejectTrack in SessionRoomScreen),
 *     host-only skip (skipAccess: 'hostOnly' in BEHAVIOR_PRESETS),
 *     approval gating (requiresApproval: true).
 *   - Do NOT overpromise C-Phase-3 elevation features (asymmetric
 *     host/audience UI, request status notifications, pro
 *     transitions) until they actually ship. This file gets
 *     rewritten as part of C-Phase-3 to reference the new WOW
 *     factors then.
 *   - Accent color matches the mode badge default (white) since
 *     SPOTLIGHT does not currently have a dedicated mode color in
 *     getModeBlockColors. Worth revisiting in C-Phase-3 if we add
 *     a SPOTLIGHT-specific palette entry.
 */
export const spotlightModeManual: ManualContent = {
  contextLabel: 'SPOTLIGHT',
  title: 'THE HOST RUNS THE SHOW',
  subtitle:
    'SPOTLIGHT is a host-curated set. Guests can request tracks; the host decides what plays and when. Like a DJ at the booth, the host is in control of the flow.',
  steps: [
    { tag: 'REQUEST', text: 'Patch a track to request it. The request goes to the host for review before joining the live queue.' },
    { tag: 'APPROVE', text: 'The host approves or rejects each request. Approved tracks slot into the live queue in submission order.' },
    { tag: 'PLAY', text: 'The host controls play order and skips. Guests cannot skip the current track in SPOTLIGHT.' },
  ],
  callouts: [
    { label: 'HOST ONLY SKIP', value: 'Only the host can skip the current track. Guests can react and request but not jump tracks.' },
    { label: 'APPROVAL REQUIRED', value: 'New track requests sit in a holding area until the host approves them. Rejected requests are dropped.' },
    { label: 'GOOD FOR', value: 'Curated sets, theme nights, performance vibes. The "house DJ" mode where one person drives the vibe.' },
  ],
  footer:
    'Want a fairly-rotating shared queue or a vote-driven crowd? Switch to CAMPFIRE or OPEN FLR from System Preferences (host only).',
  accent: tacticalTokens.colors.white,
};
