import type { ManualContent } from './types';

export const createSessionScreenManual: ManualContent = {
  contextLabel: 'INIT BUS',
  title: 'ROOM BUILD ORDER',
  subtitle: 'Build the room in order, then execute the patch once the labels and mode feel right.',
  steps: [
    { tag: 'NAME', text: 'Start with a room name people can recognize quickly.' },
    { tag: 'MODE', text: 'Choose how control should feel: shared turns, host-led, or vote-driven.' },
    { tag: 'EXEC', text: 'EXECUTE PATCH creates the room and moves you directly into the session.' },
  ],
  callouts: [
    { label: 'SAFE DEFAULT', value: 'Campfire is still the easiest first room for demos.' },
    { label: 'ADVANCED', value: 'You can ignore advanced behaviors on a first pass.' },
    { label: 'PRIVATE ROOM', value: 'Turn off visibility if you want host-invite only access.' },
  ],
  footer: 'Create is the host path. If you only need to enter an existing room, use Join instead.',
};
