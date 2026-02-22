# Frequen-C UX Redesign: Room View + Navigation
## Approach C — Hybrid (Spec Layout + Selective Frequen-C Additions)

**Date:** 2026-02-22
**Author:** Caleb Ruble / Claude (pair session)
**Approved approach:** C (Hybrid) — match Convergence Strategy spec layout, relocate unique features to progressive disclosure layers.
**Reference:** `_FREQUEN_C_APP/UI-UX/2026-02-20_FrequenC_UX_Convergence_Strategy_v01.md`

---

## 1. Problem Statement

The current `SessionRoomScreen` (~1685 lines) displays everything at once: Signal Path breadcrumb, CV economy bar, "Filter sweep" search, waveform mode indicator, Step Sequencer grid, and Signal Chain queue — all above the fold. User feedback: "too cluttered/busy, don't know what half the stuff is for."

The navigation uses audio engineering jargon (Patch Bay, Flight Cases, Patch In) that doesn't map to any pattern from the 11 apps analyzed in the Convergence Strategy.

---

## 2. Navigation Redesign

### Current → Proposed

| Current | Proposed | Why |
|---------|----------|-----|
| `PATCH BAY` tab | **Home** | Universal. Every app uses "Home." §1.1 |
| `FLIGHT CASES` tab | **Library** | Industry standard. Spotify, SoundCloud, TIDAL, YouTube Music all say "Library." §1.1 |
| `PROFILE` tab | **Profile → header avatar** | Profile becomes an icon button in the Home header, not a tab. Frees up a tab slot. §5 |
| `PATCH IN` FAB (bottom-right) | **Discover tab + center `[+]` button** | Split dual-purpose FAB into two clear affordances. §1.1, §5 |

### New Tab Bar

```
[ Home ]  [ Discover ]  [ (+) ]  [ Library ]
```

- **Home** — Active session banner (if in room), recent rooms, friend activity
- **Discover** — Browse public rooms, trending, genre/mood filters (currently the "Live Grid" section of PatchBayScreen)
- **[+] Create** — Center-elevated button (44×44pt circle, `palette.ice`). Opens CreateSession modal. §1.1 spec: "Create — Elevated CTA"
- **Library** — Your rooms, saved tracks, connected services, queue history (currently FlightCasesScreen content)

### Tab Param Types (updated)

```typescript
type TabParamList = {
  Home: undefined;       // was PatchBay
  Discover: undefined;   // new — extracted from PatchBay "Live Grid"
  Library: undefined;    // was FlightCases
};
```

### Files Changed

| File | Change |
|------|--------|
| `AppNavigator.tsx` | Rename tabs, add Discover tab, move Profile to header, replace FAB with center create button |
| `PatchBayScreen.tsx` → `HomeScreen.tsx` | Rename. Keep "Your Signal Chain" (my rooms). Move "Live Grid" to DiscoverScreen |
| New: `DiscoverScreen.tsx` | Extract public room browsing from PatchBayScreen |
| `FlightCasesScreen.tsx` → keep file | Just rename tab label to "Library" |

### Tab Icons (spec §9: outline stroke, lucide/phosphor style)

| Tab | Icon | Active | Inactive |
|-----|------|--------|----------|
| Home | `home-outline` / `home` | `#00E5FF` | `#5A6680` |
| Discover | `compass-outline` / `compass` | `#00E5FF` | `#5A6680` |
| [+] Create | Plus in 44pt circle | `#06080F` on `#00E5FF` bg | — |
| Library | `library-outline` / `library` | `#00E5FF` | `#5A6680` |

---

## 3. Session Room Redesign

### Design Principle

The room IS a full-screen player (like Spotify's Now Playing). The queue is a pull-up bottom sheet, not an inline list. Everything else is progressive disclosure.

### New Layout (top → bottom)

```
┌─────────────────────────────────────────────────┐
│ [← Back]   Room Name   [🔥 Campfire]   [⋯]     │  ← Header
├─────────────────────────────────────────────────┤
│ [ 👤 👤 👤 +12 ]  "16 listening"  [Invite]       │  ← Participant bar
├─────────────────────────────────────────────────┤
│                                                 │
│              ┌─────────────────┐                │
│              │                 │                │
│              │   Album Art     │                │  ← Hero (device width - 48pt)
│              │   (dynamic      │                │     Dynamic gradient bg
│              │    gradient bg) │                │
│              │                 │                │
│              └─────────────────┘                │
│                                                 │
│         Track Title                             │  ← 22pt bold frost
│         Artist Name · Added by @user            │  ← 16pt silver
│                                                 │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░  2:34 / 4:01      │  ← Progress bar
│                                                 │
│         [⏮]     [ ▶ / ⏸ ]     [⏭]              │  ← Transport
│                                                 │
│    [🔥]   [❤️]   [👏]   [😂]   [💀]              │  ← Reaction bar
│                                                 │
│  ── Up Next ───────────────── [⚡ 50 CV] ──────  │  ← Queue peek + CV pill
│  │ [art] Next Track Title          [⋯] │        │
│  │       Artist Name                    │        │
│  └──────────────────── Pull up for full queue ──┘
│                                                 │
└─────────────────────────────────────────────────┘
```

### Section-by-Section Spec

#### 3.1 Header

```
[← Back]   Room Name   [🔥 Campfire]   [⋯]
```

- **← Back**: Chevron icon, navigates to previous screen. Replaces SignalPathBreadcrumb.
- **Room Name**: 18pt bold `frost`. Single line, truncate.
- **Mode Badge**: Room mode pill per §3.1 (🔥 Campfire `#FF6B35`, 🎤 Spotlight `#FF2D55`, ⚡ Open Floor `#C0DFFF`). Tap (host only) → mode switch Alert.
- **⋯ Overflow**: Opens bottom sheet with: Share (link/QR), Copy Code, Chat, Lyrics, Settings, Leave/End Room.

**What's removed from header:** Join code pill (→ overflow menu), listener bar (→ participant bar below), waveform icon (→ mode badge replaces it), 4 separate action buttons (→ single ⋯).

#### 3.2 Participant Bar (NEW — spec §3.2)

```
[ 👤 👤 👤 👤 +12 ]  "16 listening"  [ Invite ]
```

- Avatar circles: 28pt, stacked with 8pt overlap
- Max 4 visible + "+N" counter
- "N listening" label: 14pt `silver`
- Invite button: `palette.ice` outline pill, 32pt height
- Tap avatar → ListenerDrawer (existing component)

**Replaces:** The inline ListenerBar that was crammed into the header title row.

#### 3.3 Album Art Hero (spec §1.5, §1.7)

- Large album art: device width - 48pt, 8pt corner radius, centered
- Background: Dynamic gradient extracted from album art (spec §2.4). Use `react-native-image-colors` if available, else static `palette.void` gradient.
- If no track playing: Show room mode waveform icon as placeholder (large, centered, muted)

**Replaces:** Step Sequencer + "No signal in the chain" empty state.

#### 3.4 Track Info

- Title: 22pt bold `frost`, centered
- Artist: 16pt `silver`, centered
- "Added by @username": 12pt `slate`, centered (only in session context — spec §4.1)

#### 3.5 Progress Bar

- 2pt height, `palette.ice` filled, `palette.darkSteel` track
- Time labels: 12pt `slate`, left = elapsed, right = remaining
- Scrubber dot on touch (if playback engine supports seeking)

#### 3.6 Transport Controls (spec §1.5)

```
[⏮]     [ ▶ / ⏸ ]     [⏭]
```

- Play/Pause: 56pt circle, `frost` icon on `ice` background
- Previous/Next: 24pt icons, `frost`
- Spotlight mode: Only host sees skip controls (spec §1.5)
- Open Floor mode: Skip triggers vote (existing behavior, kept)

#### 3.7 Reaction Bar (spec §3.3)

```
[🔥]   [❤️]   [👏]   [😂]   [💀]
```

- 5 emoji buttons, 44pt touch targets, evenly spaced
- Tap → float animation upward (spec §7: 1500ms ease-out, scale 1→1.2→0, fade)
- Positioned below transport, above queue peek

#### 3.8 Queue Peek + CV Pill

This is the bridge between the player view and the queue.

```
── Up Next ──────────────────── [⚡ 50 CV] ──
│ [48×48 art] Next Track Title        [⋯]  │
│             Artist Name                   │
└────────── Pull up for full queue ─────────┘
```

- "Up Next" label: 10pt `silver`, caps, left-aligned
- **CV Pill** (right side): Small `⚡ {balance} CV` pill badge. `palette.ice` text on `palette.gunmetal` bg. Tap → expands to show power moves:
  - Phase Cancel (15 CV) — Block next skip
  - Phantom Power (5 CV) — Boost a track
  - Overdrive (25 CV) — Force to top
- Next track card: 72pt height per spec §4.1. Shows album art, title, artist, ⋯ menu.
- "Pull up for full queue" hint: 12pt `slate`, centered below the peek card
- **Swipe up / tap "Up Next"** → opens full Queue Bottom Sheet

#### 3.9 Queue Bottom Sheet (NEW)

Replaces the inline DraggableQueue. Uses standard bottom sheet pattern (spec §4.5).

- Background: `palette.midnight`
- Top corners: 16pt radius
- Drag handle: 36×4pt centered
- Max height: 85% screen (anti-pattern #7)
- Contains:
  - "Add track" search button at top (ice outline pill) — opens search overlay
  - Now Playing indicator (first item, highlighted)
  - DraggableQueue (existing component, reused)
  - Suggestions panel (Spotlight mode, host only — existing)
  - Played History (existing component, at bottom)
- Dismiss: Swipe down or tap backdrop

The search that was "Filter sweep..." on the main view moves INSIDE this sheet as an "Add track" action.

### What Gets Removed

| Element | Disposition |
|---------|-------------|
| **SignalPathBreadcrumb** | Replaced by simple ← Back button |
| **CV Economy Bar** (full-width) | Replaced by small CV pill in queue peek area |
| **"Filter sweep..." search bar** | Moved inside Queue Bottom Sheet as "Add track" button |
| **Waveform mode indicator** (full row: "DEMOCRATIC — VOTES REORDER") | Replaced by compact mode badge in header |
| **Step Sequencer** | Removed entirely. Anti-pattern #8: "No audio waveforms in the main player." Queue count is sufficient. |
| **"SIGNAL CHAIN" label** | Replaced by "Up Next" (universal term) |
| **Inline queue list** | Moved to Queue Bottom Sheet |

### What Gets Relocated

| Element | From | To |
|---------|------|----|
| CV balance | Full-width bar below header | Small pill in queue peek row |
| Phase Cancel button | CV bar | CV pill expansion |
| Power moves (Overdrive, Phantom) | Context menu | CV pill expansion + context menu |
| Search | Always-visible input | "Add track" button inside Queue Sheet |
| Chat toggle | Header action button | ⋯ overflow menu |
| Lyrics toggle | Header action button | ⋯ overflow menu |
| Share | Header action button | ⋯ overflow menu |
| Leave/End | Header action button | ⋯ overflow menu |
| Join code | Header pill | ⋯ overflow menu "Copy Code" |
| Listener count | Header title row | Participant bar (dedicated row) |

### What Stays As-Is

| Element | Notes |
|---------|-------|
| MiniPlayer | Stays at bottom when navigating away. Spec §1.4. |
| NowPlayingSheet | Already matches spec §1.5 anatomy. No changes needed. |
| ChatPanel | Overlay — untouched. Accessed from ⋯ menu. |
| CrossfaderDuel | Overlay — untouched. Server-triggered. |
| FrequencyForecast | Overlay — untouched. Server-triggered. |
| ResonanceEvent | Overlay — untouched. Server-triggered. |
| TransientEnter | Overlay — untouched. Animation only. |
| ReverbTail | Overlay — untouched. Animation only. |
| MasterBounce | Overlay — untouched. Session end receipt. |
| TrackContextMenu | Overlay — untouched. Long-press triggered. |
| ListenerDrawer | Overlay — untouched. Accessed from participant bar. |
| QR Code modal | Overlay — untouched. Accessed from ⋯ menu. |
| LyricsOverlay | Overlay — untouched. Accessed from ⋯ menu. |
| OfflineBanner | Stays. Connection status matters. |
| ConnectionBanner | Stays. |

---

## 4. Jargon Translation Table

All user-facing labels change. Internal code names (component file names, function names) can stay.

| Current (jargon) | New (universal) | Context |
|-------------------|-----------------|---------|
| Patch Bay | Home | Tab label |
| Flight Cases | Library | Tab label |
| Patch In | Create / Join | FAB → center button + Discover tab |
| Signal Chain | Up Next / Queue | Queue section label |
| Filter sweep | Search / Add track | Search input placeholder |
| Step Sequencer | *(removed)* | — |
| Signal Path | *(removed)* | Breadcrumb eliminated |
| CV | CV *(keep)* | Unique to Frequen-C, but explained on first encounter |
| Phase Cancel | Phase Cancel *(keep)* | Power move — in-context explanation |
| Overdrive | Overdrive *(keep)* | Power move — in-context explanation |
| Phantom Power | Phantom Power *(keep)* | Power move — in-context explanation |
| Sine / Square / Sawtooth | Campfire / Spotlight / Open Floor | Mode names (waveform labels were internal, user sees mode names) |
| No signal in the chain | Queue is empty — add a track | Empty state |

CV/power move names stay because they ARE the game mechanic branding. But they're no longer top-level, so users discover them in context rather than being confronted with them immediately.

---

## 5. Implementation Order

### Phase 1: Navigation (low risk, high impact)
1. Rename `PatchBay` tab → `Home`, `FlightCases` → `Library`
2. Replace custom SVG tab icons with Ionicons outline variants
3. Remove PatchInFAB, add center Create button
4. Move Profile from tab to header avatar button
5. Split PatchBayScreen into HomeScreen + DiscoverScreen
6. Add Discover tab

### Phase 2: Room Header + Participant Bar
1. Replace SignalPathBreadcrumb with ← Back chevron
2. Simplify header: Room Name + Mode Badge + ⋯ overflow
3. Build ⋯ overflow bottom sheet (Chat, Lyrics, Share, Code, Leave)
4. Add Participant Bar component (avatars + count + invite)

### Phase 3: Player-First Layout
1. Add album art hero area with dynamic gradient
2. Add track info (title, artist, added by)
3. Add progress bar + transport controls
4. Add reaction bar
5. Add "Up Next" queue peek with CV pill

### Phase 4: Queue Bottom Sheet
1. Extract inline queue into a bottom sheet component
2. Move search inside the sheet as "Add track" button
3. Wire DraggableQueue into the sheet
4. Wire Suggestions panel (Spotlight) into the sheet
5. Wire Played History into the sheet

### Phase 5: Cleanup
1. Remove Step Sequencer from room (keep component for potential future use)
2. Remove inline CV bar
3. Remove "Filter sweep" search from main view
4. Remove mode indicator full row
5. Delete dead code paths
6. Fix SpotifyAdapter getStreamUrl silent fallback to iTunes previews

---

## 6. Risk Assessment

| Risk | Mitigation |
|------|------------|
| Bottom sheet performance with large queues | Use `@gorhom/bottom-sheet` or similar. Lazy render queue items. |
| Dynamic gradient extraction dependency | Graceful fallback to static `palette.void` gradient if library unavailable |
| CV pill discoverability drops | Add tooltip/pulse animation on first visit. CV balance also visible in Profile. |
| Step Sequencer removal disappoints power users | It's only been seen with 2 tracks in testing. Revisit as opt-in "visualizer" once queue sizes are larger. |
| Breaking existing socket/event handlers | All handlers stay in SessionRoomScreen — only the render tree changes. Logic layer untouched. |

---

## 7. Success Criteria

Per Convergence Strategy §12 Validation Checklist:

- [ ] Spotify user recognizes the navigation pattern (4 tabs, bottom bar)
- [ ] Any streaming user immediately understands the room is a "player" view
- [ ] Queue is one gesture away (swipe up or tap "Up Next")
- [ ] Album art is the visual hero, not a grid of empty boxes
- [ ] CV economy is accessible but doesn't compete with core playback
- [ ] Mode badge communicates room behavior without a full row of text
- [ ] All touch targets ≥ 44pt
- [ ] Room can be used with zero explanation of jargon
