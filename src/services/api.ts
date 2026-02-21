/**
 * API Client
 *
 * Connects to the existing Frequen-C Node/Express backend.
 * Toggle USE_MOCKS in config.ts for offline development.
 */

import { mockUser, mockSessions, mockQueue, mockSearchResults, mockUsers, mockDelay } from './mockData';
import { User, Session, Track, MockUser, ConnectedServices } from '../types';
import { USE_MOCKS } from './config';

// Re-export from fetchClient so existing consumers don't break
export { apiFetch, getStoredToken, storeToken, clearToken, ApiError } from './fetchClient';
import { apiFetch, storeToken, clearToken, ApiError } from './fetchClient';

// Storage for active services config
export let currentServices: ConnectedServices | undefined;

export function setCurrentServices(services?: ConnectedServices) {
  currentServices = services;
}


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
      console.log('[API:Mock] Push token registered:', pushToken.slice(0, 30) + '...');
      return { message: 'Push token saved' };
    }
    return apiFetch<{ message: string }>('/auth/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
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
      body: JSON.stringify({ noiseGate }),
    });
  },
};

// ─── Mock Session Store ──────────────────────────────────────
// Persists sessions created/joined during this mock session so
// get() can find them and myRooms() can list them.

const mockSessionStore: Map<string, import('../types').Session> = new Map();
// Track which sessions the current user has created or joined
const myRoomIds: Set<string> = new Set();

// ─── Session Endpoints ──────────────────────────────────────

export const sessionApi = {
  create: async (data: { name: string; genre?: string; roomMode?: string; isPublic?: boolean }) => {
    if (USE_MOCKS) {
      await mockDelay();
      const session: import('../types').Session = {
        id: 'ses_new_' + Date.now(),
        name: data.name,
        hostId: mockUser.id,
        hostUsername: mockUser.username,
        roomMode: (data.roomMode || 'campfire') as import('../types').RoomMode,
        genre: data.genre || 'Mixed',
        isPublic: data.isPublic ?? true,
        isLive: true,
        joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        description: '',
        listeners: [],
        currentTrack: undefined,
        queue: [],
        createdAt: new Date().toISOString(),
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
        return { session: { ...stored, queue: stored.queue.length ? stored.queue : mockQueue } };
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
      return { sessions: [...mockSessions, ...dynamic] };
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
      mockSessionStore.set(session.id, session);
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
    return apiFetch<{ sessions: import('../types').Session[] }>('/sessions/mine');
  },

  discover: async () => {
    if (USE_MOCKS) {
      await mockDelay();
      // Include dynamic sessions in discover too
      const dynamic = Array.from(mockSessionStore.values()).filter((s) => s.isPublic);
      return { sessions: [...mockSessions, ...dynamic] };
    }
    return apiFetch<{ sessions: import('../types').Session[] }>('/sessions/discover');
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
};

// ─── Search Endpoints ───────────────────────────────────────

export const searchApi = {
  tracks: async (query: string) => {
    if (USE_MOCKS) {
      await mockDelay(200, 500);
      const filtered = mockSearchResults.filter(
        (t: any) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.artist.toLowerCase().includes(query.toLowerCase())
      );
      return { tracks: filtered.length > 0 ? filtered : mockSearchResults };
    }

    // Try connected streaming service first
    const { getActiveAdapter } = await import('./adapters/musicServiceAdapter');
    const adapter = getActiveAdapter(currentServices);

    if (adapter.isConnected()) {
      const tracks = await adapter.search(query);
      if (tracks.length > 0) return { tracks };
    }

    // Fallback: iTunes Search API — free, no auth, 30-sec previews
    const { searchItunes } = await import('./itunesSearch');
    const tracks = await searchItunes(query);
    return { tracks };
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
};

// ─── Exports ────────────────────────────────────────────────

export default { auth: authApi, session: sessionApi, search: searchApi, integrations: integrationsApi };
