/**
 * API Client
 *
 * Connects to the existing Frequen-C Node/Express backend.
 * Toggle USE_MOCKS in config.ts for offline development.
 */

import { mockUser, mockSessions, mockQueue, mockSearchResults, mockUsers, mockDelay } from './mockData';
import { User, Session, Track, MockUser, ConnectedServices } from '../types';
import { USE_MOCKS, AI_USE_REAL_BACKEND } from './config';

// Re-export from fetchClient so existing consumers don't break
export { apiFetch, getStoredToken, storeToken, clearToken, ApiError } from './fetchClient';
import { apiFetch, storeToken, clearToken, ApiError } from './fetchClient';

// Storage for active services config
export let currentServices: ConnectedServices | undefined;

export function setCurrentServices(services?: ConnectedServices) {
  currentServices = services;
}

export type DisconnectableProvider = 'spotify' | 'soundcloud' | 'tidal' | 'lastfm';

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
      console.log('[API:Mock] Push token registered:', pushToken.slice(0, 30) + '...');
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
    return apiFetch<{ user: any }>('/auth/preferences', {
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
  create: async (data: { name: string; genre?: string; roomMode?: string; isPublic?: boolean; behaviors?: import('../types').RoomBehaviors; source?: string; vibe?: string }) => {
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
        source: data.source,
        vibe: data.vibe,
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
    return apiFetch<{ sessions: import('../types').Session[] }>('/sessions/mine');
  },

  discover: async () => {
    if (USE_MOCKS) {
      await mockDelay();
      // Include dynamic sessions in discover too
      const dynamic = Array.from(mockSessionStore.values()).filter((s) => s.isPublic);
      return { sessions: mergeUniqueSessions(dynamic, mockSessions) };
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
  metadata: Record<string, any>;
  createdAt: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
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
