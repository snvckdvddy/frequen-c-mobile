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
  noiseGate?: 'off' | 'low' | 'medium' | 'high';
  // AI: Sonic Aura fields
  duelWinRate?: number;    // 0-100 percentage
  topArtists?: string[];   // up to 5 most-played artists
}

export interface ConnectedServices {
  spotify?: ServiceConnection;
  appleMusic?: ServiceConnection;
  soundcloud?: ServiceConnection;
  youtube?: ServiceConnection;
  tidal?: ServiceConnection;
  lastfm?: ServiceConnection;
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

/** Legacy preset names — still used as quick-start templates. */
export type RoomMode = 'campfire' | 'spotlight' | 'openFloor';

/** Granular per-session behavioral toggles. */
export interface RoomBehaviors {
  queueOrdering: 'roundRobin' | 'voteWeighted' | 'fifo';
  voteReordersQueue: boolean;
  skipAccess: 'anyone' | 'hostOnly' | 'voteRequired';
  requiresApproval: boolean;
  allowOverdrive: boolean;
  allowPhaseCancel: boolean;
  allowPhantomPower: boolean;
  forecastEnabled: boolean;
  duelEnabled: boolean;
  reverbTailSeconds: number;
}

/** Default behaviors (fifo, no approval, anyone can skip, all features on). */
export const DEFAULT_BEHAVIORS: RoomBehaviors = {
  queueOrdering: 'fifo',
  voteReordersQueue: false,
  skipAccess: 'anyone',
  requiresApproval: false,
  allowOverdrive: true,
  allowPhaseCancel: true,
  allowPhantomPower: true,
  forecastEnabled: true,
  duelEnabled: true,
  reverbTailSeconds: 300,
};

/** Maps a legacy preset name to its behavioral toggle values. */
export const BEHAVIOR_PRESETS: Record<RoomMode, Partial<RoomBehaviors>> = {
  campfire: {
    queueOrdering: 'roundRobin',
    voteReordersQueue: false,
    skipAccess: 'anyone',
    requiresApproval: false,
  },
  spotlight: {
    queueOrdering: 'fifo',
    voteReordersQueue: false,
    skipAccess: 'hostOnly',
    requiresApproval: true,
  },
  openFloor: {
    queueOrdering: 'voteWeighted',
    voteReordersQueue: true,
    skipAccess: 'anyone',
    requiresApproval: false,
  },
};

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
  /** Legacy preset label — kept for backward compat display. */
  roomMode: RoomMode;
  /** Granular behavioral toggles — source of truth for all queue/feature logic. */
  behaviors: RoomBehaviors;
  isPublic: boolean;
  isLive: boolean;
  joinCode: string;
  listeners: Listener[];
  currentTrack?: Track;
  queue: Track[];
  createdAt: string;
  endedAt?: string;
  tracksPlayedCount?: number;
  /** Music source platform selected at creation (e.g. SPOTIFY, APPLE MUSIC). */
  source?: string;
  /** Session vibe/mood tag selected at creation (e.g. CHILL, HYPE). */
  vibe?: string;
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
  status?: 'approved' | 'pending' | 'played';  // Spotlight: pending = awaiting host; played = already consumed
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
