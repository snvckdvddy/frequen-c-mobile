import type { ManualContent } from '../types';
import { tacticalTokens } from '../../../features/session-v2/theme/tacticalTokens';

/**
 * CAMPFIRE — manual content shown when the user is in (or switches
 * into) a CAMPFIRE room. The mode is positioned as "the gathering" —
 * everyone takes turns, no power moves, warm + communal.
 *
 * Content design intent:
 *   - Lead with the FEELING ("gathering" / "everyone gets a turn")
 *     not the mechanics (round-robin / no approval). The mechanics
 *     are real and live in the callouts; the lead is the metaphor.
 *   - Subtraction language is intentional: "no power moves" is a
 *     feature of the mode, not a missing capability. CAMPFIRE is
 *     defined as much by what it doesn't have as by what it does.
 *   - The NEXT beacon (whose-turn-it-is) is named in a callout so
 *     users know to look for it.
 */
export const campfireModeManual: ManualContent = {
  contextLabel: 'CAMPFIRE',
  title: 'EVERYONE TAKES A TURN',
  subtitle:
    'CAMPFIRE rotates fairly through the people queuing tracks. The vibe is communal — no power plays, no host gatekeeping. Just one room, one queue, taking turns.',
  steps: [
    { tag: 'PATCH', text: 'Anyone can patch in a track at any time. Adds drop into the rotation.' },
    { tag: 'ROTATE', text: 'The queue auto-rotates between queuers so nobody plays back-to-back unless they are the only one queuing.' },
    { tag: 'SKIP', text: 'Anyone can skip the current track. No host approval required, no vote needed.' },
  ],
  callouts: [
    { label: 'WHOSE TURN', value: 'A "NEXT" beacon under the album hero shows who queued the upcoming track.' },
    { label: 'NO POWER MOVES', value: 'Phase Cancel / Overdrive / Phantom Power are hidden here. They reappear in SPOTLIGHT + OPEN FLR.' },
    { label: 'GOOD FOR', value: 'Casual hangs, small rooms, friends. The "house party with friends" mode.' },
  ],
  footer:
    'Want host control or a vote-driven queue? Switch to SPOTLIGHT or OPEN FLR from the queue sheet (host only).',
  accent: tacticalTokens.colors.orange,
};
