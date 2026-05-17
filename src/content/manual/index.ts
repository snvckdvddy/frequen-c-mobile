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
 *   2. Add a MANUAL_SCREEN_IDS entry below if it represents a screen-level
 *      surface that participates in first-time-visit auto-show.
 *   3. Import + re-export below.
 */

import type { RoomMode } from '@frequen-c/types';
import type { ManualContent } from './types';
import { loginScreenManual } from './loginScreen';
import { joinSessionScreenManual } from './joinSessionScreen';
import { createSessionScreenManual } from './createSessionScreen';
import { homeScreenManual } from './homeScreen';
import { sessionRoomScreenManual } from './sessionRoomScreen';
import { campfireModeManual } from './modes/campfire';
import { spotlightModeManual } from './modes/spotlight';
import { openFloorModeManual } from './modes/openFloor';

export type { ManualContent, ManualStep, ManualCallout } from './types';
export {
  loginScreenManual,
  joinSessionScreenManual,
  createSessionScreenManual,
  homeScreenManual,
  sessionRoomScreenManual,
  campfireModeManual,
  spotlightModeManual,
  openFloorModeManual,
};

/**
 * Returns the right manual content for the current room mode. All
 * three modes now have dedicated entries describing their CURRENT
 * behavior accurately. C-Phase-3 (SPOTLIGHT elevation) and
 * C-Phase-4 (OPEN FLR elevation) will rewrite the spotlight + openFloor
 * entries to reference new WOW factors as they ship.
 */
export function getRoomManualForMode(mode: RoomMode): ManualContent {
  switch (mode) {
    case 'campfire':
      return campfireModeManual;
    case 'spotlight':
      return spotlightModeManual;
    case 'openFloor':
      return openFloorModeManual;
    default:
      return sessionRoomScreenManual;
  }
}

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
