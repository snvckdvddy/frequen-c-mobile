# Frequen-C Mobile

## Canonical Workspace Note

This is the canonical mobile app.

Use with:

- backend: `../Frequen-C-Backend`
- web companion: `../Frequen-C`

Do not port fixes into legacy copies under `Frequen-C/mobile`, `Frequen-C/backend`, or `Frequen-C/server`.

Before feature work, prefer:

```bash
npm run doctor:auth
npm run qa:preflight
npm run qa:backend
npm run qa:baseline
```

## Project Overview
Mobile-first React Native (Expo) rebuild of Frequen-C — a collaborative music curation app.

## Architecture
- **Frontend**: React Native (Expo 54) + TypeScript
- **Backend**: Existing Node/Express server (port 5000) — shared with web app
- **Database**: SQLite via `better-sqlite3` (managed by Frequen-C-Backend, NOT Firebase — docs were incorrect)
- **Real-time**: Socket.io
- **Auth**: JWT tokens stored in expo-secure-store

## Key Directories
```
src/
  components/ui/     → Reusable primitives (Text, Button, Input)
  components/layout/ → App layout shells
  components/auth/   → Auth-specific components
  components/session/→ Room/session components
  components/queue/  → Queue & track components
  screens/           → Full screen components
  navigation/        → React Navigation config
  services/          → API client, socket client
  hooks/             → Custom hooks
  contexts/          → React Context providers
  theme/             → Design system (colors, typography, spacing)
  types/             → TypeScript type definitions
  utils/             → Utility functions
```

## Design System

**Canonical source of truth: `src/design/tokens/materials.ts`**

`src/theme/colors.ts` is a legacy wrapper — it imports from `design/tokens/materials` for backward compat.
Do NOT edit `colors.ts` directly; update `materials.ts` instead.

| Token | Value | Role |
|---|---|---|
| `palette.void` | `#0C0E14` | App background |
| `palette.midnight` | `#131620` | Card/section BG |
| `palette.steel` | `#1A1D28` | Raised surfaces |
| `palette.orange` | `#FF7A45` | **Primary accent** (CTAs, active states) |
| `palette.ice` | `#5AC8C8` | **Secondary accent** (teal) |
| `palette.magenta` | `#F472B6` | Spotlight mode, destructive |
| `palette.green` | `#34D399` | CV economy positive, live |

- Typography: minor-third scale (1.2 ratio), see `src/design/tokens/typography.ts`
- Spacing: 4px base grid, see `src/theme/spacing.ts`
- Visual language: **Rack × Chrome** — `VoidSurface`, `ModuleFaceplate`, `LEDReadout`, `ChromeButton`

## Product Vision
Frequen-C is a real product first. Academic credit (DESN 374-040) is a side benefit, not the driver.

Five design pillars guide UX decisions (not requirements — guidelines):
1. Social Choice Architecture (room modes, authority models)
2. Room Mode Physics (Campfire, Spotlight, Open Floor)
3. Social Voltage Economy (queue priority currency)
4. Contribution Visibility (presence, attribution)
5. Tactile Fidelity (haptics, native audio, gesture interactions)

## Backend API (existing, at localhost:5000)
- POST /api/auth/login
- POST /api/auth/register
- GET  /api/auth/me
- GET  /api/sessions
- POST /api/sessions
- POST /api/sessions/join
- GET  /api/sessions/discover
- GET  /api/search?q=...

## Development
```bash
npm start          # Expo dev server
npm run ios        # iOS simulator
npm run android    # Android emulator
```

## Development Workflow (Skill Pipeline)

**All new features follow this pipeline — no exceptions:**

1. **`brainstorming`** — Design-first gate. Explore context → clarify questions (one at a time) → propose 2-3 approaches → present design → get approval.
2. **`writing-plans`** — Implementation plan. Bite-sized TDD tasks with exact file paths, commands, and expected output. DRY, YAGNI, frequent commits.
3. **Execute** — Follow the plan task by task.

**Reference skills (use during brainstorming or planning):**
- **`api-design-principles`** — REST + GraphQL patterns, pagination, error handling, DataLoader
- **`ux-product-manager`** — PRD Generator → PRD Clarifier → 6-pass UX Spec → Build-Order Prompts

Skills live in `.skills/skills/` at project root. Each has a `SKILL.md`.

**HARD GATE:** Do NOT write code or scaffold anything until a design is presented and the user approves it. The brainstorming skill enforces this.

## Rules
- Always use semantic color tokens from theme, never raw hex in components
- Prioritize shipping a functional, polished product over academic framing
- Mobile-first: design for phone screens, scale up if needed
- Test with real backend early and often
- All new features go through the brainstorming → writing-plans pipeline
