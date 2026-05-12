import type { ManualContent } from './types';

export const loginScreenManual: ManualContent = {
  contextLabel: 'AUTH BUS',
  title: 'LOGIN FLOW',
  subtitle: 'Use this when you already have an account and just need to reconnect to the app.',
  steps: [
    { tag: 'FAST', text: 'Use Apple or Google for one-tap sign in.' },
    { tag: 'EMAIL', text: 'Or enter the email tied to your existing profile.' },
    { tag: 'DONE', text: 'PATCH IN returns you to the main app once the route is valid.' },
  ],
  callouts: [
    { label: 'RETURNING USER', value: 'Use Patch In if the account already exists.' },
    { label: 'NEXT SCREEN', value: 'Successful login hands off to the entry grid.' },
  ],
  footer: 'If you have never made an account on this device, switch to Generate Signal.',
};
