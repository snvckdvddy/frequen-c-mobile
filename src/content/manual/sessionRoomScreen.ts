import type { ManualContent } from './types';

/**
 * Default session-room manual content. Focused on UNIVERSAL controls
 * that apply to every room regardless of mode. Mode-specific behavior
 * (Campfire / Spotlight / Open Floor differences) gets its own
 * per-mode manual entries shown when the user enters or switches into
 * a specific mode — see `src/content/manual/modes/*` (Workstream C).
 */
export const sessionRoomScreenManual: ManualContent = {
  contextLabel: 'ROOM BUS',
  title: 'INSIDE A ROOM',
  subtitle:
    'The basics every room shares. Mode-specific behavior gets its own explainer when you switch modes.',
  steps: [
    { tag: 'PATCH', text: 'Tap PATCH A TRACK to search and add tracks to the signal chain.' },
    { tag: 'PLAY', text: 'Transport controls (play, pause, skip) sit below the album hero.' },
    { tag: 'REACT', text: 'FIRE / VIBE / SKIP fire live signals to everyone in the room.' },
  ],
  callouts: [
    { label: 'QUEUE', value: 'Tap the QUEUE button to open the signal chain — see what is queued, what played, and the room mode.' },
    { label: 'MODE', value: 'The colored badge top-right shows the room mode. Hosts can change it from the queue sheet.' },
    { label: 'LEAVE', value: 'Back arrow top-left exits the room — your queued tracks stay on the chain.' },
  ],
  footer:
    'Each room mode (CAMPFIRE, SPOTLIGHT, OPEN FLR) has its own personality + control rules. The mode badge tells you which one is active.',
};
