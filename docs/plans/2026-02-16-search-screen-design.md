# Search Screen Design

**Date:** 2026-02-16
**Status:** Approved
**Approach:** Segmented Search (Approach A) — unified search + favorites-when-idle on a dedicated 4th tab

---

## Goal

Complete the core loop: discover a room → join → **find a song → add it** → watch it play. Currently, search only exists inline inside session rooms. This adds a standalone Search tab for finding tracks, rooms, and people across the entire app, plus a personal favorites library.

## Architecture

A new 4th bottom tab (Search, magnifying glass icon) between Discover and Profile. Two screen modes: **idle** (favorites + recent searches) and **active** (segmented results for Tracks/Rooms/People). Track results have two actions: favorite (♡) and add-to-queue (＋). Add-to-queue connects to the existing socket-based queue system via a new `ActiveSessionContext` that tracks whether the user is currently in a room.

SoundCloud's search UI is the primary design reference — art-forward, horizontal favorites, clean result density — adapted to Frequen-C's visual language.

## Research Pillar Connection

- **Contribution Visibility** — Search enables intentional track selection, making "who added what" more meaningful
- **Social Choice Architecture** — Add-to-queue from search respects room mode (Spotlight = pending approval, Open Floor = direct add)

---

## Screen Layout

### Idle State (no query)

```
┌─────────────────────────────┐
│  🔍  Search tracks, rooms...│  ← Search bar (auto-focus off)
├─────────────────────────────┤
│  ♡ Your Saved Tracks (N)    │  ← Section header
│  ┌───┐ ┌───┐ ┌───┐         │
│  │art│ │art│ │art│          │  ← Horizontal scroll, compact cards
│  │ttl│ │ttl│ │ttl│          │
│  └───┘ └───┘ └───┘         │
├─────────────────────────────┤
│  🕐 Recent Searches         │  ← Last 10 queries, tap to re-search
│  frank ocean                │
│  campfire rooms             │
│  maya                       │
└─────────────────────────────┘
```

Empty favorites: *"Tracks you save will show up here."*
Empty recent: section hidden entirely.

### Active State (typing/results)

```
┌─────────────────────────────┐
│  🔍  frank ocean    ✕ Cancel│  ← Active input + cancel
├─────────────────────────────┤
│ [Tracks (5)] [Rooms (2)] [People (1)] │  ← Segment chips
├─────────────────────────────┤
│  🎵 Nights                  │
│     Frank Ocean · Blonde    │
│     5:06 · Spotify     ♡ ＋│
│  🎵 Self Control            │
│     Frank Ocean · Blonde    │
│     4:09 · Spotify     ♡ ＋│
└─────────────────────────────┘
```

Segment chips: pill-shaped, one active at a time. Active = `colors.primary` fill + white text. Inactive = ghost. Result counts shown when loaded.

---

## Component Breakdown

### Track Result Card
- Album art left (48x48, 8px radius)
- Title bold, artist + album secondary, duration + source icon tertiary
- ♡ toggles favorite (solid fill on save, haptic `tapLight`)
- ＋ opens AddToRoomSheet

### Room Result Card
- Reuses Discover card patterns (live dot, listener count, mode badge)
- Taps navigate to SessionRoomScreen

### Person Result Card
- Avatar circle (deterministic hash color)
- Stats: sessions count + tracks added
- Non-interactive for now (no navigation, no follow button). Stub.

### AddToRoomSheet (bottom sheet)
- **If user is in a live session:** "Add to **[Room Name]**?" + Confirm button → `addToQueue()` via socket → toast "Added to queue" → haptic `notifySuccess`
- **If not in a session:** "You're not in a room" + "Browse Rooms" button → navigates to Discover

### Favorites Section (idle)
- Horizontal scroll of compact square cards (album art + title underneath)
- Tap opens same AddToRoomSheet as search results
- Long-press to remove from favorites (confirm alert)

### Recent Searches
- Simple list of past query strings
- Stored in AsyncStorage (last 10)
- Tap re-runs search with that query
- Swipe-to-delete individual entries
- "Clear All" link in section header

---

## Data Flow

### New Types

```typescript
interface FavoriteTrack {
  track: Track;
  savedAt: string; // ISO
}

interface RecentSearch {
  query: string;
  timestamp: string;
  segment: 'tracks' | 'rooms' | 'people';
}
```

### Search Flow

1. User types → `useSearch` hook (existing, 500ms debounce)
2. Tracks: existing `searchApi.tracks(query)`
3. Rooms: new `searchApi.sessions(query)` — filters by name/genre/host
4. People: new `searchApi.users(query)` — mock layer, filtered user list
5. All three fire in parallel on query change

### Favorites Persistence

- `AsyncStorage` key: `frequenc_favorites`
- New `useFavorites` hook: `{ favorites, addFavorite, removeFavorite, isFavorite(trackId) }`
- Optimistic UI — heart fills instantly, persist async
- Cap: ~500 local (backend takes over later)

### Active Session Awareness

- New `ActiveSessionContext` — tracks `{ sessionId, sessionName } | null`
- Set on `SessionRoomScreen` mount, cleared on leave/unmount
- Read by `AddToRoomSheet` to determine which UI to show

---

## File Plan

### New Files (8)

| File | Purpose |
|---|---|
| `src/screens/SearchScreen.tsx` | Main search screen |
| `src/hooks/useFavorites.ts` | AsyncStorage favorites CRUD |
| `src/hooks/useRecentSearches.ts` | AsyncStorage search history |
| `src/components/search/TrackResultCard.tsx` | Track card with ♡ and ＋ |
| `src/components/search/RoomResultCard.tsx` | Room card (reuses Discover patterns) |
| `src/components/search/PersonResultCard.tsx` | User card (stub, non-interactive) |
| `src/components/search/AddToRoomSheet.tsx` | Bottom sheet for add-to-queue |
| `src/contexts/ActiveSessionContext.tsx` | Tracks current session membership |

### Modified Files (5)

| File | Change |
|---|---|
| `src/navigation/AppNavigator.tsx` | Add Search as 4th tab (magnifying glass icon) |
| `src/screens/SessionRoomScreen.tsx` | Set/clear ActiveSessionContext on join/leave |
| `src/services/api.ts` | Add `searchApi.sessions()` and `searchApi.users()` |
| `src/services/mockData.ts` | Add `mockUsers` array for people search |
| `src/types/index.ts` | Add `FavoriteTrack`, `RecentSearch`, update `MainTabParamList` |

---

## Out of Scope (YAGNI)

- Track preview/playback outside sessions
- "Rooms playing this track" cross-session index
- Person profile navigation (People cards are non-interactive stubs)
- Follow button functionality
- Infinite scroll/pagination (mock data is small)
- Search filters/sorting beyond segment switch
- Custom tab bar icons (placeholder until brand is finalized)
