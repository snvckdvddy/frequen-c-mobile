# Frequen-C Mobile

## Canonical Workspace Note

This is the canonical mobile app.

Use with:

- backend: `../Frequen-C-Backend`
- web companion: `../Frequen-C`

Do not port fixes into legacy copies under `Frequen-C/mobile`, `Frequen-C/backend`, or `Frequen-C/server`.

## Project Overview
Mobile-first React Native (Expo) rebuild of Frequen-C — a collaborative music curation app.

## Architecture
- **Frontend**: React Native (Expo 54) + TypeScript
- **Backend**: Existing Node/Express server (port 5000) — shared with web app
- **Database**: SQLite via `better-sqlite3` (managed by Frequen-C-Backend, NOT Firebase)
- **Real-time**: Socket.io
- **Auth**: JWT tokens stored in expo-secure-store + optional biometric gating
- **Social Auth**: Apple Sign In + Google Sign In (password-less accounts supported)

## Key Directories
```
src/
  components/ui/       -> Reusable primitives (Text, Button, Input, TrackListItem)
  components/library/  -> Library browsing (ServiceSelectorPills, PlaylistList, PlaylistTrackList)
  design/tokens/       -> Design system tokens (materials.ts = canonical source)
  features/            -> Feature modules (search-hud, session-v2, power-routing, onboarding)
  screens/             -> Full screen components
  navigation/          -> React Navigation config (AppNavigator.tsx)
  services/adapters/   -> Music service adapters (Spotify, SoundCloud, Tidal, Apple Music stubs)
  hooks/               -> Custom hooks (useLibraryBrowse, useBiometric, useCV, useSearch, etc.)
  contexts/            -> React Context providers (Auth, Theme, Favorites, GlobalSessionRoom)
  types/               -> TypeScript definitions (re-exports from @frequen-c/types)
```

## Navigation (current)
4-tab layout: RADAR (Home) | ROOM (Discover) | LIBRARY (LibraryScreen) | CREATE (elevated CTA)
Profile accessed via top-right avatar modal, not a tab.

## Design System

**Canonical source of truth: `src/design/tokens/materials.ts`**

`src/theme/colors.ts` is a legacy wrapper — imports from `design/tokens/materials` for backward compat.

| Token | Value | Role |
|---|---|---|
| `palette.void` | `#0C0E14` | App background |
| `palette.midnight` | `#131620` | Card/section BG |
| `palette.steel` | `#1A1D28` | Raised surfaces |
| `palette.orange` | `#FF7A45` | **Primary accent** (CTAs, active states) |
| `palette.ice` | `#5AC8C8` | **Secondary accent** (teal) |
| `palette.magenta` | `#F472B6` | Spotlight mode, destructive |
| `palette.green` | `#34D399` | CV economy positive, live |

Visual language: **Rack x Chrome** — `VoidSurface`, `TacticalGridBackground`, `LEDReadout`, `ChromeButton`

## Development Workflow

**New features** follow the brainstorming -> writing-plans pipeline:
1. **Brainstorm** — Explore context, clarify, propose 2-3 approaches, present design, get approval
2. **Plan** — Implementation plan with bite-sized tasks, exact file paths, expected output
3. **Execute** — Follow the plan task by task

Custom skills in `../_skills/`: `brainstorming`, `writing-plans`, `api-design-principles`, `ux-product-manager`

**Maintenance/approved plans** can proceed directly without the brainstorming gate.

## Rules
- Always use semantic color tokens from design system, never raw hex in components
- Prioritize shipping a functional, polished product
- Mobile-first: design for phone screens
- All new files must pass `npx tsc --noEmit` (hooks enforce this automatically)
- No `any` types in production code (hooks block edits that introduce or leave `any`)
