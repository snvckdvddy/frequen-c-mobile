/**
 * Central index for Read Manual content.
 *
 * All manual entries live in this directory as typed data files. Screens
 * import their corresponding entry and spread it into <ManualPanel />.
 * This separates copy from layout — content tweaks don't require diving
 * into screen components, and writers / designers can edit the data
 * files directly.
 *
 * Adding a new entry:
 *   1. Create `./mySurface.ts` exporting a `ManualContent` const.
 *   2. Add a `screenIds.ts` entry below if it represents a screen-level
 *      surface that participates in first-time-visit auto-show.
 *   3. Re-export here.
 */

export type { ManualContent, ManualStep, ManualCallout } from './types';
export { loginScreenManual } from './loginScreen';
export { joinSessionScreenManual } from './joinSessionScreen';
export { createSessionScreenManual } from './createSessionScreen';
export { homeScreenManual } from './homeScreen';
export { sessionRoomScreenManual } from './sessionRoomScreen';

/**
 * Canonical screen identifiers for first-time-visit tracking. Keep
 * stable — these strings are written to AsyncStorage and changing one
 * means existing users see the auto-show again on that screen.
 */
export const MANUAL_SCREEN_IDS = {
  login: 'login',
  joinSession: 'joinSession',
  createSession: 'createSession',
  home: 'home',
  sessionRoom: 'sessionRoom',
} as const;

export type ManualScreenId = (typeof MANUAL_SCREEN_IDS)[keyof typeof MANUAL_SCREEN_IDS];
