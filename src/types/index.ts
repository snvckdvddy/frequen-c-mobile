/**
 * Frequen-C Mobile — Type Definitions
 *
 * Re-exports all shared types from @frequen-c/types (the canonical source),
 * plus mobile-specific types (navigation params, mock data shapes).
 *
 * All 68+ files that import from '../types' or '../../types' continue
 * working unchanged — the import path hasn't moved.
 */

// ─── Shared Types (canonical source of truth) ───────────────
export {
  // User & Auth
  type User,
  type ConnectedServices,
  type ServiceConnection,
  type AuthState,
  type LoginCredentials,
  type RegisterCredentials,

  // Session / Room
  type RoomMode,
  type RoomBehaviors,
  type Listener,
  type Participant,
  type Session,
  DEFAULT_BEHAVIORS,
  BEHAVIOR_PRESETS,

  // Tracks
  type TrackSource,
  type Track,
  type Reaction,
  type QueueTrack,

  // CV Economy
  type CVAction,
  type CVLedgerEntry,
  type CVCooldown,
  type PowerMoveType,
  type PowerMoveRequest,
  type CVSpendResult,

  // Chat
  type ChatMessage,

  // Search
  type SearchResult,
  type SearchSegment,
  type FavoriteTrack,
  type RecentSearch,

  // Socket Events
  SocketEvents,
  type SocketEventName,
} from '@frequen-c/types';

// ─── Mobile-Specific Types ──────────────────────────────────
// These are React Navigation param lists — app-specific, not shared.

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

// Mock user shape for development/testing — derived from canonical User type
import type { User as _User } from '@frequen-c/types';
export type MockUser = Pick<_User, 'id' | 'username' | 'avatarUrl' | 'tracksAdded'> & {
  /** @deprecated Use sessionsHosted (from User) for consistency */
  sessionsCount: number;
};
