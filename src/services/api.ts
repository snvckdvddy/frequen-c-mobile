/**
 * API Client
 *
 * Connects to the existing Frequen-C Node/Express backend.
 * Toggle USE_MOCKS in config.ts for offline development.
 */

import { mockUser, mockSessions, mockQueue, mockSearchResults, mockUsers, mockDelay } from './mockData';
import { User, Session, Track, MockUser, ConnectedServices } from '../types';
import { USE_MOCKS, AI_USE_REAL_BACKEND } from './config';
import { logger } from '../utils/logger';

// Re-export from fetchClient so existing consumers don't break
export { apiFetch, getStoredToken, storeToken, clearToken, ApiError } from './fetchClient';
import { apiFetch, storeToken, clearToken, ApiError } from './fetchClient';

// Storage for active services config
export let currentServices: ConnectedServices | undefined;

export function setCurrentServices(services?: ConnectedServices) {
  currentServices = services;
  // Stale — the old snapshot references an auth surface that no longer
  // matches currentServices. Next search will repopulate.
  clearLastSearchDiagnosticsSnapshot();
}

export type SearchHudProvider = 'spotify' | 'soundcloud' | 'tidal' | 'appleMusic';

const SEARCH_PROVIDER_ENDPOINTS: Record<SearchHudProvider, string> = {
  spotify: '/search/tracks',
  soundcloud: '/auth/soundcloud/search',
  tidal: '/auth/tidal/search',
  appleMusic: '/search/apple-music',
};

export type SearchProviderState = 'direct' | 'empty' | 'error' | 'off' | 'unpatched';

export interface SearchConnectionSnapshot {
  connected: boolean;
  username?: string;
}

export interface SearchProviderDiagnostic {
  source: SearchHudProvider;
  requested: boolean;
  connected: boolean;
  endpoint: string;
  httpStatus: number | null;
  upstreamStatus: number | null;
  resultCount: number;
  state: SearchProviderState;
  code:
    | 'NOT_REQUESTED'
    | 'NOT_CONNECTED'
    | 'DIRECT_RESULTS'
    | 'NO_RESULTS'
    | 'TOKEN_EXPIRED'
    | 'APP_SUBSCRIPTION_REQUIRED'
    | 'UPSTREAM_AUTH_ERROR'
    | 'ENDPOINT_AUTH_ERROR'
    | 'UPSTREAM_ERROR'
    | 'NETWORK_ERROR'
    | 'BACKEND_CONFIG_MISSING';
  message?: string;
}

export interface SearchDiagnostics {
  query: string;
  requestedSources: SearchHudProvider[];
  authSnapshot: Record<SearchHudProvider, SearchConnectionSnapshot>;
  providers: Record<SearchHudProvider, SearchProviderDiagnostic>;
  directMatchCount: number;
  openFallbackCount: number;
  fallbackUsed: boolean;
}

export interface SearchTracksResponse {
  tracks: Track[];
  fallbackUsed: boolean;
  providerStates: Record<SearchHudProvider, SearchProviderState>;
  diagnostics: SearchDiagnostics;
}

// ─── Last Search Diagnostics Snapshot ─────────────────────────
// Captured after every search run (via logSearchTruth) so the diagnostic
// bundle copy flow on ProfileScreen can include live runtime search state
// without plumbing props through context. Cleared when currentServices is
// swapped (login/logout/service change) because the old snapshot would
// reference a stale auth surface. Read via getLastSearchDiagnosticsSnapshot.

export interface LastSearchDiagnosticsSnapshot {
  diagnostics: SearchDiagnostics;
  capturedAt: number;
}

let lastSearchDiagnosticsSnapshot: LastSearchDiagnosticsSnapshot | undefined;

export function getLastSearchDiagnosticsSnapshot(): LastSearchDiagnosticsSnapshot | undefined {
  return lastSearchDiagnosticsSnapshot;
}

function captureSearchDiagnosticsSnapshot(diagnostics: SearchDiagnostics): void {
  lastSearchDiagnosticsSnapshot = {
    diagnostics,
    capturedAt: Date.now(),
  };
}

function clearLastSearchDiagnosticsSnapshot(): void {
  lastSearchDiagnosticsSnapshot = undefined;
}

function getSearchConnectionSnapshot(): Record<SearchHudProvider, SearchConnectionSnapshot> {
  return {
    spotify: {
      connected: !!currentServices?.spotify?.connected,
      username: currentServices?.spotify?.username,
    },
    soundcloud: {
      connected: !!currentServices?.soundcloud?.connected,
      username: currentServices?.soundcloud?.username,
    },
    tidal: {
      connected: !!currentServices?.tidal?.connected,
      username: currentServices?.tidal?.username,
    },
    appleMusic: {
      // Catalog search is always available (public iTunes API).
      // Library access (playlists, liked songs) requires MusicKit auth — checked separately.
      connected: true,
      username: undefined,
    },
  };
}

function createSearchProviderDiagnostic(
  source: SearchHudProvider,
  connected: boolean,
  requested: boolean,
): SearchProviderDiagnostic {
  return {
    source,
    requested,
    connected,
    endpoint: SEARCH_PROVIDER_ENDPOINTS[source],
    httpStatus: null,
    upstreamStatus: null,
    resultCount: 0,
    state: connected ? (requested ? 'empty' : 'off') : 'unpatched',
    code: connected ? (requested ? 'NO_RESULTS' : 'NOT_REQUESTED') : 'NOT_CONNECTED',
  };
}

function getProviderStatesFromDiagnostics(
  diagnostics: Record<SearchHudProvider, SearchProviderDiagnostic>,
): Record<SearchHudProvider, SearchProviderState> {
  return {
    spotify: diagnostics.spotify.state,
    soundcloud: diagnostics.soundcloud.state,
    tidal: diagnostics.tidal.state,
    appleMusic: diagnostics.appleMusic.state,
  };
}

function getApiErrorBodyRecord(error: unknown): Record<string, unknown> | undefined {
  if (!(error instanceof ApiError) || !error.body || typeof error.body !== 'object') {
    return undefined;
  }

  return error.body as Record<string, unknown>;
}

export function classifyProviderSearchFailure(
  source: SearchHudProvider,
  connected: boolean,
  error: unknown,
): SearchProviderDiagnostic {
  const base = createSearchProviderDiagnostic(source, connected, true);
  const body = getApiErrorBodyRecord(error);
  const debugCode = typeof body?.debugCode === 'string' ? body.debugCode : undefined;
  const upstreamStatus = typeof body?.upstreamStatus === 'number' ? body.upstreamStatus : null;
  const message =
    typeof body?.message === 'string'
      ? body.message
      : error instanceof Error
        ? error.message
        : 'Provider search failed';

  if (!connected || debugCode === 'NOT_CONNECTED') {
    return {
      ...base,
      httpStatus: error instanceof ApiError ? error.status : null,
      upstreamStatus,
      state: 'unpatched',
      code: 'NOT_CONNECTED',
      message,
    };
  }

  if (debugCode === 'TOKEN_EXPIRED') {
    return {
      ...base,
      httpStatus: error instanceof ApiError ? error.status : null,
      upstreamStatus,
      state: 'error',
      code: 'TOKEN_EXPIRED',
      message,
    };
  }

  if (debugCode === 'APP_SUBSCRIPTION_REQUIRED') {
    return {
      ...base,
      httpStatus: error instanceof ApiError ? error.status : null,
      upstreamStatus,
      state: 'error',
      code: 'APP_SUBSCRIPTION_REQUIRED',
      message,
    };
  }

  if (debugCode === 'UPSTREAM_AUTH_ERROR') {
    return {
      ...base,
      httpStatus: error instanceof ApiError ? error.status : null,
      upstreamStatus,
      state: 'error',
      code: 'UPSTREAM_AUTH_ERROR',
      message,
    };
  }

  if (debugCode === 'BACKEND_CONFIG_MISSING') {
    return {
      ...base,
      httpStatus: error instanceof ApiError ? error.status : null,
      upstreamStatus,
      state: 'error',
      code: 'BACKEND_CONFIG_MISSING',
      message,
    };
  }

  if (error instanceof ApiError && error.status === 0) {
    return {
      ...base,
      httpStatus: 0,
      upstreamStatus,
      state: 'error',
      code: 'NETWORK_ERROR',
      message,
    };
  }

  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return {
      ...base,
      httpStatus: error.status,
      upstreamStatus,
      state: 'error',
      code: 'ENDPOINT_AUTH_ERROR',
      message,
    };
  }

  return {
    ...base,
    httpStatus: error instanceof ApiError ? error.status : null,
    upstreamStatus,
    state: 'error',
    code: 'UPSTREAM_ERROR',
    message,
  };
}

function createSearchDiagnostics(
  query: string,
  requestedSources: SearchHudProvider[],
): SearchDiagnostics {
  const authSnapshot = getSearchConnectionSnapshot();

  return {
    query,
    requestedSources,
    authSnapshot,
    providers: {
      spotify: createSearchProviderDiagnostic('spotify', authSnapshot.spotify.connected, requestedSources.includes('spotify')),
      soundcloud: createSearchProviderDiagnostic('soundcloud', authSnapshot.soundcloud.connected, requestedSources.includes('soundcloud')),
      tidal: createSearchProviderDiagnostic('tidal', authSnapshot.tidal.connected, requestedSources.includes('tidal')),
      appleMusic: createSearchProviderDiagnostic('appleMusic', authSnapshot.appleMusic.connected, requestedSources.includes('appleMusic')),
    },
    directMatchCount: 0,
    openFallbackCount: 0,
    fallbackUsed: false,
  };
}

export function getIdleSearchDiagnostics(): SearchDiagnostics {
  return createSearchDiagnostics('', []);
}

function logSearchTruth(scope: string, diagnostics: SearchDiagnostics) {
  // Capture the snapshot in both dev and production — the diagnostic bundle
  // copy flow (ProfileScreen > CONFIG BUS > COPY DIAGNOSTICS) reads this to
  // include runtime search state in the paste-able bundle. Called from every
  // searchApi.tracks return path, so any completed search refreshes it.
  captureSearchDiagnosticsSnapshot(diagnostics);

  const isDevRuntime = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  if (!isDevRuntime) return;

  const compactProviders = (Object.entries(diagnostics.providers) as Array<[SearchHudProvider, SearchProviderDiagnostic]>)
    .reduce<Record<SearchHudProvider, Record<string, unknown>>>((acc, [source, diagnostic]) => {
      acc[source] = {
        connected: diagnostic.connected,
        requested: diagnostic.requested,
        state: diagnostic.state,
        code: diagnostic.code,
        httpStatus: diagnostic.httpStatus,
        upstreamStatus: diagnostic.upstreamStatus,
        resultCount: diagnostic.resultCount,
        message: diagnostic.message,
      };
      return acc;
    }, {
      spotify: {},
      soundcloud: {},
      tidal: {},
      appleMusic: {},
    } as Record<SearchHudProvider, Record<string, unknown>>);

  logger.debug('api', `SearchTruth[${scope}]`, {
    query: diagnostics.query,
    requestedSources: diagnostics.requestedSources,
    authSnapshot: diagnostics.authSnapshot,
    providers: compactProviders,
    directMatchCount: diagnostics.directMatchCount,
    openFallbackCount: diagnostics.openFallbackCount,
    fallbackUsed: diagnostics.fallbackUsed,
  });
}

export function getIdleSearchProviderStates(): Record<SearchHudProvider, SearchProviderState> {
  const snapshot = getSearchConnectionSnapshot();
  return {
    spotify: snapshot.spotify.connected ? 'off' : 'unpatched',
    soundcloud: snapshot.soundcloud.connected ? 'off' : 'unpatched',
    tidal: snapshot.tidal.connected ? 'off' : 'unpatched',
    appleMusic: 'off', // Always available — no auth needed
  };
}

export type DisconnectableProvider = 'spotify' | 'soundcloud' | 'tidal' | 'lastfm' | 'appleMusic';

export interface ProviderConfigStatus {
  backendConfigured: boolean;
  missing: string[];
  reason?: string;
}

export type ProviderStatusMap = Record<DisconnectableProvider, ProviderConfigStatus>;


// ─── Auth Endpoints ─────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      if (!email || !password) throw new ApiError(400, 'Email and password required');
      const token = 'mock_jwt_' + Date.now();
      return { token, user: { ...mockUser, email } };
    }
    return apiFetch<{ token: string; user: import('../types').User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
  },

  /** Authenticate via Apple Sign In identity token (creates or links account). */
  apple: async (identityToken: string, user?: string, fullName?: string, email?: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      const token = 'mock_jwt_apple_' + Date.now();
      return { token, user: { ...mockUser, email: email || mockUser.email }, isNewUser: true };
    }
    return apiFetch<{ token: string; user: User; isNewUser: boolean }>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, user, fullName, email }),
      skipAuth: true,
    });
  },

  /** Authenticate via Google Sign In ID token (creates or links account). */
  google: async (idToken: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      const token = 'mock_jwt_google_' + Date.now();
      return { token, user: mockUser, isNewUser: true };
    }
    return apiFetch<{ token: string; user: User; isNewUser: boolean }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
      skipAuth: true,
    });
  },

  /** Set a password on a social-only account (no existing password). */
  setPassword: async (password: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { message: 'Password set (mock)' };
    }
    return apiFetch<{ message: string }>('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  register: async (username: string, email: string, password: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      if (!username || !email || !password) throw new ApiError(400, 'All fields required');
      const token = 'mock_jwt_' + Date.now();
      return { token, user: { ...mockUser, username, email, id: 'usr_new_' + Date.now() } };
    }
    return apiFetch<{ token: string; user: import('../types').User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
      skipAuth: true,
    });
  },

  me: async () => {
    if (USE_MOCKS) {
      await mockDelay(100, 300);
      return { user: mockUser };
    }
    return apiFetch<{ user: import('../types').User }>('/auth/me');
  },

  providerStatus: async (): Promise<{ providers: ProviderStatusMap }> => {
    if (USE_MOCKS) {
      return {
        providers: {
          spotify: { backendConfigured: true, missing: [] },
          soundcloud: { backendConfigured: true, missing: [] },
          tidal: { backendConfigured: true, missing: [] },
          lastfm: { backendConfigured: true, missing: [] },
          appleMusic: { backendConfigured: true, missing: [] },
        },
      };
    }
    return apiFetch<{ providers: ProviderStatusMap }>('/auth/provider-status');
  },

  connectSpotify: async (code: string, codeVerifier: string, redirectUri: string) => {
    if (USE_MOCKS) {
      await mockDelay(100, 300);
      return { message: 'Spotify mocked', user: mockUser };
    }
    return apiFetch<{ message: string; user: import('../types').User }>('/auth/spotify/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, codeVerifier, redirectUri }),
    });
  },

  connectTidal: async (code: string, codeVerifier: string, redirectUri: string) => {
    if (USE_MOCKS) {
      await mockDelay(100, 300);
      return { message: 'Tidal mocked' };
    }
    return apiFetch<{ message: string; user: import('../types').User }>('/auth/tidal/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, codeVerifier, redirectUri }),
    });
  },

  connectLastfm: async (token: string) => {
    if (USE_MOCKS) {
      await mockDelay(100, 300);
      return { message: 'Last.fm mocked', user: mockUser };
    }
    return apiFetch<{ message: string; user: import('../types').User }>('/auth/lastfm/exchange', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  /** Store the user's MusicKit Music User Token after authorization. */
  connectAppleMusic: async (musicUserToken: string) => {
    if (USE_MOCKS) {
      await mockDelay(100, 300);
      return { message: 'Apple Music connected (mock)' };
    }
    return apiFetch<{ message: string }>('/auth/apple-music/connect', {
      method: 'POST',
      body: JSON.stringify({ musicUserToken }),
    });
  },

  disconnectService: async (provider: DisconnectableProvider) => {
    if (USE_MOCKS) {
      await mockDelay(100, 300);
      return { message: `${provider} disconnected (mock)` };
    }
    return apiFetch<{ message: string }>(`/services/${provider}`, {
      method: 'DELETE',
    });
  },

  /** Refresh the JWT before it expires (returns a fresh token). */
  refresh: async () => {
    if (USE_MOCKS) {
      await mockDelay(50, 150);
      const token = 'mock_jwt_refreshed_' + Date.now();
      return { token };
    }
    return apiFetch<{ token: string }>('/auth/refresh', { method: 'POST' });
  },

  /** Permanently delete the current user's account and all data. */
  deleteAccount: async () => {
    if (USE_MOCKS) {
      await mockDelay(200, 400);
      await clearToken();
      return { message: 'Account deleted (mock)' };
    }
    const result = await apiFetch<{ message: string }>('/auth/account', { method: 'DELETE' });
    await clearToken();
    return result;
  },

  logout: async () => {
    await clearToken();
  },

  /** Register push notification token with the backend */
  registerPushToken: async (pushToken: string) => {
    if (USE_MOCKS) {
      logger.debug('api', 'Mock: Push token registered', pushToken.slice(0, 30) + '...');
      return { message: 'Push token saved' };
    }
    return apiFetch<{ message: string }>('/auth/push-token', {
      method: 'POST',
      body: JSON.stringify({ token: pushToken }),
    });
  },

  /** Get user's noise gate preference */
  getNoiseGate: async () => {
    if (USE_MOCKS) {
      return { noiseGate: 'medium' as const };
    }
    return apiFetch<{ noiseGate: 'off' | 'low' | 'medium' | 'high' }>('/auth/noise-gate');
  },

  /** Update user's noise gate preference */
  setNoiseGate: async (noiseGate: 'off' | 'low' | 'medium' | 'high') => {
    if (USE_MOCKS) {
      return { noiseGate };
    }
    return apiFetch<{ noiseGate: string }>('/auth/noise-gate', {
      method: 'PUT',
      body: JSON.stringify({ value: noiseGate }),
    });
  },

  /** Bulk update user preferences */
  setPreferences: async (prefs: {
    noiseGate?: 'off' | 'low' | 'medium' | 'high';
    socialBattery?: 'low' | 'unity' | 'hot';
    walkOnTransient?: string;
    isIncognito?: boolean;
  }) => {
    if (USE_MOCKS) {
      return { success: true };
    }
    return apiFetch<{ user: User }>('/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    });
  },
};

// ─── Mock Session Store ──────────────────────────────────────
// Persists sessions created/joined during this mock session so
// get() can find them and myRooms() can list them.

const mockSessionStore: Map<string, import('../types').Session> = new Map();
// Track which sessions the current user has created or joined
const myRoomIds: Set<string> = new Set();

const LOCAL_PROVIDER_SEED_TRACKS: import('../types').Track[] = [
  { id: 'seed_spotify_frank_white_ferrari', title: 'White Ferrari', artist: 'Frank Ocean', duration: 248, source: 'spotify' },
  { id: 'seed_spotify_frank_pink_white', title: 'Pink + White', artist: 'Frank Ocean', duration: 184, source: 'spotify' },
  { id: 'seed_spotify_frank_thinkin_bout_you', title: 'Thinkin Bout You', artist: 'Frank Ocean', duration: 201, source: 'spotify' },
  { id: 'seed_spotify_frank_godspeed', title: 'Godspeed', artist: 'Frank Ocean', duration: 177, source: 'spotify' },
  { id: 'seed_spotify_frank_seigfried', title: 'Seigfried', artist: 'Frank Ocean', duration: 335, source: 'spotify' },
  { id: 'seed_spotify_frank_ivy', title: 'Ivy', artist: 'Frank Ocean', duration: 249, source: 'spotify' },
  { id: 'seed_spotify_dominic_white_keys', title: 'White Keys', artist: 'Dominic Fike', duration: 132, source: 'spotify' },
  { id: 'seed_spotify_dominic_babydoll', title: 'Babydoll', artist: 'Dominic Fike', duration: 108, source: 'spotify' },
  { id: 'seed_spotify_dominic_3_nights', title: '3 Nights', artist: 'Dominic Fike', duration: 177, source: 'spotify' },
  { id: 'seed_spotify_dominic', title: 'Dominic', artist: 'Ramona Lisa', duration: 196, source: 'spotify' },
  { id: 'seed_soundcloud_strobe', title: 'Strobe', artist: 'deadmau5', duration: 637, source: 'soundcloud' },
  { id: 'seed_soundcloud_affection', title: 'Affection', artist: 'Jinsang', duration: 152, source: 'soundcloud' },
];

function mergeUniqueSessions(
  ...groups: import('../types').Session[][]
): import('../types').Session[] {
  const byId = new Map<string, import('../types').Session>();
  groups.flat().forEach((session) => {
    if (!byId.has(session.id)) {
      byId.set(session.id, session);
    }
  });
  return Array.from(byId.values());
}

// ─── Session Endpoints ──────────────────────────────────────

export const sessionApi = {
  create: async (data: { name: string; genre?: string; roomMode?: string; isPublic?: boolean; behaviors?: import('../types').RoomBehaviors }) => {
    if (USE_MOCKS) {
      await mockDelay();
      const { DEFAULT_BEHAVIORS, BEHAVIOR_PRESETS } = require('../types');
      const mode = (data.roomMode || 'campfire') as import('../types').RoomMode;
      const session: import('../types').Session = {
        id: 'ses_new_' + Date.now(),
        name: data.name,
        hostId: mockUser.id,
        hostUsername: mockUser.username,
        roomMode: mode,
        genre: data.genre || 'Mixed',
        isPublic: data.isPublic ?? true,
        isLive: true,
        joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        description: '',
        listeners: [],
        currentTrack: undefined,
        queue: [],
        createdAt: new Date().toISOString(),
        behaviors: data.behaviors || { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS[mode] },
      };
      // Persist in mock store so get() can find it later
      mockSessionStore.set(session.id, session);
      myRoomIds.add(session.id);
      return { session };
    }
    return apiFetch<{ session: import('../types').Session }>('/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get: async (sessionId: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      // 1. Check dynamic store first (user-created/joined sessions)
      const stored = mockSessionStore.get(sessionId);
      if (stored) {
        return { session: { ...stored } };
      }
      // 2. Fall back to static mock data
      const staticSession = mockSessions.find((s) => s.id === sessionId);
      if (staticSession) {
        return { session: { ...staticSession, queue: mockQueue } };
      }
      // 3. Not found — throw instead of silently returning wrong session
      throw new ApiError(404, 'Session not found');
    }
    return apiFetch<{ session: import('../types').Session }>(`/sessions/${sessionId}`);
  },

  list: async () => {
    if (USE_MOCKS) {
      await mockDelay();
      // Merge static + dynamic sessions
      const dynamic = Array.from(mockSessionStore.values());
      return { sessions: mergeUniqueSessions(dynamic, mockSessions) };
    }
    return apiFetch<{ sessions: import('../types').Session[] }>('/sessions');
  },

  join: async (joinCode: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      // Search static mock sessions
      let session = mockSessions.find(
        (s) => s.joinCode.toLowerCase() === joinCode.toLowerCase()
      );
      // Also search dynamic store (user-created rooms have join codes too)
      if (!session) {
        session = Array.from(mockSessionStore.values()).find(
          (s) => s.joinCode.toLowerCase() === joinCode.toLowerCase()
        );
      }
      if (!session) throw new ApiError(404, 'No room found with that code');
      // Persist in store + track as user's room
      mockSessionStore.set(session.id, { ...session, queue: [...(session.queue || [])] });
      myRoomIds.add(session.id);
      return { session };
    }
    return apiFetch<{ session: import('../types').Session }>('/sessions/join', {
      method: 'POST',
      body: JSON.stringify({ joinCode }),
    });
  },

  /** Get sessions the current user has created or joined */
  myRooms: async () => {
    if (USE_MOCKS) {
      await mockDelay(100, 300);
      const rooms: import('../types').Session[] = [];
      myRoomIds.forEach((id) => {
        const s = mockSessionStore.get(id) || mockSessions.find((ms) => ms.id === id);
        if (s) rooms.push(s);
      });
      return { sessions: rooms };
    }
    try {
      return await apiFetch<{ sessions: import('../types').Session[] }>('/sessions/mine');
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        return { sessions: [] };
      }
      throw error;
    }
  },

  discover: async () => {
    if (USE_MOCKS) {
      await mockDelay();
      // Include dynamic sessions in discover too
      const dynamic = Array.from(mockSessionStore.values()).filter((s) => s.isPublic);
      return { sessions: mergeUniqueSessions(dynamic, mockSessions) };
    }
    try {
      return await apiFetch<{ sessions: import('../types').Session[] }>('/sessions/discover');
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        const dynamic = Array.from(mockSessionStore.values()).filter((s) => s.isPublic);
        return { sessions: mergeUniqueSessions(dynamic, mockSessions) };
      }
      throw error;
    }
  },

  /** End a session (host only). Marks as not-live, clears queue + listeners. */
  endSession: async (sessionId: string) => {
    if (USE_MOCKS) {
      await mockDelay(50, 150);
      const s = mockSessionStore.get(sessionId);
      if (s) s.isLive = false;
      return { message: 'Session ended' };
    }
    return apiFetch<{ message: string }>(`/sessions/${sessionId}/end`, { method: 'POST' });
  },

  /**
   * Mock-only local state sync so session state survives leave/re-enter
   * during mobile UI testing without a backend source of truth.
   */
  syncLocalSession: async (
    sessionId: string,
    patch: Partial<import('../types').Session>
  ) => {
    if (!USE_MOCKS) return;
    const existing = mockSessionStore.get(sessionId) || mockSessions.find((s) => s.id === sessionId);
    if (!existing) return;
    const merged: import('../types').Session = {
      ...existing,
      ...patch,
      queue: patch.queue ? [...patch.queue] : [...(existing.queue || [])],
    };
    mockSessionStore.set(sessionId, merged);
    myRoomIds.add(sessionId);
  },
};

// ─── Search Endpoints ───────────────────────────────────────

function normalizeAvailabilityToken(value?: string) {
  return (value || '')
    .toLowerCase()
    .replace(/\((feat|ft)\.[^)]+\)/g, '')
    .replace(/\[(feat|ft)\.[^\]]+\]/g, '')
    .replace(/\b(feat|ft)\.?\s+.+$/g, '')
    .replace(/\bfrom\s+["'][^"']+["']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function squeezeAvailabilityToken(value?: string) {
  return normalizeAvailabilityToken(value).replace(/\s+/g, '');
}

function availabilityTitleTokenSet(value?: string) {
  return normalizeAvailabilityToken(value)
    .split(' ')
    .filter((token) => token.length > 1)
    .filter((token) => !['live', 'demo', 'edit', 'mix', 'version', 'acoustic', 'instrumental'].includes(token));
}

function normalizePrimaryArtist(value?: string) {
  const normalized = normalizeAvailabilityToken(value)
    .replace(/\b(with|and)\b/g, ',')
    .replace(/\s+x\s+/g, ',')
    .replace(/\s*&\s*/g, ',')
    .replace(/\s*\/\s*/g, ',');
  return normalized.split(',')[0]?.trim() || normalized;
}

function availabilityTitleMatches(a: string, b: string) {
  const left = squeezeAvailabilityToken(a);
  const right = squeezeAvailabilityToken(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) {
    return true;
  }

  const leftTokens = availabilityTitleTokenSet(a);
  const rightTokens = availabilityTitleTokenSet(b);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const sharedTokens = leftTokens.filter((token) => rightTokens.includes(token));
  const minTokenCount = Math.min(leftTokens.length, rightTokens.length);
  return sharedTokens.length >= Math.max(2, minTokenCount);
}

function availabilityArtistMatches(a: string, b: string) {
  const left = squeezeAvailabilityToken(normalizePrimaryArtist(a));
  const right = squeezeAvailabilityToken(normalizePrimaryArtist(b));
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function tracksShareAvailabilityIdentity(
  left: { title: string; artist: string },
  right: { title: string; artist: string },
) {
  return availabilityTitleMatches(left.title, right.title) &&
    availabilityArtistMatches(left.artist, right.artist);
}

function buildAvailabilityKey(track: { title: string; artist: string }) {
  return `${squeezeAvailabilityToken(track.title)}::${squeezeAvailabilityToken(normalizePrimaryArtist(track.artist))}`;
}

function mergeAvailabilityTracks(tracks: import('../types').Track[]) {
  const grouped = new Map<string, import('../types').Track>();

  for (const track of tracks) {
    const matchedKey = Array.from(grouped.entries()).find(([, existing]) =>
      tracksShareAvailabilityIdentity(existing, track),
    )?.[0] || buildAvailabilityKey(track);
    const existing = grouped.get(matchedKey);

    if (!existing) {
      grouped.set(matchedKey, { ...track, availableSources: [track.source] });
      continue;
    }

    const nextSources = Array.from(
      new Set([...(existing.availableSources || [existing.source]), track.source]),
    ) as import('../types').Track['availableSources'];
    const preferredTrack =
      existing.source === 'spotify'
        ? existing
        : track.source === 'spotify'
          ? track
          : existing;

    grouped.set(matchedKey, {
      ...preferredTrack,
      availableSources: nextSources,
    });
  }

  return Array.from(grouped.values());
}

function enrichOpenCatalogTracks(
  fallbackTracks: import('../types').Track[],
) {
  return fallbackTracks.map((track) => ({
    ...track,
    resultOrigin: 'open' as const,
    availableSources: undefined,
  }));
}

async function queryProviderTracks(
  query: string,
  requestedSources: SearchHudProvider[],
  options?: { silent?: boolean },
) {
  const diagnostics = createSearchDiagnostics(query, requestedSources);
  if (requestedSources.length === 0) {
    return {
      tracks: [] as import('../types').Track[],
      diagnostics,
    };
  }

  const deduped = new Map<string, import('../types').Track>();
  const [{ spotifyAdapter }, { soundcloudAdapter }, { tidalAdapter }, { appleMusicAdapter }] = await Promise.all([
    import('./adapters/spotifyAdapter'),
    import('./adapters/soundcloudAdapter'),
    import('./adapters/tidalAdapter'),
    import('./adapters/appleMusicAdapter'),
  ]);

  const spotifyConnected = diagnostics.authSnapshot.spotify.connected;
  const soundcloudConnected = diagnostics.authSnapshot.soundcloud.connected;
  const tidalConnected = diagnostics.authSnapshot.tidal.connected;

  spotifyAdapter.setConnected(spotifyConnected);
  soundcloudAdapter.setConnected(soundcloudConnected);
  tidalAdapter.setConnected(tidalConnected);
  // Apple Music is always connected (iTunes Search API is public)

  const searches: Array<{ source: SearchHudProvider; promise: Promise<import('../types').Track[]> }> = [];

  if (requestedSources.includes('spotify')) {
    if (!spotifyConnected) {
      diagnostics.providers.spotify = {
        ...diagnostics.providers.spotify,
        state: 'unpatched',
        code: 'NOT_CONNECTED',
        message: 'Spotify is not connected in the current auth snapshot.',
      };
    } else {
      searches.push({
        source: 'spotify',
        promise: spotifyAdapter.search(query, { ...options, rethrow: true }),
      });
    }
  }

  if (requestedSources.includes('soundcloud')) {
    if (!soundcloudConnected) {
      diagnostics.providers.soundcloud = {
        ...diagnostics.providers.soundcloud,
        state: 'unpatched',
        code: 'NOT_CONNECTED',
        message: 'SoundCloud is not connected in the current auth snapshot.',
      };
    } else {
      searches.push({
        source: 'soundcloud',
        promise: soundcloudAdapter.search(query, { ...options, rethrow: true }),
      });
    }
  }

  if (requestedSources.includes('tidal')) {
    if (!tidalConnected) {
      diagnostics.providers.tidal = {
        ...diagnostics.providers.tidal,
        state: 'unpatched',
        code: 'NOT_CONNECTED',
        message: 'Tidal is not connected in the current auth snapshot.',
      };
    } else {
      searches.push({
        source: 'tidal',
        promise: tidalAdapter.search(query, { ...options, rethrow: true }),
      });
    }
  }

  if (requestedSources.includes('appleMusic')) {
    // Apple Music is always available — no auth check needed
    searches.push({
      source: 'appleMusic',
      promise: appleMusicAdapter.search(query, { ...options, rethrow: true }),
    });
  }

  const settled = await Promise.allSettled(searches.map((entry) => entry.promise));
  settled.forEach((entry, index) => {
    const source = searches[index]?.source;
    if (!source) return;

    if (entry.status !== 'fulfilled') {
      diagnostics.providers[source] = classifyProviderSearchFailure(
        source,
        diagnostics.authSnapshot[source].connected,
        entry.reason,
      );
      return;
    }

    diagnostics.providers[source] = {
      ...diagnostics.providers[source],
      httpStatus: 200,
      upstreamStatus: 200,
      resultCount: entry.value.length,
      state: entry.value.length > 0 ? 'direct' : 'empty',
      code: entry.value.length > 0 ? 'DIRECT_RESULTS' : 'NO_RESULTS',
      message: entry.value.length > 0 ? `${entry.value.length} direct matches returned.` : 'Provider returned zero direct matches.',
    };

    for (const track of entry.value) {
      const key = `${track.source}:${track.sourceId || track.id}`;
      if (!deduped.has(key)) {
        deduped.set(key, track);
      }
    }
  });

  return { tracks: Array.from(deduped.values()), diagnostics };
}

function searchEmergencyCatalog(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [] as import('../types').Track[];

  const localCatalog = [
    ...mockSearchResults,
    ...mockQueue,
    ...mockSessions.flatMap((session) => [
      ...(session.currentTrack ? [session.currentTrack] : []),
      ...(session.queue || []),
    ]),
    ...LOCAL_PROVIDER_SEED_TRACKS,
  ] as import('../types').Track[];

  return localCatalog
    .filter((track: Track) =>
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q),
    )
    .map((track: import('../types').Track) => ({
      ...track,
      source: 'itunes' as const,
      availableSources: undefined,
      resultOrigin: 'open' as const,
    }));
}

export const searchApi = {
  tracks: async (query: string, sources?: SearchHudProvider[]): Promise<SearchTracksResponse> => {
    const requestedSources = Array.from(new Set(sources || []));

    if (USE_MOCKS) {
      await mockDelay(200, 500);
      const filtered = mockSearchResults.filter((t: Track) => {
        const queryMatch =
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.artist.toLowerCase().includes(query.toLowerCase());
        const sourceMatch =
          requestedSources.length === 0 || (requestedSources as string[]).includes(t.source);
        return queryMatch && sourceMatch;
      });
      const merged = requestedSources.length > 0
        ? mergeAvailabilityTracks(filtered as import('../types').Track[]).map((track) => ({
            ...track,
            resultOrigin: 'direct' as const,
          }))
        : filtered.map((track) => ({ ...track, resultOrigin: 'direct' as const }));
      const diagnostics = createSearchDiagnostics(query, requestedSources);
      diagnostics.providers.spotify = {
        ...diagnostics.providers.spotify,
        httpStatus: requestedSources.includes('spotify') ? 200 : null,
        upstreamStatus: requestedSources.includes('spotify') ? 200 : null,
        resultCount: merged.filter((track) => track.availableSources?.includes('spotify') || track.source === 'spotify').length,
        state: requestedSources.includes('spotify')
          ? (merged.some((track) => track.availableSources?.includes('spotify') || track.source === 'spotify') ? 'direct' : 'empty')
          : diagnostics.providers.spotify.state,
        code: requestedSources.includes('spotify')
          ? (merged.some((track) => track.availableSources?.includes('spotify') || track.source === 'spotify') ? 'DIRECT_RESULTS' : 'NO_RESULTS')
          : diagnostics.providers.spotify.code,
      };
      diagnostics.providers.soundcloud = {
        ...diagnostics.providers.soundcloud,
        httpStatus: requestedSources.includes('soundcloud') ? 200 : null,
        upstreamStatus: requestedSources.includes('soundcloud') ? 200 : null,
        resultCount: merged.filter((track) => track.availableSources?.includes('soundcloud') || track.source === 'soundcloud').length,
        state: requestedSources.includes('soundcloud')
          ? (merged.some((track) => track.availableSources?.includes('soundcloud') || track.source === 'soundcloud') ? 'direct' : 'empty')
          : diagnostics.providers.soundcloud.state,
        code: requestedSources.includes('soundcloud')
          ? (merged.some((track) => track.availableSources?.includes('soundcloud') || track.source === 'soundcloud') ? 'DIRECT_RESULTS' : 'NO_RESULTS')
          : diagnostics.providers.soundcloud.code,
      };
      diagnostics.directMatchCount = merged.length;
      diagnostics.openFallbackCount = 0;
      diagnostics.fallbackUsed = false;
      logSearchTruth('searchApi.mock', diagnostics);
      return {
        tracks: merged,
        fallbackUsed: false,
        providerStates: getProviderStatesFromDiagnostics(diagnostics.providers),
        diagnostics,
      };
    }

    if (requestedSources.length > 0) {
      const { tracks: providerTracks, diagnostics } = await queryProviderTracks(query, requestedSources, { silent: true });
      const directMatches = mergeAvailabilityTracks(providerTracks).map((track) => ({
        ...track,
        resultOrigin: 'direct' as const,
      }));

      const { searchItunes } = await import('./itunesSearch');
      const fallbackCatalogTracks = await searchItunes(query).catch(() => []);
      const fallbackTracks = enrichOpenCatalogTracks(fallbackCatalogTracks);
      const uniqueFallbackTracks = fallbackTracks.filter((fallbackTrack) =>
        !directMatches.some((directTrack) => tracksShareAvailabilityIdentity(directTrack, fallbackTrack)),
      );

      if (directMatches.length > 0) {
        diagnostics.directMatchCount = directMatches.length;
        diagnostics.openFallbackCount = uniqueFallbackTracks.length;
        diagnostics.fallbackUsed = uniqueFallbackTracks.length > 0;
        logSearchTruth('searchApi.providers', diagnostics);
        return {
          tracks: [...directMatches, ...uniqueFallbackTracks],
          fallbackUsed: uniqueFallbackTracks.length > 0,
          providerStates: getProviderStatesFromDiagnostics(diagnostics.providers),
          diagnostics,
        };
      }

      if (uniqueFallbackTracks.length === 0) {
        const emergencyTracks = searchEmergencyCatalog(query);
        diagnostics.directMatchCount = 0;
        diagnostics.openFallbackCount = emergencyTracks.length;
        diagnostics.fallbackUsed = emergencyTracks.length > 0;
        logSearchTruth('searchApi.providers', diagnostics);
        return {
          tracks: emergencyTracks,
          fallbackUsed: emergencyTracks.length > 0,
          providerStates: getProviderStatesFromDiagnostics(diagnostics.providers),
          diagnostics,
        };
      }

      diagnostics.directMatchCount = 0;
      diagnostics.openFallbackCount = uniqueFallbackTracks.length;
      diagnostics.fallbackUsed = uniqueFallbackTracks.length > 0;
      logSearchTruth('searchApi.providers', diagnostics);
      return {
        tracks: uniqueFallbackTracks,
        fallbackUsed: uniqueFallbackTracks.length > 0,
        providerStates: getProviderStatesFromDiagnostics(diagnostics.providers),
        diagnostics,
      };
    }

    const diagnostics = createSearchDiagnostics(query, requestedSources);

    // Try connected streaming service first
    const { getActiveAdapter } = await import('./adapters/musicServiceAdapter');
    const adapter = getActiveAdapter(currentServices);

    if (adapter.isConnected()) {
      const tracks = await adapter.search(query);
      if (tracks.length > 0) {
        diagnostics.directMatchCount = tracks.length;
        logSearchTruth('searchApi.default', diagnostics);
        return {
          tracks: tracks.map((track) => ({ ...track, resultOrigin: 'direct' as const })),
          fallbackUsed: false,
          providerStates: getProviderStatesFromDiagnostics(diagnostics.providers),
          diagnostics,
        };
      }
    }

      // Fallback: iTunes Search API — free, no auth, 30-sec previews
      const { searchItunes } = await import('./itunesSearch');
      const openCatalogTracks = await searchItunes(query).catch(() => []);
      const tracks = openCatalogTracks.length > 0
        ? openCatalogTracks.map((track) => ({ ...track, resultOrigin: 'open' as const }))
        : searchEmergencyCatalog(query);
      diagnostics.openFallbackCount = tracks.length;
      diagnostics.fallbackUsed = tracks.length > 0;
      logSearchTruth('searchApi.default', diagnostics);
      return {
        tracks,
        fallbackUsed: tracks.length > 0,
        providerStates: getProviderStatesFromDiagnostics(diagnostics.providers),
        diagnostics,
      };
    },

  enrichTrackAvailability: async (
    query: string,
    tracks: import('../types').Track[],
    sources: SearchHudProvider[],
  ) => {
    return tracks;
  },

  sessions: async (query: string) => {
    if (USE_MOCKS) {
      await mockDelay(200, 600);
      const q = query.toLowerCase();
      const filtered = mockSessions.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.genre || '').toLowerCase().includes(q) ||
          s.hostUsername.toLowerCase().includes(q)
      );
      return { sessions: filtered };
    }
    return apiFetch<{ sessions: import('../types').Session[] }>(
      `/search/sessions?q=${encodeURIComponent(query)}`
    );
  },

  users: async (query: string) => {
    if (USE_MOCKS) {
      await mockDelay(200, 500);
      const q = query.toLowerCase();
      const filtered = mockUsers.filter(
        (u) => u.username.toLowerCase().includes(q)
      );
      return { users: filtered };
    }
    return apiFetch<{ users: import('../types').MockUser[] }>(
      `/search/users?q=${encodeURIComponent(query)}`
    );
  },
};

// ─── Integrations Endpoints ───────────────────────────────────

export const integrationsApi = {
  fetchLyrics: async (title: string, artist: string) => {
    if (USE_MOCKS) {
      await mockDelay(200, 400);
      return { lyrics: `[Mock Lyrics]\n\nThese are placeholder lyrics for "${title}" by ${artist}.\nConnect to the backend to fetch real lyrics from Genius.` };
    }
    return apiFetch<{ lyrics: string; url?: string; thumbnail?: string }>(
      `/lyrics/search?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
    );
  },

  scrobble: async (track: string, artist: string, timestamp: number) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { message: 'Mocked scrobble' };
    }
    return apiFetch<{ message: string }>('/user/scrobble', {
      method: 'POST',
      body: JSON.stringify({ track, artist, timestamp }),
    });
  },

  /** Update "Now Playing" on Last.fm when a track starts */
  updateNowPlaying: async (track: string, artist: string, duration?: number) => {
    if (USE_MOCKS) {
      return { message: 'Mocked now playing' };
    }
    return apiFetch<{ message: string }>('/user/scrobble/now-playing', {
      method: 'POST',
      body: JSON.stringify({ track, artist, duration }),
    });
  },
};

// ─── AI Endpoints ─────────────────────────────────────────────

export interface SonicAestheticResult {
  aestheticDescription: string;
  nextTrack: string;
  nextArtist: string;
}

export interface SonicLineageResult {
  lineage: string;
}

export interface QueueTrackInput {
  title: string;
  artist: string;
  album?: string;
}

export interface OracleModeResult {
  tracks: Array<{ title: string; artist: string }>;
}

export interface TransitionMatrixResult {
  rating: string;
  critique: string;
}

export interface GlobalForecastResult {
  manifesto: string;
  trackSuggestion: string;
}

export interface SonicAuraResult {
  auraName: string;
  reading: string;
}

export interface SonicAuraInput {
  roomsHosted: number;
  duelWinRate: number;
  topArtists: string[];
}

const shouldUseMockAi = () => USE_MOCKS && !AI_USE_REAL_BACKEND;

export const aiApi = {
  /**
   * Sonic Aesthetic — analyzes the room queue and generates an editorial
   * vibe description + one curated track suggestion.
   */
  sonicAesthetic: async (queue: QueueTrackInput[]): Promise<SonicAestheticResult> => {
    if (shouldUseMockAi()) {
      await mockDelay(800, 1500);
      const first = queue[0];
      const last = queue[queue.length - 1];
      return {
        aestheticDescription: first && last
          ? `A dim, late-hour tension links ${first.artist}'s emotional grain to ${last.artist}'s low-burn atmosphere, shaping the room into a slow, introspective drift.`
          : 'A nocturnal current of hazy introspection permeates the room, where urban melancholy meets slow-burning, emotive textures.',
        nextTrack: 'Cranes in the Sky',
        nextArtist: 'Solange'
      };
    }
    return apiFetch<SonicAestheticResult>('/ai/sonic-aesthetic', {
      method: 'POST',
      body: JSON.stringify({ queue }),
    });
  },

  /**
   * Sonic Lineage — generates a museum-plaque style editorial breakdown
   * of a specific track's cultural lineage and sonic texture.
   */
  sonicLineage: async (title: string, artist: string): Promise<SonicLineageResult> => {
    if (shouldUseMockAi()) {
      await mockDelay(600, 1200);
      return {
        lineage: `"${title}" by ${artist} reads as an intimate study in negative space: restrained low-end, patient harmonic movement, and vocal detail carrying the emotional weight. Its lineage sits between confessional R&B and internet-era minimalism, where texture replaces spectacle and mood becomes the argument.`,
      };
    }
    return apiFetch<SonicLineageResult>('/ai/sonic-lineage', {
      method: 'POST',
      body: JSON.stringify({ title, artist }),
    });
  },

  /**
   * Oracle Mode — semantic music search using abstract feelings/aesthetics.
   * Returns 3 track recommendations matching the described mood.
   */
  oracle: async (feeling: string): Promise<OracleModeResult> => {
    if (shouldUseMockAi()) {
      await mockDelay(700, 1400);
      return {
        tracks: [
          { title: 'Teardrop', artist: 'Massive Attack' },
          { title: 'Everything In Its Right Place', artist: 'Radiohead' },
          { title: 'Dissolve', artist: 'Absrdst' },
        ],
      };
    }
    return apiFetch<OracleModeResult>('/ai/oracle', {
      method: 'POST',
      body: JSON.stringify({ feeling }),
    });
  },

  /**
   * Global Network Forecast — daily "horoscope" style vibe recommendation.
   */
  globalForecast: async (): Promise<GlobalForecastResult> => {
    if (shouldUseMockAi()) {
      await mockDelay(500, 1000);
      return {
        manifesto: 'The satellite hum demands a descent into glacial ambient — something crystalline, something that breathes in frequencies below human comfort.',
        trackSuggestion: 'An Ending (Ascent) - Brian Eno',
      };
    }
    return apiFetch<GlobalForecastResult>('/ai/global-forecast', {
      method: 'POST',
    });
  },

  /**
   * Transition Matrix — analyzes the energy blend between current and next track.
   */
  transitionMatrix: async (
    currentTitle: string, currentArtist: string,
    nextTitle: string, nextArtist: string
  ): Promise<TransitionMatrixResult> => {
    if (shouldUseMockAi()) {
      await mockDelay(600, 1200);
      return {
        rating: 'Tonal Drift',
        critique: `${currentArtist}'s emotional contour hands off to ${nextArtist} with a measurable shift in energy; the blend works when the room is leaning introspective, but it risks whiplash if listeners expect momentum.`,
      };
    }
    return apiFetch<TransitionMatrixResult>('/ai/transition-matrix', {
      method: 'POST',
      body: JSON.stringify({ currentTitle, currentArtist, nextTitle, nextArtist }),
    });
  },

  /**
   * Sonic Aura — personalized user profile "aura" reading.
   */
  sonicAura: async (input: SonicAuraInput): Promise<SonicAuraResult> => {
    if (shouldUseMockAi()) {
      await mockDelay(800, 1500);
      const topArtist = input.topArtists[0] || 'their core influences';
      return {
        auraName: input.duelWinRate >= 60 ? 'Sapphire Precision' : 'Velvet Drift',
        reading: `Anchored by ${topArtist}, this listener curates with deliberate restraint: fewer gimmicks, stronger atmosphere. Their room behavior suggests a taste for emotional continuity over shock cuts, with confidence that grows as the set unfolds.`,
      };
    }
    return apiFetch<SonicAuraResult>('/ai/sonic-aura', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

// ─── Friend Types ────────────────────────────────────────────

export interface FriendUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  sessionsHosted?: number;
  tracksAdded?: number;
}

export interface FriendRequest extends FriendUser {
  requestedAt: string;
}

export interface OnlineFriend extends FriendUser {
  sessionId: string;
  sessionName: string;
}

export type FriendshipStatus = 'none' | 'friends' | 'pending_sent' | 'pending_received' | 'blocked';

// ─── User Profile Types ──────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  sessionsHosted: number;
  tracksAdded: number;
  totalListeningTime: number;
  friendCount: number;
  friendshipStatus: FriendshipStatus;
  liveSession: { id: string; name: string } | null;
  createdAt: string;
}

// ─── Activity Types ──────────────────────────────────────────

export interface ActivityEvent {
  id: number;
  eventType: string;
  actor: { id: string; username: string; avatarUrl: string | null };
  targetUser: { id: string; username: string } | null;
  sessionId: string | null;
  track: { title: string; artist: string } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

// ─── Friend API ──────────────────────────────────────────────

export const friendApi = {
  /** Send friend request */
  sendRequest: async (targetUserId: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'pending', message: 'Friend request sent' };
    }
    return apiFetch<{ status: string; message: string }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  /** Accept incoming request */
  accept: async (targetId: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'accepted' };
    }
    return apiFetch<{ status: string }>(`/friends/accept/${targetId}`, { method: 'POST' });
  },

  /** Reject incoming request */
  reject: async (targetId: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'rejected' };
    }
    return apiFetch<{ status: string }>(`/friends/reject/${targetId}`, { method: 'POST' });
  },

  /** Remove an existing friend */
  remove: async (targetId: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'removed' };
    }
    return apiFetch<{ status: string }>(`/friends/${targetId}`, { method: 'DELETE' });
  },

  /** List all friends */
  list: async (): Promise<{ friends: FriendUser[] }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return {
        friends: mockUsers.map((u) => ({
          id: u.id, username: u.username, avatarUrl: null,
          sessionsHosted: 5, tracksAdded: 23,
        })),
      };
    }
    return apiFetch<{ friends: FriendUser[] }>('/friends');
  },

  /** Pending incoming requests */
  pending: async (): Promise<{ requests: FriendRequest[] }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { requests: [] };
    }
    return apiFetch<{ requests: FriendRequest[] }>('/friends/pending');
  },

  /** Pending outgoing requests */
  sent: async (): Promise<{ requests: FriendRequest[] }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { requests: [] };
    }
    return apiFetch<{ requests: FriendRequest[] }>('/friends/sent');
  },

  /** Get friendship status with a user */
  status: async (targetId: string): Promise<{ status: FriendshipStatus }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'none' };
    }
    return apiFetch<{ status: FriendshipStatus }>(`/friends/status/${targetId}`);
  },

  /** Friends currently in live sessions */
  online: async (): Promise<{ online: OnlineFriend[] }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { online: [] };
    }
    return apiFetch<{ online: OnlineFriend[] }>('/friends/online');
  },

  /** Block a user */
  block: async (targetId: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'blocked' };
    }
    return apiFetch<{ status: string }>(`/friends/block/${targetId}`, { method: 'POST' });
  },

  /** Unblock a user */
  unblock: async (targetId: string) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'unblocked' };
    }
    return apiFetch<{ status: string }>(`/friends/block/${targetId}`, { method: 'DELETE' });
  },
};

// ─── Activity & Notification API ─────────────────────────────

export const activityApi = {
  /** Get friends' activity feed */
  feed: async (limit = 50, before?: string): Promise<{ events: ActivityEvent[]; hasMore: boolean }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { events: [], hasMore: false };
    }
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    return apiFetch<{ events: ActivityEvent[]; hasMore: boolean }>(`/activity/feed?${params}`);
  },

  /** Get own activity */
  myActivity: async (limit = 50): Promise<{ events: ActivityEvent[] }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { events: [] };
    }
    return apiFetch<{ events: ActivityEvent[] }>(`/activity/me?limit=${limit}`);
  },
};

export const notificationApi = {
  /** Get notifications */
  list: async (limit = 50): Promise<{ notifications: Notification[] }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { notifications: [] };
    }
    return apiFetch<{ notifications: Notification[] }>(`/notifications?limit=${limit}`);
  },

  /** Mark specific notifications as read */
  markRead: async (notificationIds: number[]) => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'ok' };
    }
    return apiFetch<{ status: string }>('/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ notificationIds }),
    });
  },

  /** Mark all as read */
  markAllRead: async () => {
    if (USE_MOCKS) {
      await mockDelay();
      return { status: 'ok' };
    }
    return apiFetch<{ status: string }>('/notifications/read-all', { method: 'POST' });
  },

  /** Get unread count */
  unreadCount: async (): Promise<{ count: number }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { count: 0 };
    }
    return apiFetch<{ count: number }>('/notifications/unread-count');
  },
};

// ─── User Profile API ────────────────────────────────────────

export const userApi = {
  /** Get user profile */
  getProfile: async (userId: string): Promise<{ user: UserProfile }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return {
        user: {
          id: userId,
          username: 'mock_user',
          avatarUrl: null,
          sessionsHosted: 12,
          tracksAdded: 87,
          totalListeningTime: 54000,
          friendCount: 23,
          friendshipStatus: 'none',
          liveSession: null,
          createdAt: new Date().toISOString(),
        },
      };
    }
    return apiFetch<{ user: UserProfile }>(`/users/${userId}`);
  },

  /** Get user's public activity */
  getActivity: async (userId: string, limit = 20): Promise<{ events: ActivityEvent[] }> => {
    if (USE_MOCKS) {
      await mockDelay();
      return { events: [] };
    }
    return apiFetch<{ events: ActivityEvent[] }>(`/users/${userId}/activity?limit=${limit}`);
  },
};

// ─── Exports ────────────────────────────────────────────────

export default {
  auth: authApi, session: sessionApi, search: searchApi,
  integrations: integrationsApi, ai: aiApi,
  friends: friendApi, activity: activityApi,
  notifications: notificationApi, users: userApi,
};
