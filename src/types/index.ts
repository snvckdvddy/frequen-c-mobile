/**
 * Frequen-C Core Types
 *
 * Mobile-first type definitions.
 * Aligned with screen components and mock data layer.
 * Backend types may differ — api.ts handles the mapping.
 */

// ─── User ───────────────────────────────────────────────────
export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  connectedServices: ConnectedServices;
  createdAt: string;
  // Stats
  sessionsHosted?: number;
  tracksAdded?: number;
  totalListeningTime?: number; // minutes
  voltageBalance?: number;
}

export interface ConnectedServices {
  spotify?: ServiceConnection;
  appleMusic?: ServiceConnection;
  soundcloud?: ServiceConnection;
  youtube?: ServiceConnection;
  tidal?: ServiceConnection;
}

export interface ServiceConnection {
  connected: boolean;
  username?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

// ─── Auth ───────────────────────────────────────────────────
export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

// ─── Session / Room ─────────────────────────────────────────
export type RoomMode = 'campfire' | 'spotlight' | 'openFloor';

export interface Listener {
  userId: string;
  username: string;
  avatarUrl?: string;
}

export interface Session {
  id: string;
  name: string;
  hostId: string;
  hostUsername: string;
  description?: string;
  genre?: string;
  roomMode: RoomMode;
  isPublic: boolean;
  isLive: boolean;
  joinCode: string;
  listeners: Listener[];
  currentTrack?: Track;
  queue: Track[];
  createdAt: string;
}

// ─── Tracks ─────────────────────────────────────────────────
export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  previewUrl?: string;  // 30-second audio preview (iTunes, Spotify, etc.)
  duration: number; // seconds
  source: 'spotify' | 'appleMusic' | 'soundcloud' | 'youtube' | 'tidal' | 'itunes';
  sourceId?: string;
  // Queue metadata (present when track is in a session queue)
  addedBy?: { userId: string; username: string };
  votes?: number;
  voltageBoost?: number;
  reactions?: Reaction[];
}

export interface Reaction {
  userId: string;
  type: 'fire' | 'vibe' | 'skip';
  timestamp?: string;
}

// ─── Queue Track (Track + queue-specific metadata) ──────
// When a Track enters a session queue, it gains these fields.
export interface QueueTrack extends Track {
  addedById: string;       // userId of the person who added it
  addedAt: string;         // ISO timestamp
  status?: 'approved' | 'pending';  // Spotlight mode: pending = awaiting host approval
  votedBy?: Record<string, 1 | -1>; // userId → vote direction (for toggle/dedup)
}

// ─── Participant (real-time presence, same shape as Listener) ──
export type Participant = Listener;

// ─── Chat ───────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  username: string;
  text: string;
  type: 'message' | 'system' | 'reaction';
  timestamp: string; // ISO
}

// ─── Search ─────────────────────────────────────────────────
export interface SearchResult {
  tracks: Track[];
  query: string;
  source: string;
}

// ─── Navigation ─────────────────────────────────────────────
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Session: { sessionId: string };
  CreateSession: undefined;
  JoinSession: { joinCode?: string };
  Profile: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Search: undefined;
  Profile: undefined;
};

// ─── Search Screen ─────────────────────────────────────────
export type SearchSegment = 'tracks' | 'rooms' | 'people';

export interface FavoriteTrack {
  track: Track;
  savedAt: string; // ISO timestamp
}

export interface RecentSearch {
  query: string;
  timestamp: string; // ISO timestamp
  segment: SearchSegment;
}

export interface MockUser {
  id: string;
  username: string;
  avatarUrl?: string;
  sessionsCount: number;
  tracksAdded: number;
}
