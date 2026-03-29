/**
 * App Configuration
 *
 * Central place for environment-specific settings.
 * Supports either explicit base URLs or local LAN fallback.
 */

import * as Device from 'expo-device';
import { Platform } from 'react-native';

const readEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const API_BASE_OVERRIDE = readEnv(process.env.EXPO_PUBLIC_API_BASE_URL);
const SOCKET_BASE_OVERRIDE = readEnv(process.env.EXPO_PUBLIC_SOCKET_URL);

// Production backend — used as default when env vars aren't set (OTA updates, etc.)
const PROD_SOCKET_URL = 'https://frequen-c-backend-production.up.railway.app';
const PROD_API_URL = `${PROD_SOCKET_URL}/api`;

// Local dev fallback (only used when EXPO_PUBLIC_LOCAL_IP is explicitly set)
const LOCAL_IP = readEnv(process.env.EXPO_PUBLIC_LOCAL_IP);
const API_PORT = readEnv(process.env.EXPO_PUBLIC_API_PORT) || '5000';
const IS_ANDROID_EMULATOR = Platform.OS === 'android' && !Device.isDevice;
const LOCAL_HOST = IS_ANDROID_EMULATOR ? '10.0.2.2' : LOCAL_IP;
const LOCAL_SOCKET_URL = LOCAL_IP ? `http://${LOCAL_HOST}:${API_PORT}` : undefined;
const LOCAL_API_URL = LOCAL_SOCKET_URL ? `${LOCAL_SOCKET_URL}/api` : undefined;
const BYPASS_AUTH = (process.env.EXPO_PUBLIC_BYPASS_AUTH || 'false') === 'true';
const USE_REAL_AI = (process.env.EXPO_PUBLIC_USE_REAL_AI || 'false') === 'true';

// true  -> fake responses, no backend needed
// false -> real API calls to the configured backend
export const USE_MOCKS =
  (process.env.EXPO_PUBLIC_USE_MOCKS || 'false') === 'true' || BYPASS_AUTH;

// Allows AI features to call backend endpoints even while the rest of the app is mocked.
export const AI_USE_REAL_BACKEND = USE_REAL_AI;

// Backend base URLs: env override > local dev (if configured) > production
export const API_BASE_URL = API_BASE_OVERRIDE || LOCAL_API_URL || PROD_API_URL;
export const SOCKET_URL = SOCKET_BASE_OVERRIDE || LOCAL_SOCKET_URL || PROD_SOCKET_URL;

// Startup diagnostics — visible in Expo logs to catch env misconfigurations
console.log('[Config]', {
  USE_MOCKS,
  BYPASS_AUTH,
  API_BASE_URL,
  SOCKET_URL,
  raw_USE_MOCKS: process.env.EXPO_PUBLIC_USE_MOCKS,
  raw_BYPASS_AUTH: process.env.EXPO_PUBLIC_BYPASS_AUTH,
});
