# Search Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a standalone Search tab (4th bottom tab) with segmented search (Tracks/Rooms/People), personal favorites library, recent searches, and add-to-queue from anywhere in the app.

**Architecture:** New `SearchScreen` on a 4th bottom tab. Two modes: idle (favorites + recent searches) and active (segmented results). `ActiveSessionContext` tracks whether user is in a live room so the add-to-queue sheet knows where to send tracks. All data persistence via AsyncStorage (favorites, recent searches). Mock-first — no backend changes needed.

**Tech Stack:** React Native 0.81.5, Expo SDK 54, TypeScript, AsyncStorage, React Navigation Bottom Tabs

---

## Task 1: Add New Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add FavoriteTrack, RecentSearch, SearchSegment types and update MainTabParamList**

Append these types at the end of `src/types/index.ts`, before the closing of the file. Also add `Search` to `MainTabParamList`.

```typescript
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
```

Update `MainTabParamList`:

```typescript
export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Search: undefined;    // ← ADD
  Profile: undefined;
};
```

**Step 2: Verify**

Open `src/types/index.ts` and confirm the new types exist and `MainTabParamList` includes `Search`.

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(search): add FavoriteTrack, RecentSearch, MockUser types and Search tab param"
```

---

## Task 2: Add Mock Users Data

**Files:**
- Modify: `src/services/mockData.ts`

**Step 1: Add mockUsers array**

Add this after the existing `mockSearchResults` array (before the Mock API Helpers section):

```typescript
// ─── Mock Users (for People search) ────────────────────────

export const mockUsers: import('../types').MockUser[] = [
  { id: 'usr_002', username: 'maya', avatarUrl: undefined, sessionsCount: 8, tracksAdded: 42 },
  { id: 'usr_003', username: 'jordan', avatarUrl: undefined, sessionsCount: 5, tracksAdded: 23 },
  { id: 'usr_004', username: 'alex', avatarUrl: undefined, sessionsCount: 3, tracksAdded: 15 },
  { id: 'usr_005', username: 'priya', avatarUrl: undefined, sessionsCount: 14, tracksAdded: 67 },
  { id: 'usr_006', username: 'sam', avatarUrl: undefined, sessionsCount: 2, tracksAdded: 8 },
  { id: 'usr_008', username: 'dex', avatarUrl: undefined, sessionsCount: 11, tracksAdded: 55 },
  { id: 'usr_014', username: 'dani', avatarUrl: undefined, sessionsCount: 7, tracksAdded: 31 },
  { id: 'usr_017', username: 'king', avatarUrl: undefined, sessionsCount: 9, tracksAdded: 48 },
  { id: 'usr_025', username: 'ella', avatarUrl: undefined, sessionsCount: 6, tracksAdded: 29 },
  { id: 'usr_029', username: 'volt', avatarUrl: undefined, sessionsCount: 4, tracksAdded: 19 },
  { id: 'usr_034', username: 'luna', avatarUrl: undefined, sessionsCount: 10, tracksAdded: 38 },
];
```

**Step 2: Update the import at the top of mockData.ts**

The existing import line is:
```typescript
import type { User, Session, Track, RoomMode } from '../types';
```

Change to:
```typescript
import type { User, Session, Track, RoomMode, MockUser } from '../types';
```

**Step 3: Commit**

```bash
git add src/services/mockData.ts
git commit -m "feat(search): add mockUsers array for people search"
```

---

## Task 3: Extend Search API (sessions + users)

**Files:**
- Modify: `src/services/api.ts`

**Step 1: Update the mockData import**

Change the existing import:
```typescript
import { mockUser, mockSessions, mockQueue, mockSearchResults, mockDelay } from './mockData';
```

To:
```typescript
import { mockUser, mockSessions, mockQueue, mockSearchResults, mockUsers, mockDelay } from './mockData';
```

**Step 2: Add sessions and users methods to searchApi**

Replace the entire `searchApi` object with:

```typescript
export const searchApi = {
  tracks: async (query: string) => {
    if (USE_MOCKS) {
      await mockDelay(300, 800);
      const filtered = mockSearchResults.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.artist.toLowerCase().includes(query.toLowerCase())
      );
      return { tracks: filtered.length > 0 ? filtered : mockSearchResults };
    }
    return apiFetch<{ tracks: import('../types').Track[] }>(
      `/search?q=${encodeURIComponent(query)}`
    );
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
```

**Step 3: Update the default export at the bottom**

It should already work since `searchApi` is the same variable name. Verify the last line:
```typescript
export default { auth: authApi, session: sessionApi, search: searchApi };
```

**Step 4: Commit**

```bash
git add src/services/api.ts
git commit -m "feat(search): add searchApi.sessions() and searchApi.users() endpoints"
```

---

## Task 4: Create useFavorites Hook

**Files:**
- Create: `src/hooks/useFavorites.ts`

**Step 1: Write the hook**

```typescript
/**
 * useFavorites Hook
 *
 * Manages a local favorites library in AsyncStorage.
 * Optimistic UI — heart fills instantly, persistence is async.
 * Cap: 500 tracks (backend takes over later).
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track, FavoriteTrack } from '../types';

const STORAGE_KEY = 'frequenc_favorites';
const MAX_FAVORITES = 500;

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTrack[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setFavorites(JSON.parse(raw));
          } catch {
            // Corrupted data — reset
            setFavorites([]);
          }
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  // Persist to storage whenever favorites change (skip initial load)
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites)).catch(() => {
      // Silent fail — worst case user loses favorites on next load
    });
  }, [favorites, isLoaded]);

  const addFavorite = useCallback((track: Track) => {
    setFavorites((prev) => {
      // Already exists? Don't duplicate
      if (prev.some((f) => f.track.id === track.id)) return prev;
      // Cap at MAX_FAVORITES (drop oldest)
      const next = [{ track, savedAt: new Date().toISOString() }, ...prev];
      return next.slice(0, MAX_FAVORITES);
    });
  }, []);

  const removeFavorite = useCallback((trackId: string) => {
    setFavorites((prev) => prev.filter((f) => f.track.id !== trackId));
  }, []);

  const isFavorite = useCallback(
    (trackId: string) => favorites.some((f) => f.track.id === trackId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (track: Track) => {
      if (isFavorite(track.id)) {
        removeFavorite(track.id);
      } else {
        addFavorite(track);
      }
    },
    [isFavorite, removeFavorite, addFavorite]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite, isLoaded };
}

export default useFavorites;
```

**Step 2: Install AsyncStorage if not already present**

```bash
npx expo install @react-native-async-storage/async-storage
```

**Step 3: Commit**

```bash
git add src/hooks/useFavorites.ts package.json
git commit -m "feat(search): add useFavorites hook with AsyncStorage persistence"
```

---

## Task 5: Create useRecentSearches Hook

**Files:**
- Create: `src/hooks/useRecentSearches.ts`

**Step 1: Write the hook**

```typescript
/**
 * useRecentSearches Hook
 *
 * Stores last 10 search queries in AsyncStorage.
 * Tap to re-search. Swipe-to-delete on the UI side.
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecentSearch, SearchSegment } from '../types';

const STORAGE_KEY = 'frequenc_recent_searches';
const MAX_RECENT = 10;

export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setSearches(JSON.parse(raw));
          } catch {
            setSearches([]);
          }
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  // Persist on change
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(searches)).catch(() => {});
  }, [searches, isLoaded]);

  const addSearch = useCallback((query: string, segment: SearchSegment = 'tracks') => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearches((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter(
        (s) => s.query.toLowerCase() !== trimmed.toLowerCase()
      );
      // Prepend new search
      const next: RecentSearch[] = [
        { query: trimmed, timestamp: new Date().toISOString(), segment },
        ...filtered,
      ];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const removeSearch = useCallback((query: string) => {
    setSearches((prev) => prev.filter((s) => s.query !== query));
  }, []);

  const clearAll = useCallback(() => {
    setSearches([]);
  }, []);

  return { searches, addSearch, removeSearch, clearAll, isLoaded };
}

export default useRecentSearches;
```

**Step 2: Commit**

```bash
git add src/hooks/useRecentSearches.ts
git commit -m "feat(search): add useRecentSearches hook with AsyncStorage persistence"
```

---

## Task 6: Create ActiveSessionContext

**Files:**
- Create: `src/contexts/ActiveSessionContext.tsx`

**Step 1: Write the context**

```typescript
/**
 * ActiveSessionContext
 *
 * Tracks whether the user is currently inside a live session room.
 * Read by AddToRoomSheet to decide which UI to show:
 *   - In a session → "Add to [Room Name]?" + Confirm
 *   - Not in a session → "You're not in a room" + Browse Rooms
 *
 * Set on SessionRoomScreen mount, cleared on leave/unmount.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ActiveSession {
  sessionId: string;
  sessionName: string;
  roomMode: string;
  hostId: string;
}

interface ActiveSessionContextValue {
  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;
  clearActiveSession: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  activeSession: null,
  setActiveSession: () => {},
  clearActiveSession: () => {},
});

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);

  const setActiveSession = useCallback((session: ActiveSession | null) => {
    setActiveSessionState(session);
  }, []);

  const clearActiveSession = useCallback(() => {
    setActiveSessionState(null);
  }, []);

  return (
    <ActiveSessionContext.Provider
      value={{ activeSession, setActiveSession, clearActiveSession }}
    >
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}

export default ActiveSessionContext;
```

**Step 2: Commit**

```bash
git add src/contexts/ActiveSessionContext.tsx
git commit -m "feat(search): add ActiveSessionContext for tracking current room membership"
```

---

## Task 7: Wire ActiveSessionProvider into App.tsx

**Files:**
- Modify: `App.tsx`

**Step 1: Add the import**

Add after the `AuthProvider` import:
```typescript
import { ActiveSessionProvider } from './src/contexts/ActiveSessionContext';
```

**Step 2: Wrap inside AuthProvider**

Change the return to nest `ActiveSessionProvider` inside `AuthProvider`:

```typescript
export default function App() {
  return (
    <View style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
      <ErrorBoundary>
        <AuthProvider>
          <ActiveSessionProvider>
            <AppNavigator />
            <ToastProvider />
          </ActiveSessionProvider>
        </AuthProvider>
      </ErrorBoundary>
    </View>
  );
}
```

**Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(search): wire ActiveSessionProvider into App root"
```

---

## Task 8: Wire ActiveSessionContext into SessionRoomScreen

**Files:**
- Modify: `src/screens/SessionRoomScreen.tsx`

**Step 1: Add import**

Add near the top imports:
```typescript
import { useActiveSession } from '../contexts/ActiveSessionContext';
```

**Step 2: Destructure in the component**

Inside `SessionRoomScreen()`, after `const sessionId = route.params?.sessionId;`, add:
```typescript
const { setActiveSession, clearActiveSession } = useActiveSession();
```

**Step 3: Set active session after load**

Inside the `init()` function, after `setSession(s);` and before `setListeners(...)`, add:
```typescript
        // Track active session for Search → Add to Queue
        setActiveSession({
          sessionId: s.id,
          sessionName: s.name,
          roomMode: s.roomMode,
          hostId: s.hostId,
        });
```

**Step 4: Clear on cleanup**

In the cleanup return of the same `useEffect`, after `leaveSession(...)`, add:
```typescript
      clearActiveSession();
```

The full cleanup becomes:
```typescript
    return () => {
      mounted = false;
      if (user) leaveSession(sessionId, user.id);
      clearActiveSession();
    };
```

**Step 5: Commit**

```bash
git add src/screens/SessionRoomScreen.tsx
git commit -m "feat(search): set/clear ActiveSessionContext on room join/leave"
```

---

## Task 9: Create TrackResultCard Component

**Files:**
- Create: `src/components/search/TrackResultCard.tsx`

**Step 1: Write the component**

```typescript
/**
 * TrackResultCard — Search result for a track.
 *
 * Shows: album art (initial) | title, artist · album, duration · source | ♡ ＋
 * ♡ toggles favorite (solid fill on save, haptic tapLight)
 * ＋ opens AddToRoomSheet
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { tapLight } from '../../utils/haptics';
import type { Track } from '../../types';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    spotify: 'Spotify',
    appleMusic: 'Apple Music',
    soundcloud: 'SoundCloud',
    youtube: 'YouTube',
    tidal: 'Tidal',
  };
  return map[source] || source;
}

interface TrackResultCardProps {
  track: Track;
  isFavorite: boolean;
  onToggleFavorite: (track: Track) => void;
  onAddToRoom: (track: Track) => void;
}

export function TrackResultCard({
  track,
  isFavorite,
  onToggleFavorite,
  onAddToRoom,
}: TrackResultCardProps) {
  return (
    <View style={styles.card}>
      {/* Album art placeholder */}
      <View style={styles.art}>
        <Text variant="labelSmall" color={colors.text.muted}>
          {track.artist.charAt(0)}
        </Text>
      </View>

      {/* Track info */}
      <View style={styles.info}>
        <Text variant="label" color={colors.text.primary} numberOfLines={1}>
          {track.title}
        </Text>
        <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
          {track.artist}{track.album ? ` · ${track.album}` : ''}
        </Text>
        <Text variant="labelSmall" color={colors.text.muted}>
          {formatDuration(track.duration)} · {sourceLabel(track.source)}
        </Text>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => {
          tapLight();
          onToggleFavorite(track);
        }}
        activeOpacity={0.6}
      >
        <Text
          variant="labelLarge"
          color={isFavorite ? colors.action.primary : colors.text.muted}
          style={{ fontSize: 18 }}
        >
          {isFavorite ? '♥' : '♡'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => onAddToRoom(track)}
        activeOpacity={0.6}
      >
        <Text variant="labelLarge" color={colors.action.primary} style={{ fontSize: 20 }}>
          ＋
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
    gap: 1,
  },
  actionBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default TrackResultCard;
```

**Step 2: Commit**

```bash
git add src/components/search/TrackResultCard.tsx
git commit -m "feat(search): add TrackResultCard with favorite toggle and add-to-room"
```

---

## Task 10: Create RoomResultCard Component

**Files:**
- Create: `src/components/search/RoomResultCard.tsx`

**Step 1: Write the component**

```typescript
/**
 * RoomResultCard — Search result for a room/session.
 *
 * Reuses Discover card visual patterns:
 * live dot, listener count, mode badge, genre.
 * Tap navigates to SessionRoomScreen.
 */

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Session } from '../../types';

const modeConfig: Record<string, { icon: string; color: string; label: string }> = {
  campfire: { icon: '🔥', color: colors.session.campfire, label: 'Campfire' },
  spotlight: { icon: '🎤', color: colors.session.spotlight, label: 'Spotlight' },
  openFloor: { icon: '⚡', color: colors.session.openFloor, label: 'Open Floor' },
};

interface RoomResultCardProps {
  session: Session;
  onPress: (sessionId: string) => void;
}

export function RoomResultCard({ session, onPress }: RoomResultCardProps) {
  const mode = modeConfig[session.roomMode] || modeConfig.campfire;
  const listenerCount = session.listeners?.length || 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(session.id)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {session.isLive && <View style={styles.liveDot} />}
          <Text variant="label" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
            {session.name}
          </Text>
        </View>
        <View style={[styles.modeBadge, { backgroundColor: mode.color + '20' }]}>
          <Text variant="labelSmall" color={mode.color}>
            {mode.icon} {mode.label}
          </Text>
        </View>
      </View>

      <View style={styles.meta}>
        <Text variant="bodySmall" color={colors.text.secondary}>
          {session.hostUsername}
        </Text>
        {session.genre ? (
          <Text variant="labelSmall" color={colors.text.muted}>
            · {session.genre}
          </Text>
        ) : null}
        <Text variant="labelSmall" color={colors.text.muted}>
          · {listenerCount} listening
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    marginRight: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.live,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

export default RoomResultCard;
```

**Step 2: Commit**

```bash
git add src/components/search/RoomResultCard.tsx
git commit -m "feat(search): add RoomResultCard with live dot, mode badge, listener count"
```

---

## Task 11: Create PersonResultCard Component

**Files:**
- Create: `src/components/search/PersonResultCard.tsx`

**Step 1: Write the component**

```typescript
/**
 * PersonResultCard — Search result for a user.
 *
 * Non-interactive stub. Shows avatar (deterministic color), username, stats.
 * No navigation, no follow button — deferred per YAGNI.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { MockUser } from '../../types';

/** Deterministic color from username hash */
function avatarColor(username: string): string {
  const palette = [
    '#8B5CF6', '#EC4899', '#F59E0B', '#10B981',
    '#3B82F6', '#EF4444', '#06B6D4', '#F97316',
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

interface PersonResultCardProps {
  user: MockUser;
}

export function PersonResultCard({ user }: PersonResultCardProps) {
  const bg = avatarColor(user.username);

  return (
    <View style={styles.card}>
      {/* Avatar circle */}
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text variant="label" color="#FFFFFF" style={{ fontSize: 16 }}>
          {user.username.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* User info */}
      <View style={styles.info}>
        <Text variant="label" color={colors.text.primary}>
          {user.username}
        </Text>
        <Text variant="labelSmall" color={colors.text.muted}>
          {user.sessionsCount} sessions · {user.tracksAdded} tracks added
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
});

export default PersonResultCard;
```

**Step 2: Commit**

```bash
git add src/components/search/PersonResultCard.tsx
git commit -m "feat(search): add PersonResultCard stub with deterministic avatar color"
```

---

## Task 12: Create AddToRoomSheet Component

**Files:**
- Create: `src/components/search/AddToRoomSheet.tsx`

**Step 1: Write the component**

```typescript
/**
 * AddToRoomSheet — Bottom sheet for adding a track to a live session queue.
 *
 * If user is in a live session → "Add to [Room Name]?" + Confirm → addToQueue()
 * If not in a session → "You're not in a room" + "Browse Rooms"
 */

import React from 'react';
import {
  View, Modal, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Pressable,
} from 'react-native';
import { Text, Button } from '../ui';
import { useActiveSession } from '../../contexts/ActiveSessionContext';
import { addToQueue } from '../../services/socket';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { notifySuccess } from '../../utils/haptics';
import { showToast } from '../ui';
import type { Track, QueueTrack } from '../../types';

interface AddToRoomSheetProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onBrowseRooms: () => void;
}

export function AddToRoomSheet({
  visible,
  track,
  onClose,
  onBrowseRooms,
}: AddToRoomSheetProps) {
  const { activeSession } = useActiveSession();
  const { user } = useAuth();

  const handleConfirm = () => {
    if (!track || !user || !activeSession) return;

    const queueTrack: QueueTrack = {
      ...track,
      addedBy: { userId: user.id, username: user.username },
      addedById: user.id,
      addedAt: new Date().toISOString(),
      votes: 0,
      voltageBoost: 0,
      reactions: [],
    };

    addToQueue(activeSession.sessionId, queueTrack);
    notifySuccess();
    showToast('Added to queue');
    onClose();
  };

  const handleBrowse = () => {
    onClose();
    onBrowseRooms();
  };

  if (!track) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Track preview */}
              <View style={styles.trackPreview}>
                <View style={styles.art}>
                  <Text variant="labelSmall" color={colors.text.muted}>
                    {track.artist.charAt(0)}
                  </Text>
                </View>
                <View style={styles.trackInfo}>
                  <Text variant="label" color={colors.text.primary} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
                    {track.artist}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.divider} />

              {activeSession ? (
                <>
                  <Text variant="body" color={colors.text.primary} align="center" style={styles.prompt}>
                    Add to {activeSession.sessionName}?
                  </Text>
                  <Button
                    title="Add to Queue"
                    onPress={handleConfirm}
                    style={styles.confirmBtn}
                  />
                </>
              ) : (
                <>
                  <Text variant="body" color={colors.text.muted} align="center" style={styles.prompt}>
                    You're not in a room
                  </Text>
                  <Button
                    title="Browse Rooms"
                    onPress={handleBrowse}
                    variant="secondary"
                    style={styles.confirmBtn}
                  />
                </>
              )}

              <Pressable onPress={onClose} style={styles.cancelRow}>
                <Text variant="label" color={colors.text.muted}>Cancel</Text>
              </Pressable>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: spacing.radius.lg,
    borderTopRightRadius: spacing.radius.lg,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  trackPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  art: {
    width: 48,
    height: 48,
    borderRadius: spacing.radius.sm,
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  trackInfo: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  prompt: {
    marginBottom: spacing.md,
  },
  confirmBtn: {
    marginBottom: spacing.sm,
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});

export default AddToRoomSheet;
```

**Step 2: Commit**

```bash
git add src/components/search/AddToRoomSheet.tsx
git commit -m "feat(search): add AddToRoomSheet bottom sheet for add-to-queue from search"
```

---

## Task 13: Create SearchScreen

**Files:**
- Create: `src/screens/SearchScreen.tsx`

**Step 1: Write the screen**

This is the largest file. It handles both idle state (favorites + recent searches) and active state (segmented results).

```typescript
/**
 * SearchScreen — Standalone search tab.
 *
 * Idle: Saved tracks (horizontal scroll) + Recent searches
 * Active: Segmented results (Tracks / Rooms / People)
 *
 * Design ref: SoundCloud search UI — art-forward, clean density.
 * Adapted to Frequen-C's visual language.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Keyboard, Alert,
} from 'react-native';
import { Text, SafeScreen } from '../components/ui';
import { TrackResultCard } from '../components/search/TrackResultCard';
import { RoomResultCard } from '../components/search/RoomResultCard';
import { PersonResultCard } from '../components/search/PersonResultCard';
import { AddToRoomSheet } from '../components/search/AddToRoomSheet';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { searchApi } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { tapLight } from '../utils/haptics';
import type { Track, Session, MockUser, SearchSegment } from '../types';

// ─── Segment Chip ─────────────────────────────────────────────

function SegmentChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        variant="labelSmall"
        color={active ? '#FFFFFF' : colors.text.muted}
      >
        {label}{count !== undefined ? ` (${count})` : ''}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Favorite Card (compact square for horizontal scroll) ─────

function FavoriteCard({
  track,
  onPress,
  onLongPress,
}: {
  track: Track;
  onPress: (track: Track) => void;
  onLongPress: (track: Track) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.favoriteCard}
      onPress={() => onPress(track)}
      onLongPress={() => onLongPress(track)}
      activeOpacity={0.7}
    >
      <View style={styles.favoriteArt}>
        <Text variant="label" color={colors.text.muted} style={{ fontSize: 20 }}>
          {track.artist.charAt(0)}
        </Text>
      </View>
      <Text
        variant="labelSmall"
        color={colors.text.primary}
        numberOfLines={1}
        style={styles.favoriteTitle}
      >
        {track.title}
      </Text>
      <Text
        variant="labelSmall"
        color={colors.text.muted}
        numberOfLines={1}
      >
        {track.artist}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────

interface SearchScreenProps {
  onOpenRoom: (sessionId: string) => void;
  onBrowseRooms: () => void;
}

export function SearchScreen({ onOpenRoom, onBrowseRooms }: SearchScreenProps) {
  const searchInputRef = useRef<TextInput>(null);
  const { favorites, toggleFavorite, isFavorite, removeFavorite } = useFavorites();
  const { searches, addSearch, removeSearch, clearAll } = useRecentSearches();

  // Search state
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [activeSegment, setActiveSegment] = useState<SearchSegment>('tracks');
  const [isSearching, setIsSearching] = useState(false);

  // Results
  const [trackResults, setTrackResults] = useState<Track[]>([]);
  const [roomResults, setRoomResults] = useState<Session[]>([]);
  const [peopleResults, setPeopleResults] = useState<MockUser[]>([]);

  // Add to room sheet
  const [sheetTrack, setSheetTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Debounce ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Search Logic ──────────────────────────────────────
  const executeSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setTrackResults([]);
      setRoomResults([]);
      setPeopleResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Fire all three in parallel
    Promise.all([
      searchApi.tracks(trimmed).catch(() => ({ tracks: [] as Track[] })),
      searchApi.sessions(trimmed).catch(() => ({ sessions: [] as Session[] })),
      searchApi.users(trimmed).catch(() => ({ users: [] as MockUser[] })),
    ]).then(([trackRes, sessionRes, userRes]) => {
      setTrackResults(trackRes.tracks);
      setRoomResults(sessionRes.sessions);
      setPeopleResults(userRes.users);
      setIsSearching(false);

      // Save to recent searches
      addSearch(trimmed, activeSegment);
    });
  }, [addSearch, activeSegment]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!text.trim()) {
      setTrackResults([]);
      setRoomResults([]);
      setPeopleResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    timerRef.current = setTimeout(() => executeSearch(text), 500);
  }, [executeSearch]);

  const handleCancel = useCallback(() => {
    setQuery('');
    setIsActive(false);
    setTrackResults([]);
    setRoomResults([]);
    setPeopleResults([]);
    setIsSearching(false);
    Keyboard.dismiss();
  }, []);

  const handleRecentTap = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
    setIsActive(true);
    executeSearch(recentQuery);
  }, [executeSearch]);

  const handleAddToRoom = useCallback((track: Track) => {
    setSheetTrack(track);
    setSheetVisible(true);
  }, []);

  const handleFavoriteLongPress = useCallback((track: Track) => {
    Alert.alert(
      'Remove Favorite',
      `Remove "${track.title}" from saved tracks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeFavorite(track.id),
        },
      ]
    );
  }, [removeFavorite]);

  // ─── Idle State ────────────────────────────────────────
  const hasResults = query.trim().length > 0;

  const renderIdleState = () => (
    <ScrollView
      style={styles.idleScroll}
      contentContainerStyle={styles.idleContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Favorites Section */}
      {favorites.length > 0 && (
        <View style={styles.section}>
          <Text variant="label" color={colors.text.primary} style={styles.sectionTitle}>
            ♡ Your Saved Tracks ({favorites.length})
          </Text>
          <FlatList
            horizontal
            data={favorites}
            keyExtractor={(item) => item.track.id}
            renderItem={({ item }) => (
              <FavoriteCard
                track={item.track}
                onPress={handleAddToRoom}
                onLongPress={handleFavoriteLongPress}
              />
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoritesRow}
          />
        </View>
      )}

      {favorites.length === 0 && (
        <View style={styles.emptyFavorites}>
          <Text variant="body" color={colors.text.muted} align="center">
            Tracks you save will show up here.
          </Text>
        </View>
      )}

      {/* Recent Searches */}
      {searches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.recentHeader}>
            <Text variant="label" color={colors.text.primary}>
              Recent Searches
            </Text>
            <TouchableOpacity onPress={clearAll}>
              <Text variant="labelSmall" color={colors.text.muted}>Clear All</Text>
            </TouchableOpacity>
          </View>
          {searches.map((s) => (
            <TouchableOpacity
              key={s.query + s.timestamp}
              style={styles.recentItem}
              onPress={() => handleRecentTap(s.query)}
              activeOpacity={0.7}
            >
              <Text variant="body" color={colors.text.secondary} style={{ flex: 1 }}>
                {s.query}
              </Text>
              <TouchableOpacity
                onPress={() => removeSearch(s.query)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text variant="labelSmall" color={colors.text.muted}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // ─── Active State (Results) ────────────────────────────
  const renderActiveState = () => (
    <View style={styles.activeContainer}>
      {/* Segment Chips */}
      <View style={styles.segmentRow}>
        <SegmentChip
          label="Tracks"
          count={trackResults.length}
          active={activeSegment === 'tracks'}
          onPress={() => setActiveSegment('tracks')}
        />
        <SegmentChip
          label="Rooms"
          count={roomResults.length}
          active={activeSegment === 'rooms'}
          onPress={() => setActiveSegment('rooms')}
        />
        <SegmentChip
          label="People"
          count={peopleResults.length}
          active={activeSegment === 'people'}
          onPress={() => setActiveSegment('people')}
        />
      </View>

      {/* Loading */}
      {isSearching && (
        <ActivityIndicator
          color={colors.action.primary}
          style={{ marginVertical: spacing.md }}
        />
      )}

      {/* Track Results */}
      {activeSegment === 'tracks' && !isSearching && (
        <FlatList
          data={trackResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TrackResultCard
              track={item}
              isFavorite={isFavorite(item.id)}
              onToggleFavorite={toggleFavorite}
              onAddToRoom={handleAddToRoom}
            />
          )}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="body" color={colors.text.muted} align="center" style={{ paddingTop: spacing.xl }}>
                No tracks found
              </Text>
            ) : null
          }
        />
      )}

      {/* Room Results */}
      {activeSegment === 'rooms' && !isSearching && (
        <FlatList
          data={roomResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RoomResultCard session={item} onPress={onOpenRoom} />
          )}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="body" color={colors.text.muted} align="center" style={{ paddingTop: spacing.xl }}>
                No rooms found
              </Text>
            ) : null
          }
        />
      )}

      {/* People Results */}
      {activeSegment === 'people' && !isSearching && (
        <FlatList
          data={peopleResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PersonResultCard user={item} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.trim() ? (
              <Text variant="body" color={colors.text.muted} align="center" style={{ paddingTop: spacing.xl }}>
                No people found
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );

  return (
    <SafeScreen>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchBarRow}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search tracks, rooms, people..."
            placeholderTextColor={colors.text.muted}
            value={query}
            onChangeText={handleQueryChange}
            onFocus={() => setIsActive(true)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isActive && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <Text variant="label" color={colors.text.muted}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {isActive && hasResults ? renderActiveState() : renderIdleState()}

        {/* Add to Room Sheet */}
        <AddToRoomSheet
          visible={sheetVisible}
          track={sheetTrack}
          onClose={() => setSheetVisible(false)}
          onBrowseRooms={onBrowseRooms}
        />
      </View>
    </SafeScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Search bar
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: colors.bg.input,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.inputPadding,
    color: colors.text.primary,
    fontSize: 15,
  },
  cancelBtn: {
    paddingVertical: spacing.xs,
  },

  // Segment chips
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.bg.elevated,
  },
  chipActive: {
    backgroundColor: colors.action.primary,
  },

  // Idle state
  idleScroll: {
    flex: 1,
  },
  idleContent: {
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing['3xl'],
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  favoritesRow: {
    gap: spacing.sm,
  },
  emptyFavorites: {
    paddingVertical: spacing['2xl'],
  },

  // Favorite card (compact square)
  favoriteCard: {
    width: 120,
    marginRight: 0, // gap handled by FlatList contentContainerStyle
  },
  favoriteArt: {
    width: 120,
    height: 120,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  favoriteTitle: {
    marginBottom: 1,
  },

  // Recent searches
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },

  // Active state
  activeContainer: {
    flex: 1,
  },
});

export default SearchScreen;
```

**Step 2: Commit**

```bash
git add src/screens/SearchScreen.tsx
git commit -m "feat(search): add SearchScreen with idle/active states, segmented results, favorites"
```

---

## Task 14: Update Screen Barrel Exports

**Files:**
- Modify: `src/screens/index.ts`

**Step 1: Add SearchScreen export**

Add after the `SessionRoomScreen` export:
```typescript
export { SearchScreen } from './SearchScreen';
```

**Step 2: Commit**

```bash
git add src/screens/index.ts
git commit -m "feat(search): export SearchScreen from barrel"
```

---

## Task 15: Wire Search Tab into AppNavigator

**Files:**
- Modify: `src/navigation/AppNavigator.tsx`

**Step 1: Add SearchScreen import**

Add to the Screens import block:
```typescript
import { SearchScreen } from '../screens/SearchScreen';
```

**Step 2: Add Search to TabParamList**

```typescript
type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Search: undefined;      // ← ADD
  Profile: undefined;
};
```

**Step 3: Add Search icon to TabIcon**

Update the `icons` record inside `TabIcon`:
```typescript
const icons: Record<string, string> = {
  Home: '⬡',
  Discover: '◎',
  Search: '⌕',        // ← ADD
  Profile: '◉',
};
```

**Step 4: Add Search Tab.Screen**

Insert the Search tab between Discover and Profile in `TabNavigator`:

```typescript
      <Tab.Screen name="Search" options={{ tabBarLabel: 'SEARCH' }}>
        {(props) => (
          <SearchScreen
            onOpenRoom={(sessionId: string) =>
              props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
            }
            onBrowseRooms={() => props.navigation.navigate('Discover')}
          />
        )}
      </Tab.Screen>
```

Place this between the `</Tab.Screen>` of Discover and the `<Tab.Screen name="Profile"`.

**Step 5: Commit**

```bash
git add src/navigation/AppNavigator.tsx
git commit -m "feat(search): wire Search as 4th bottom tab in AppNavigator"
```

---

## Task 16: Verification & Smoke Test

**Step 1: Check for import errors**

```bash
cd /path/to/Frequen-C-Mobile
npx tsc --noEmit 2>&1 | head -50
```

Fix any TypeScript errors that appear. Common issues:
- Missing `showToast` import in `AddToRoomSheet` — if `showToast` is not exported from `../ui`, replace with `console.log('Added to queue')` or use `Alert.alert`.
- `Button` variant prop — if `variant="secondary"` is not supported by the existing Button component, remove it.

**Step 2: Verify file count**

New files (8):
1. `src/screens/SearchScreen.tsx`
2. `src/hooks/useFavorites.ts`
3. `src/hooks/useRecentSearches.ts`
4. `src/components/search/TrackResultCard.tsx`
5. `src/components/search/RoomResultCard.tsx`
6. `src/components/search/PersonResultCard.tsx`
7. `src/components/search/AddToRoomSheet.tsx`
8. `src/contexts/ActiveSessionContext.tsx`

Modified files (5):
1. `src/types/index.ts`
2. `src/services/mockData.ts`
3. `src/services/api.ts`
4. `src/screens/index.ts`
5. `src/navigation/AppNavigator.tsx`
6. `App.tsx`
7. `src/screens/SessionRoomScreen.tsx`

**Step 3: Visual verification (when Expo is running)**

1. App loads → 4 tabs visible: HOME, DISCOVER, SEARCH, PROFILE
2. Tap SEARCH → idle state shows "Tracks you save will show up here."
3. Tap search bar → keyboard opens, cancel button appears
4. Type "frank" → loading spinner → segment chips appear with counts → track results show
5. Tap ♡ on a track → heart fills (favorite saved)
6. Tap ＋ on a track → AddToRoomSheet opens → "You're not in a room"
7. Cancel back to idle → favorites section shows the saved track
8. Go to a room → come back to Search → tap ＋ → sheet says "Add to [Room Name]?"

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(search): complete Search Screen feature — segmented search, favorites, add-to-queue"
```

---

## Summary

| Task | What | Files | Est. Time |
|------|------|-------|-----------|
| 1 | Add types | types/index.ts | 3 min |
| 2 | Mock users | mockData.ts | 3 min |
| 3 | Search API | api.ts | 5 min |
| 4 | useFavorites | new hook | 5 min |
| 5 | useRecentSearches | new hook | 4 min |
| 6 | ActiveSessionContext | new context | 4 min |
| 7 | Wire provider | App.tsx | 2 min |
| 8 | Wire session context | SessionRoomScreen.tsx | 3 min |
| 9 | TrackResultCard | new component | 5 min |
| 10 | RoomResultCard | new component | 4 min |
| 11 | PersonResultCard | new component | 3 min |
| 12 | AddToRoomSheet | new component | 5 min |
| 13 | SearchScreen | new screen | 10 min |
| 14 | Barrel exports | screens/index.ts | 1 min |
| 15 | Navigation wiring | AppNavigator.tsx | 5 min |
| 16 | Verification | all files | 5 min |
| **Total** | | **8 new + 7 modified** | **~67 min** |
