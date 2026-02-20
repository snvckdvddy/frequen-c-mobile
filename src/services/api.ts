/**
 * API Client
 *
 * Connects to the existing Frequen-C Node/Express backend.
 * Set USE_MOCKS = true for offline development (no backend needed).
 */

import * as SecureStore from 'expo-secure-store';
import { mockUser, mockSessions, mockQueue, mockSearchResults, mockUsers, mockDelay } from './mockData';
import { searchItunes } from './itunesSearch';
import { USE_MOCKS, API_BASE_URL } from './config';

// ─── Token Management ───────────────────────────────────────

const TOKEN_KEY = 'frequenc_auth_token';

async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function storeToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── Fetch Wrapper ──────────────────────────────────────────

interface ApiOptions extends RequestInit {
  skipAuth?: boolean;
}

async function apiFetch<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new ApiError(response.status, errorBody.message || response.statusText, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
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

  logout: async () => {
    await clearToken();
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
};

// ─── Search Endpoints ───────────────────────────────────────

export const searchApi = {
  tracks: async (query: string) => {
    // Always use iTunes for track search — real catalog, no auth needed.
    // Falls back to mock data only if iTunes request fails (e.g. no network).
    try {
      const tracks = await searchItunes(query);
      return { tracks };
    } catch {
      // Offline fallback: filter mock data
      const filtered = mockSearchResults.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.artist.toLowerCase().includes(query.toLowerCase())
      );
      return { tracks: filtered.length > 0 ? filtered : mockSearchResults };
    }
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

// ─── Exports ────────────────────────────────────────────────

export { getStoredToken, storeToken, clearToken, apiFetch };
export default { auth: authApi, session: sessionApi, search: searchApi };
