# Frequen-C App Features Assessment
**Date:** 2026-02-22
**Source:** `Frequen-C_App-Features_UPDATE.pdf` (22 pages)
**Purpose:** Assess every feature for validity and implementation feasibility, identify what to fold into the active Phase 2-5 UX redesign to avoid rework.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ BUILT | Component/logic exists in codebase |
| 🔧 PHASE 2-5 | Should integrate into current UX redesign work |
| 📋 POST-LAUNCH | Valid feature, defer to after DESN 374 deadline |
| ❌ CUT | Not viable or low ROI for current scope |

---

## 1. CORE SESSION MECHANICS

### 1.1 Room Modes (Campfire / Spotlight / Open Floor)
**Status:** ✅ BUILT — `queueEngine.ts` (95/95 tests passing)

| Mode | Queue Behavior | Implementation |
|------|---------------|----------------|
| 🔥 Campfire | Round-robin interleave, cosmetic votes, anyone skips | ✅ Complete |
| 🎤 Spotlight | Host→queue, non-host→suggested, host approves/rejects, host-only skip | ✅ Complete |
| ⚡ Open Floor | Append, votes reorder (tiebreak: addedAt), anyone skips | ✅ Complete |

**Assessment:** Fully implemented. Mode selection at room creation works. The PDF describes exactly what we built. No changes needed.

### 1.2 CV Economy (Control Voltage)
**Status:** ✅ BUILT (mock) — CV state managed in `SessionRoomScreen.tsx`

| Action | CV Reward | Implementation |
|--------|-----------|----------------|
| Add track to queue | +2 CV | ✅ Mock logic in room |
| Vote on a track | +1 CV | ✅ Mock logic in room |
| Complete a full track | +5 CV | ✅ Mock logic in room |
| Create a session | +3 CV | ✅ Mock logic |

**🔧 PHASE 3 action:** CV display moves from full-width bar to small pill in queue peek area (per UX redesign spec §3.8). Already in the plan — no new work, just the relocation during Phase 3.

### 1.3 Power Moves
**Status:** ✅ BUILT (components exist)

| Move | Cost | Effect | Component |
|------|------|--------|-----------|
| Overdrive | 25 CV | Force track to top of queue | ✅ Context menu action |
| Phase Cancel | 15 CV | Block next skip | ✅ `PhantomPower.tsx` handles |
| Phantom Power | 5 CV | Boost a track's vote count | ✅ `PhantomPower.tsx` |

**🔧 PHASE 3 action:** Power moves relocate from top-level CV bar to the CV pill expansion (tap CV pill → see power move options). Already in redesign plan.

### 1.4 Crossfader Duel
**Status:** ✅ BUILT — `CrossfaderDuel.tsx`
1v1 track battle. Two tracks, listeners vote, winner stays. Server-triggered overlay.

**Assessment:** Component exists and is an overlay — untouched by the room redesign. No action needed.

### 1.5 Frequency Forecast
**Status:** ✅ BUILT — `FrequencyForecast.tsx`
AI-powered track prediction. Server-triggered overlay.

**Assessment:** Overlay, untouched by redesign. The PDF describes this as predicting "what the room wants to hear next" based on listening patterns. Currently a mock/placeholder. The real ML would be post-launch.

**📋 POST-LAUNCH:** Real prediction algorithm. Current mock is fine for DESN 374 demo.

---

## 2. SOCIAL FEATURES

### 2.1 Participant Avatars + Listener Count
**Status:** ✅ BUILT — `ParticipantAvatarBar.tsx`, `ListenerPresence.tsx`

**🔧 PHASE 2 action:** `ParticipantAvatarBar` gets promoted to its own row below the header (per redesign spec §3.2). Currently it's crammed into the header. This is already in the Phase 2 plan.

### 2.2 Reactions (Emoji Bar)
**Status:** ✅ BUILT — `ReactionBar.tsx`, `FloatingReaction.tsx`

5 emoji buttons (🔥 ❤️ 👏 😂 💀) with float-up animation.

**🔧 PHASE 3 action:** Reaction bar moves below transport controls in the new player-first layout. Already in plan.

### 2.3 Friend System / Social Graph
**Status:** ❌ NOT BUILT

The PDF describes adding friends, seeing their activity, inviting to rooms.

**📋 POST-LAUNCH.** Requires:
- Friend request/accept/decline API endpoints
- Friends list UI in Profile
- "Friends listening" section on Home
- Push notifications for friend activity

**Why defer:** No backend social graph tables exist. This is a full feature vertical (DB schema, API, UI, notifications). Not needed for DESN 374 demo — room codes and QR sharing handle invites.

### 2.4 Activity Feed
**Status:** ❌ NOT BUILT

The PDF shows a feed of "X joined Y's room", "X added Z track", etc.

**📋 POST-LAUNCH.** Same dependency as friend system — needs social graph + event logging infrastructure.

### 2.5 Chat Panel
**Status:** ✅ BUILT — `ChatPanel.tsx`
In-room text chat. Overlay triggered from header (moving to ⋯ overflow menu in Phase 2).

**Assessment:** Works. Just relocating the trigger point — already in plan.

---

## 3. LIBRARY / COLLECTION

### 3.1 Library Tabs (Liked Tracks, Session History, Collections, Master Bounces)
**Status:** ✅ BUILT — `FlightCasesScreen.tsx` (now labeled "Library")

Collapsible sections for each category. Mock data populates them.

**Assessment:** Functional. Tab renamed to "Library" in Phase 1. No further work needed for current scope.

### 3.2 Master Bounce (Session Receipt)
**Status:** ✅ BUILT — `MasterBounce.tsx`

End-of-session summary showing: tracks played, top contributor, total listeners, duration, CV earned.

**Assessment:** Overlay component exists. Triggered on session end. No changes needed.

### 3.3 Offline Mode / Downloads
**Status:** ❌ NOT BUILT

**❌ CUT for now.** Requires:
- Local track caching with expo-file-system
- Download queue management
- Offline playback engine
- DRM considerations per service

**Why cut:** Enormous scope. None of the connected services (Spotify, SoundCloud, Tidal) allow caching third-party tracks via their APIs. Would need to be limited to Jamendo (CC-licensed) content only. Not worth the complexity for DESN 374.

---

## 4. DISCOVERY

### 4.1 Public Room Browsing
**Status:** ✅ BUILT — `DiscoverScreen.tsx`
Browse public rooms with genre/mood filters.

### 4.2 Genre/Mood Filters
**Status:** ✅ BUILT — `GenreFilterBand` component in PatchBayScreen (now shared with DiscoverScreen)

### 4.3 Trending Rooms
**Status:** ⚠️ PARTIAL — UI exists, backend sorting is mock

**📋 POST-LAUNCH:** Real trending algorithm (listener count velocity, reaction rate, etc.). Mock "trending" badge is fine for demo.

### 4.4 Search
**Status:** ✅ BUILT — `SearchScreen.tsx`, `SearchResultItem.tsx`, iTunes search integration

**🔧 PHASE 4 action:** Search relocates from always-visible input on room screen to "Add track" button inside the Queue Bottom Sheet. Already in plan.

---

## 5. PROFILE

### 5.1 Connected Services
**Status:** ✅ BUILT — Spotify, SoundCloud, Tidal, Last.fm OAuth flows

### 5.2 Stats / Listening History
**Status:** ⚠️ PARTIAL — Profile shows connected services and basic info. No aggregate stats.

**📋 POST-LAUNCH:** Listening stats dashboard (total sessions, tracks added, CV earned all-time, favorite genres). Needs event logging.

### 5.3 QR Code Sharing
**Status:** ✅ BUILT — `QRCodeDisplay.tsx`, `QRScanner.tsx`

---

## 6. "DEEP CUTS" — THE MODULAR SYNTH EXPERIMENTS

These are the unique, brand-differentiating features from the PDF. Let me assess each honestly.

### 6.1 The Hard Patch (NFC Phone Bumping)
**Concept:** Tap phones together to instantly share your profile card or currently playing track.

**❌ CUT for DESN 374.**

Why:
- React Native NFC requires `react-native-nfc-manager` + native module linking
- Expo managed workflow doesn't support NFC without a dev client build
- iOS NFC is read-only for non-Apple-Pay uses (can read tags, can't do peer-to-peer)
- Android Beam was deprecated in Android 10
- Modern alternative would be Nearby Share / AirDrop APIs — platform-specific, complex

**Alternative for demo:** QR code sharing already handles the same use case (share profile/room). Keep "Hard Patch" as a post-launch differentiator if NFC tech improves.

### 6.2 Voltage Sag (Low Battery Mode)
**Concept:** When phone hits ≤10% battery, UI dims to warm amber/orange palette, audio goes mono, animations reduce.

**🔧 CAN IMPLEMENT NOW — low effort, high delight.**

Implementation:
1. Use `react-native-battery` or Expo's `Battery` API (`expo-battery`) to monitor level
2. When ≤10%: swap `colors` import to a "voltage sag" palette (warm ambers replacing ice cyan)
3. Reduce animation durations to 0 or minimal
4. Audio mono: `playbackEngine` can set stereo→mono flag

**Effort:** ~2-4 hours. Small ThemeProvider wrapper + battery listener.
**Why now:** This is a visual/UX feature that touches the theme system. If we build it AFTER the room redesign, we'd have to go back and add conditional theming to every new component. Better to set up the theming infrastructure now so all Phase 2-5 components automatically respect it.

**Recommendation:** Set up the battery-aware theme provider skeleton during Phase 2. The actual palette swap and mono audio can be wired later, but the conditional theme hook should exist from the start.

### 6.3 The Dummy Plug (Lurker/Incognito Mode)
**Concept:** Listen to a room without appearing in the listener list or contributing to room count. Like "invisible" mode.

**📋 POST-LAUNCH (backend-dependent).**

Requires:
- Server-side: `isIncognito` flag on socket connection, filter from `listeners` broadcast
- Client-side: Toggle in profile/settings, visual indicator that you're in lurker mode
- Privacy considerations: Should host know lurker count separately?

**Why defer:** Pure backend feature. Socket.io events currently broadcast all connected users. Adding filtering is straightforward but not needed for DESN 374 demo.

### 6.4 Resonance Event (Spontaneous Community Events)
**Status:** ✅ BUILT — `ResonanceEvent.tsx`

Server-triggered overlay for community moments (e.g., "10 people reacted 🔥 in 5 seconds!"). Mock triggers exist.

**Assessment:** Works. No changes needed.

### 6.5 Transient Enter / Reverb Tail (Entry/Exit Animations)
**Status:** ✅ BUILT — `TransientEnter.tsx`, `ReverbTail.tsx`

Entry and exit animations for room transitions.

**Assessment:** Overlays, untouched by redesign.

---

## 7. FEATURES FROM PDF NOT YET DISCUSSED

### 7.1 Lyrics Display
**Status:** ✅ BUILT — `LyricsOverlay.tsx`
Genius API integration for synced lyrics.

**🔧 PHASE 2 action:** Lyrics trigger moves from header button to ⋯ overflow menu. Already in plan.

### 7.2 Room Settings / Mode Switching
**Status:** ⚠️ PARTIAL — Mode set at creation. Live mode switching described in PDF but not implemented.

**🔧 PHASE 2 action:** The redesign spec (§3.1) puts a Mode Badge in the header. Tapping it (host only) opens a mode switch Alert. This is new UI but simple logic — just emit a socket event to change mode. Can wire during Phase 2 header work.

### 7.3 Waveform Visualizer / "Signal Type" Display
**Status:** ✅ BUILT — `WaveformIcon.tsx`, `StepSequencer.tsx`

**🔧 PHASE 5 action:** Step Sequencer removed from room per redesign. WaveformIcon can be repurposed as the "no track playing" placeholder in the album art hero area.

### 7.4 Toast / Notification System
**Status:** ✅ BUILT — `Toast.tsx`, `notifications.ts`

### 7.5 Mini Player (Persistent)
**Status:** ✅ BUILT — `MiniPlayer.tsx`
Shows when navigating away from room. Spec §1.4 compliant.

---

## SUMMARY: WHAT TO FOLD INTO PHASES 2-5

### Implement NOW (during active redesign) to avoid rework:

| Feature | Phase | Effort | Why Now |
|---------|-------|--------|---------|
| **Battery-aware theme provider skeleton** (Voltage Sag infrastructure) | Phase 2 | 2h | All new components auto-respect it. Retrofitting = pain. |
| **Mode Badge tap → mode switch** (host-only live mode change) | Phase 2 | 1h | Building the header anyway, wire the tap handler |
| **CV pill with power move expansion** | Phase 3 | 2h | Already in redesign plan |
| **Reaction bar below transport** | Phase 3 | 1h | Already in redesign plan |
| **ParticipantAvatarBar as dedicated row** | Phase 2 | 1h | Already in redesign plan |
| **Search inside Queue Bottom Sheet** | Phase 4 | 2h | Already in redesign plan |

### Defer to POST-LAUNCH:

| Feature | Reason |
|---------|--------|
| Friend system / social graph | Full feature vertical (DB + API + UI + notifications) |
| Activity feed | Depends on social graph + event logging |
| Real trending algorithm | Mock badge sufficient for demo |
| Listening stats dashboard | Needs event logging infrastructure |
| Dummy Plug (incognito mode) | Backend socket filtering needed |
| Frequency Forecast (real ML) | Mock prediction fine for demo |
| Offline mode / downloads | DRM + caching complexity, API restrictions |

### CUT entirely:

| Feature | Reason |
|---------|--------|
| NFC Hard Patch | Expo managed workflow doesn't support NFC, Android Beam deprecated, iOS NFC limited |

---

## ACTIONABLE CHANGE TO PHASE 2 PLAN

The only NEW work item not already in the redesign plan is:

**Voltage Sag theme infrastructure** — Add a `useThemeMode()` hook that:
1. Listens to `expo-battery` for battery level
2. Provides a `isVoltageSag` boolean to the component tree
3. Components can conditionally use `sagColors` palette (warm amber) instead of `colors` (ice cyan)
4. For now, just the hook + provider. Actual palette swap can be a quick follow-up.

This is ~2 hours of work and prevents having to retrofit every component built in Phases 2-5.

Everything else from the PDF is either already built, already in the redesign plan, or correctly deferred.
