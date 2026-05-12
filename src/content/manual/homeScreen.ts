import type { ManualContent } from './types';

export const homeScreenManual: ManualContent = {
  contextLabel: 'ENTRY BUS',
  title: 'START HERE',
  subtitle: 'Use the entry grid to host, join, or reopen a room without guessing what each action does.',
  steps: [
    { tag: 'HOST', text: 'CREATE opens the room builder and then drops you straight into Session V2.' },
    { tag: 'JOIN', text: 'JOIN is the guest path. Use it when someone else already has a room running.' },
    { tag: 'LIVE', text: 'ACTIVE PATCH reopens the room already attached to your profile if one is running.' },
  ],
  callouts: [
    { label: 'CREATE', value: 'Host path into a new room.' },
    { label: 'JOIN', value: 'Guest path with code or QR.' },
    { label: 'CV', value: 'Voltage is a special layer, not basic queueing.' },
  ],
  footer: 'Profile > Read the Manual keeps these helper rails visible.',
};
