/**
 * Crash reporting — Sentry, gated on a DSN.
 *
 * Without EXPO_PUBLIC_SENTRY_DSN in the build (or OTA) env this is a
 * no-op: the native module ships in the APK but nothing initializes and
 * no data leaves the device. Set the DSN in eas.json (all profiles) once
 * the Sentry project exists — an OTA republish with the env var set then
 * enables reporting without cutting a new APK, because EXPO_PUBLIC_ vars
 * are inlined at JS bundle time while the native SDK is already aboard.
 */

import * as Sentry from '@sentry/react-native';
import { readEnv } from '../utils/env';

const SENTRY_DSN = readEnv(process.env.EXPO_PUBLIC_SENTRY_DSN);

export function initCrashReporting(): void {
  if (!SENTRY_DSN) return;
  Sentry.init({
    dsn: SENTRY_DSN,
    // Crash and error capture only for the beta — no performance tracing.
    tracesSampleRate: 0,
  });
}
