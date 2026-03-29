/**
 * Standalone HTTP fetch client — no circular deps.
 *
 * Both api.ts and the service adapters import from here
 * instead of cross-importing each other.
 */

import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

// ─── Token helpers ──────────────────────────────────────────
// All SecureStore calls are wrapped in try/catch so they degrade
// gracefully on web (where the native module is unavailable).
// On web, falls back to localStorage for dev/testing.

const TOKEN_KEY = 'frequenc_auth_token';

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // SecureStore unavailable (web, test) — try localStorage
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null; } catch { return null; }
  }
}

export async function storeToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // SecureStore unavailable — try localStorage fallback
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token); } catch { /* non-fatal */ }
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY); } catch { /* non-fatal */ }
  }
}

// ─── Error Class ────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// ─── Fetch Wrapper ──────────────────────────────────────────

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

/** Default request timeout in ms — prevents infinite Loading on network failures */
const DEFAULT_TIMEOUT_MS = 10_000;

export async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { skipAuth = false, headers: customHeaders, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (!skipAuth) {
    const token = await getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  // AbortController timeout — prevents infinite hang when backend is unreachable
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        0,
        `Request timed out to ${API_BASE_URL} — check backend + EXPO_PUBLIC_LOCAL_IP/EXPO_PUBLIC_API_PORT`
      );
    }
    throw new ApiError(
      0,
      `Network error reaching ${API_BASE_URL} — check backend + EXPO_PUBLIC_LOCAL_IP/EXPO_PUBLIC_API_PORT`
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new ApiError(response.status, errorBody.message || response.statusText, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json().catch(() => ({}));

  // Unwrap standard Frequen-C backend success responses: { status: 'success', data: { ... } }
  if (json && json.status === 'success') {
    return (json.data !== undefined ? json.data : json) as T;
  }

  return json as T;
}
