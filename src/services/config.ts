/**
 * App Configuration
 *
 * Central place for environment-specific settings.
 * Supports either explicit base URLs or local LAN fallback.
 */

const readEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const API_BASE_OVERRIDE = readEnv(process.env.EXPO_PUBLIC_API_BASE_URL);
const SOCKET_BASE_OVERRIDE = readEnv(process.env.EXPO_PUBLIC_SOCKET_URL);

const LOCAL_IP = readEnv(process.env.EXPO_PUBLIC_LOCAL_IP) || '192.168.1.3';
const API_PORT = readEnv(process.env.EXPO_PUBLIC_API_PORT) || '5000';
const LOCAL_SOCKET_URL = `http://${LOCAL_IP}:${API_PORT}`;
const LOCAL_API_URL = `${LOCAL_SOCKET_URL}/api`;
const BYPASS_AUTH = (process.env.EXPO_PUBLIC_BYPASS_AUTH || 'false') === 'true';
const USE_REAL_AI = (process.env.EXPO_PUBLIC_USE_REAL_AI || 'false') === 'true';

// true  -> fake responses, no backend needed
// false -> real API calls to the configured backend
export const USE_MOCKS =
  (process.env.EXPO_PUBLIC_USE_MOCKS || 'false') === 'true' || BYPASS_AUTH;

// Allows AI features to call backend endpoints even while the rest of the app is mocked.
export const AI_USE_REAL_BACKEND = USE_REAL_AI;

// Backend base URLs
export const API_BASE_URL = API_BASE_OVERRIDE || LOCAL_API_URL;
export const SOCKET_URL = SOCKET_BASE_OVERRIDE || LOCAL_SOCKET_URL;
