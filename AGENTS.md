# Frequen-C Mobile: Agent Guide

Short, self-contained brief for Codex, AI Studio, and other agents. Claude Code also reads `CLAUDE.md` in this folder, which has more detail.

## What this is

React Native 0.81 + Expo SDK 54 + TypeScript, Android-first. A collaborative in-person listening app: one host device is the audio output, other people queue tracks from their own services, and the backend (`../Frequen-C-Backend`, Express + Socket.io + SQLite) coordinates the queue. The backend never proxies audio.

## Scope (locked 2026-07-25)

Closed friends beta: Campfire room mode only, SoundCloud primary. Spotlight and Open Floor are behind a disabled V2 state (keep the code). No Spotify work, no store submission.

Streaming services play through WebView SDK bridges (`src/services/playback/`). Do not propose a full-track CDN URL API; none exists.

## Commands

- `npm start` Expo dev server
- `npx tsc --noEmit` type check (must pass)
- `npm test` Jest (runs `scripts/jest-run.js`)
- `npm run qa:preflight` type check + tests
- OTA: `npm run ota:publish -- "<message>" --dry-run` first. Never run `eas update` directly.

## Rules

- Use semantic tokens from `src/design/tokens/materials.ts`. No raw hex in components.
- No `any` in production code.
- Rack x Chrome design language. Do not restyle locked tokens.
- New native code or dependency changes need a new EAS build, not an OTA.
- Auth and provider code is frozen unless the task is about auth.
- Work on a feature branch. Do not push to `master`.

## Boundaries

- Never read or print `.env` files.
- If something fails twice, stop and report the root cause.
- Port one component or screen per task.
