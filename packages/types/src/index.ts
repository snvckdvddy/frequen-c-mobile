/**
 * @frequen-c/types
 * ─────────────────────────────────────────────────────────────
 * Canonical shared TypeScript types for all Frequen-C apps.
 *
 * This is the single source of truth. The mobile app re-exports
 * from here via src/types/index.ts. The web and backend MUST NOT
 * define their own versions of these types.
 */

// ─── User ────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  connectedServices: ConnectedServices;
  createdAt: string;
  sessionsHosted?: number;
  tracksAdded?: number;
  totalListeningTime?: number; // minutes
  voltageBalance?: number;
  noiseGate?: 'off' | 'low' | 'medium' | 'high';
  authProvider?: 'email' | 'apple' | 'google';
  // AI: Sonic Aura fields
  duelWinRate?: number;
  topArtists?: string[];
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

// ─── Auth ────────────────────────────────────────────────────

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

// ─── Session / Room ──────────────────────────────────────────

export type RoomMode = 'campfire' | 'spotlight' | 'openFloor';

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

export type Participant = Listener;

export interface Session {
  id: string;
  name: string;
  hostId: string;
  hostUsername: string;
  description?: string;
  genre?: string;
  roomMode: RoomMode;
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
  source?: string;
  vibe?: string;
}

// ─── Tracks ──────────────────────────────────────────────────

export type TrackSource = 'spotify' | 'appleMusic' | 'soundcloud' | 'youtube' | 'tidal' | 'itunes';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  previewUrl?: string;
  duration: number; // seconds
  source: TrackSource;
  sourceId?: string;
  addedBy?: { userId: string; username: string };
  votes?: number;
  voltageBoost?: number;
  reactions?: Reaction[];
  /** Which service returned this track in a search ('direct' = user's connected service) */
  resultOrigin?: 'direct' | 'open';
  /** All services this track was found on during cross-service dedup */
  availableSources?: TrackSource[];
  /** Beats per minute (from Spotify audio-features or equivalent) */
  bpm?: number;
  /** Musical key (e.g. 'Cm', 'F#', Camelot notation) */
  key?: string;
  /** Audio format or codec (e.g. 'MP3', 'AAC', 'FLAC') */
  format?: string;
  /**
   * International Standard Recording Code — universal cross-service recording ID.
   * Populated by Spotify Client Credentials catalog responses and by the ISRC
   * cross-match backend so we can resolve a Spotify-discovered track to its
   * playable equivalent on Apple Music / Tidal / etc.
   */
  isrc?: string;
  /**
   * When a track was originally discovered via one service but resolved to
   * another for playback, the original discovery source is recorded here so
   * the UI can render attribution (e.g., "via Spotify" on an Apple Music row).
   * Always set alongside a `source` that differs from `metadataSource`.
   */
  metadataSource?: TrackSource;
}

export interface Reaction {
  userId: string;
  type: 'fire' | 'vibe' | 'skip';
  timestamp?: string;
}

export interface QueueTrack extends Track {
  addedById: string;
  addedAt: string;
  status?: 'approved' | 'pending';
  votedBy?: Record<string, 1 | -1>;
}

// ─── CV Economy ──────────────────────────────────────────────

/** All actions that generate or consume CV. */
export type CVAction =
  | 'track_added'        // +5 CV: user added a track that played
  | 'track_voted_up'     // +2 CV: your track received an upvote
  | 'reaction_received'  // +1 CV: someone reacted to your track
  | 'duel_won'           // +10 CV: won a music duel
  | 'forecast_correct'   // +8 CV: correctly forecast next track
  | 'session_hosted'     // +3 CV: hosted a session for 15+ min
  | 'overdrive'          // -25 CV: Power Move — jump to front of queue
  | 'phase_cancel'       // -15 CV: Power Move — remove a track from queue
  | 'phantom_power'      // -5 CV: Power Move — protect your track from skip
  | 'queue_boost';       // variable: boost a track's vote weight

export interface CVLedgerEntry {
  id: string;
  userId: string;
  sessionId: string;
  action: CVAction;
  delta: number;         // positive = earn, negative = spend
  balanceAfter: number;
  metadata?: Record<string, unknown>;
  createdAt: string;     // ISO timestamp
}

export interface CVCooldown {
  userId: string;
  sessionId: string;
  action: CVAction;
  availableAt: string;   // ISO timestamp — when the cooldown expires
}

export type PowerMoveType = 'overdrive' | 'phaseCancel' | 'phantomPower';

export interface PowerMoveRequest {
  sessionId: string;
  userId: string;
  moveType: PowerMoveType;
  targetTrackId?: string; // required for phaseCancel
}

export interface CVSpendResult {
  success: boolean;
  newBalance: number;
  ledgerEntryId: string;
  error?: 'insufficient_cv' | 'on_cooldown' | 'not_found';
  cooldownExpiresAt?: string;
}

// ─── Chat ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  username: string;
  text: string;
  type: 'message' | 'system' | 'reaction';
  timestamp: string;
}

// ─── Library / Playlists ─────────────────────────────────────

export interface Playlist {
  id: string;
  name: string;
  trackCount: number;
  coverArt?: string;
  source: TrackSource;
  owner?: string;
}

// ─── Search ──────────────────────────────────────────────────

export interface SearchResult {
  tracks: Track[];
  query: string;
  source: string;
}

export type SearchSegment = 'tracks' | 'rooms' | 'people';

export interface FavoriteTrack {
  track: Track;
  savedAt: string;
}

export interface RecentSearch {
  query: string;
  timestamp: string;
  segment: SearchSegment;
}

// ─── Socket Event Contracts ───────────────────────────────────
// Canonical event names and payload shapes.
// Emit/on handlers in ALL three apps must use these exactly.

export const SocketEvents = {
  // Connection
  JOIN_SESSION:    'joinSession',
  LEAVE_SESSION:   'leaveSession',

  // Queue
  ADD_TO_QUEUE:    'addToQueue',
  VOTE_TRACK:      'voteTrack',
  SKIP_TRACK:      'skipTrack',
  REMOVE_TRACK:    'removeTrack',
  TRACK_ENDED:     'trackEnded',
  APPROVE_TRACK:   'approveTrack',
  REJECT_TRACK:    'rejectTrack',

  // Reactions
  SEND_REACTION:   'sendReaction',

  // Room
  CHANGE_MODE:     'changeMode',
  UPDATE_BEHAVIORS:'updateBehaviors',
  END_SESSION:     'endSession',

  // CV Economy
  CV_SPEND:        'cv:spend',
  CV_EARN:         'cv:earn',
  CV_BALANCE:      'cv:balance',

  // Power Moves
  OVERDRIVE:       'overdrive',
  PHASE_CANCEL:    'phaseCancel',
  PHANTOM_POWER:   'phantomPower',

  // Social Gaming
  DUEL_VOTE:       'duelVote',
  SUBMIT_FORECAST: 'submitForecast',

  // Server → Client Events
  SESSION_EVENT:   'sessionEvent',
  SESSION_UPDATE:  'sessionUpdate',
  HEARTBEAT:       'listenHeartbeat',
} as const;

export type SocketEventName = typeof SocketEvents[keyof typeof SocketEvents];
