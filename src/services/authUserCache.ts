/**
 * Last-good-user cache.
 *
 * Lets a cold start that hits a transient backend failure (timeout, Railway
 * cold start) keep the user signed in on their last known profile instead of
 * bouncing them to the login screen. Profile data only: the JWT stays in
 * SecureStore (fetchClient) and provider tokens are stripped before anything
 * is written to AsyncStorage.
 *
 * Every helper is best effort and never throws. Losing the cache only costs
 * the offline fallback.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConnectedServices, User } from '../types';

const USER_CACHE_KEY = 'frequenc_auth_user_v1';

/**
 * The ServiceConnection type allows provider access and refresh tokens. The
 * backend does not send them today, but plain AsyncStorage must never hold
 * them, so only the non-secret connection fields are kept.
 */
function stripServiceSecrets(services: ConnectedServices | undefined): ConnectedServices {
  const safe: ConnectedServices = {};
  if (!services) return safe;
  for (const key of Object.keys(services) as (keyof ConnectedServices)[]) {
    const connection = services[key];
    if (!connection) continue;
    safe[key] = {
      connected: connection.connected,
      username: connection.username,
      expiresAt: connection.expiresAt,
    };
  }
  return safe;
}

/** The copy of the user that is safe to persist. Other fields pass through untouched. */
export function toCacheableUser(user: User): User {
  return { ...user, connectedServices: stripServiceSecrets(user.connectedServices) };
}

/** Parse a stored cache entry; anything that is not a user-shaped object is treated as no cache. */
export function parseCachedUser(raw: string | null): User | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const candidate = parsed as Partial<User>;
    if (typeof candidate.id !== 'string' || candidate.id.length === 0) return null;
    if (typeof candidate.username !== 'string' || candidate.username.length === 0) return null;
    return { ...(candidate as User), connectedServices: candidate.connectedServices ?? {} };
  } catch {
    return null;
  }
}

export async function readCachedUser(): Promise<User | null> {
  try {
    return parseCachedUser(await AsyncStorage.getItem(USER_CACHE_KEY));
  } catch {
    return null;
  }
}

export async function writeCachedUser(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(toCacheableUser(user)));
  } catch {
    // Best effort; see the module comment.
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(USER_CACHE_KEY);
  } catch {
    // Best effort; see the module comment.
  }
}
