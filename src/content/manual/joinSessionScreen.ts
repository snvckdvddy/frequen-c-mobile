import type { ManualContent } from './types';

export const joinSessionScreenManual: ManualContent = {
  contextLabel: 'JOIN BUS',
  title: 'HOW PATCH-IN WORKS',
  subtitle: 'This is the fastest path for guests. Use it when a host already has the room running.',
  steps: [
    { tag: 'HOST', text: 'Ask the host for the room code or have them show the QR handoff.' },
    { tag: 'SCAN', text: 'Scan QR if you are together in person. It fills the route automatically.' },
    { tag: 'PATCH', text: 'PATCH IN validates the code and hands off to the live room screen.' },
  ],
  callouts: [
    { label: 'ROOM CODE', value: 'Best when a host can send text or speak the code.' },
    { label: 'QR HANDOFF', value: 'Best when you are standing in the same room.' },
    { label: 'PRIVATE', value: 'Private rooms still join here, but they need the exact host code.' },
  ],
  footer: 'Use Join when you are entering someone else’s room, not creating a new one.',
};
