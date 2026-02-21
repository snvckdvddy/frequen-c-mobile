# Frequen-C Mobile

## Project Overview
Mobile-first React Native (Expo) rebuild of Frequen-C — a collaborative music curation app.

## Architecture
- **Frontend**: React Native (Expo 54) + TypeScript
- **Backend**: Existing Node/Express server (port 5000) — shared with web app
- **Database**: Firebase Firestore
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
- Colors: `src/theme/colors.ts` — semantic tokens mapped to roles
- Typography: `src/theme/typography.ts` — minor-third scale (1.2 ratio)
- Spacing: `src/theme/spacing.ts` — 4px base grid

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
