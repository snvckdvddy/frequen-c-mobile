/**
 * Which build and which OTA update this phone is running.
 *
 * After `npm run ota:publish` the only way to know the phone picked the update
 * up (and did not roll back to the bundle inside the APK) is to ask expo-updates.
 * Surfaced in the Profile BUILD row and in COPY DIAGNOSTICS, and logged once per
 * launch so `adb logcat` shows it too.
 */

import * as Updates from 'expo-updates';
import { logger } from '../utils/logger';

/** Leading characters of the update UUID shown on screen; enough to match `eas update` output. */
const SHORT_ID_LENGTH = 8;

/** What expo-updates reports, before any formatting. */
export interface RawUpdateState {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  createdAt: Date | null;
}

export interface RunningUpdate {
  /** First 8 characters of the update ID, EMBEDDED, or UPDATES OFF. */
  label: string;
  updateId: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  /** The bundle inside the APK is running, not a downloaded update. */
  isEmbedded: boolean;
  /** False in dev clients and Expo Go, where expo-updates is switched off. */
  updatesEnabled: boolean;
  /** ISO time the running update was created, when known. */
  createdAt: string | null;
}

const UNREADABLE: RawUpdateState = {
  isEnabled: false,
  isEmbeddedLaunch: false,
  updateId: null,
  channel: null,
  runtimeVersion: null,
  createdAt: null,
};

export function describeUpdate(raw: RawUpdateState): RunningUpdate {
  const isEmbedded = raw.isEnabled && (raw.isEmbeddedLaunch || !raw.updateId);
  let label: string;
  if (!raw.isEnabled) label = 'UPDATES OFF';
  else if (isEmbedded) label = 'EMBEDDED';
  else label = (raw.updateId ?? '').slice(0, SHORT_ID_LENGTH).toUpperCase();

  return {
    label,
    updateId: raw.updateId,
    channel: raw.channel,
    runtimeVersion: raw.runtimeVersion,
    isEmbedded,
    updatesEnabled: raw.isEnabled,
    createdAt: raw.createdAt ? raw.createdAt.toISOString() : null,
  };
}

function readUpdateState(): RawUpdateState {
  try {
    return {
      isEnabled: Updates.isEnabled === true,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch === true,
      updateId: Updates.updateId ?? null,
      channel: Updates.channel ?? null,
      runtimeVersion: Updates.runtimeVersion ?? null,
      createdAt: Updates.createdAt ?? null,
    };
  } catch (err) {
    logger.warn('updates', 'Could not read the running update from expo-updates', err);
    return UNREADABLE;
  }
}

export function getRunningUpdate(): RunningUpdate {
  return describeUpdate(readUpdateState());
}

/** Second line of the Profile BUILD row, e.g. "OTA // 01A1C971 // CHANNEL PREVIEW". */
export function formatUpdateRowText(update: RunningUpdate): string {
  const channel = update.channel ? update.channel.toUpperCase() : 'NONE';
  return `OTA // ${update.label} // CHANNEL ${channel}`;
}

/** Lines for the APP RUNTIME block of the diagnostics bundle. */
export function formatUpdateDiagnosticsLines(update: RunningUpdate): string[] {
  const lines = [
    `OTA update: ${update.label} (id ${update.updateId ?? 'none'})`,
    `OTA channel: ${update.channel ?? 'none'}`,
    `Runtime version: ${update.runtimeVersion ?? 'unknown'}`,
  ];
  if (update.createdAt) lines.push(`OTA created: ${update.createdAt}`);
  return lines;
}

let launchLogged = false;

/** Log the running update once per launch (tag "updates"). Later calls do nothing. */
export function logRunningUpdateOnce(): void {
  if (launchLogged) return;
  launchLogged = true;
  const update = getRunningUpdate();
  logger.info(
    'updates',
    `running ${update.label} (id ${update.updateId ?? 'none'}, channel ${update.channel ?? 'none'}, ` +
      `runtime ${update.runtimeVersion ?? 'unknown'}, embedded ${update.isEmbedded ? 'yes' : 'no'}, ` +
      `updates ${update.updatesEnabled ? 'on' : 'off'})`,
  );
}
