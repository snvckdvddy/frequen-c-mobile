# Dual-Agent Work Plan — 2026-03-05

## Agents
- **Cowork (Claude)** — Design system, architecture, frontend logic, pure TS modules
- **AntiGravity (Codex)** — Backend endpoints, cross-repo plumbing, OAuth flows, wiring

## Branch
`chore/mobile-ai-recovery-2026-02-28`

## Baseline
- TypeScript: 0 errors
- Jest: 99/99 passing
- Preflight: `npm run qa:preflight` clean
- Room Mode Physics: COMPLETE (queueEngine.ts + SessionRoomScreen wiring)

---

## AntiGravity — Service Disconnect + Provider Handling

**Priority:** HIGH (unblocks manual QA retesting)

### Tasks
1. **Backend: Disconnect endpoints**
   - `DELETE /api/services/spotify` — clear tokens from user record
   - `DELETE /api/services/soundcloud`
   - `DELETE /api/services/tidal`
   - `DELETE /api/services/lastfm`
   - All return 200 on success, 401 if not authenticated
   - Backend repo WARNING: working tree is dirty — stage specific files only

2. **Mobile: API + AuthContext**
   - Add `disconnectService(provider: string)` to services API layer
   - Add `disconnectService` method to AuthContext
   - Clear local state for the disconnected provider

3. **Mobile: ServiceJack UI updates**
   - Connected state: show "UNPATCH" button (calls disconnect)
   - Apple Music / YouTube Music: show "COMING SOON" label instead of connect button
   - Error state: show readable error message for Tidal/SoundCloud auth failures

4. **Mobile: Error surfacing**
   - Catch `expo-auth-session` WebBrowser failures
   - Parse redirect URL for error params
   - Show toast/alert with readable reason (e.g., "Provider configuration error")

### Files touched (mobile)
- `src/services/api.ts` or equivalent
- `src/contexts/AuthContext.tsx`
- `src/screens/UserProfileScreen.tsx` (ServiceJack component)
- `src/components/ServiceJack.tsx` (if extracted)

### Files touched (backend)
- `src/routes/authSpotify.ts` (add disconnect route)
- `src/routes/authSoundcloud.ts`
- `src/routes/authTidal.ts`
- `src/routes/authLastfm.ts`
- `src/routes/index.ts` (register routes)

---

## Cowork — Phase 1 Navigation Redesign

**Priority:** HIGH (core UX improvement, design-approved)

### Tasks
1. **Tab restructure**
   - Current: PatchBay | FlightCases | [+Create] | Profile
   - New: Home | Discover | [+Create] | Library
   - Profile icon moves to Home screen header (already partially done)

2. **DiscoverScreen extraction**
   - Extract sonar visualization + room discovery from PatchBayScreen
   - New `src/screens/DiscoverScreen.tsx`
   - Filter chips, search, room cards

3. **HomeScreen refinement**
   - Rename PatchBay references to Home
   - Active session card prominent
   - Recent Flight Cases section
   - Quick actions

4. **Tab bar styling**
   - Warm palette tab bar background
   - Active/inactive state colors from design tokens
   - Labels match new naming

### Files touched
- `src/navigation/AppNavigator.tsx`
- `src/screens/PatchBayScreen.tsx` → refactor into HomeScreen
- NEW: `src/screens/DiscoverScreen.tsx`
- `src/screens/FlightCasesScreen.tsx` (label update)

---

## Cowork — Voltage Sag Theme Infrastructure

**Priority:** MEDIUM (should build before more UI work to avoid retrofitting)

### Tasks
1. `src/hooks/useThemeMode.ts` — listens to `expo-battery`, provides `isVoltageSag`
2. `src/theme/VoltageThemeProvider.tsx` — wraps component tree, swaps palette tokens
3. Update design tokens to accept voltage sag overrides (amber palette)

---

## Conflict Avoidance Rules

1. **AntiGravity does NOT touch**: navigation, design tokens, design components, screen layouts
2. **Cowork does NOT touch**: backend repo, OAuth flows, AuthContext, service connector logic
3. **Shared boundary**: `UserProfileScreen.tsx` — AntiGravity owns ServiceJack section; Cowork owns layout/styling
4. **Before committing**: both agents run `npm run qa:preflight` to verify 0 TS errors + 99 tests pass

---

## Verification Checklist (after both agents complete)
- [ ] `npm run qa:preflight` passes
- [ ] Service disconnect works (Spotify, Last.fm at minimum)
- [ ] Navigation tabs show Home / Discover / Create / Library
- [ ] Profile accessible from Home header avatar
- [ ] Warm palette consistent across all screens
- [ ] No cold cyan (#00E5FF) or neon green (#00FF88) anywhere
