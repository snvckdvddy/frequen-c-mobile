/**
 * Standalone HTTP fetch client — no circular deps.
 *
 * Both api.ts and the service adapters import from here
 * instead of cross-importing each other.
 */

import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './config';

// ─── Token helpers ──────────────────────────────────────────

const TOKEN_KEY = 'frequenc_auth_token';

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
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
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out — is the backend running?');
    }
    throw new ApiError(0, `Network error — could not reach server`);
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

  return response.json();
}
