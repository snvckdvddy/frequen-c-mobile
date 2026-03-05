# Frequen-C Mobile QA Runbook
Date: 2026-03-05
Owner: Mobile QA Session Runner

## Purpose
Use this runbook for every QA cycle so results are consistent across devices, builds, and backend modes.

## Inputs
- Visual checklist: `docs/QA-VISUAL-CHECKLIST.md`
- Defect log template: `docs/QA-DEFECT-LOG-TEMPLATE.md`
- Signoff template: `docs/QA-SIGNOFF-TEMPLATE.md`

## Preflight
1. In `Frequen-C-Mobile`, run:
```bash
npm run qa:preflight
```
2. Confirm both commands pass.
3. Confirm `.env` is not committed.

## Pass 1: Visual-Only (Mock-Friendly)
1. Set in `.env`:
```env
EXPO_PUBLIC_BYPASS_AUTH=true
```
2. Start app:
```bash
npx expo start
```
3. Walk `docs/QA-VISUAL-CHECKLIST.md` in order:
- Global checks
- Screen-by-screen checks
- Voltage Sag Mode
- Splash
4. Capture screenshots for every visual issue.

## Pass 2: Real Backend Validation
1. Set in `.env`:
```env
EXPO_PUBLIC_BYPASS_AUTH=false
EXPO_PUBLIC_LOCAL_IP=<your-lan-ip>
EXPO_PUBLIC_API_PORT=5000
```
2. Start backend:
```bash
cd ../Frequen-C-Backend
npm run dev
```
3. In another terminal, run mobile smoke checks:
```bash
cd ../Frequen-C-Mobile
npm run qa:backend
```
4. Start app:
```bash
npx expo start
```
5. Re-run high-risk flows:
- Login/Register
- Create session
- Join by code / QR
- Session room live updates
- Offline -> reconnect recovery
- Notifications entry path

## APK Validation (Android)
1. Ensure EAS CLI is installed and authenticated:
```bash
npm i -g eas-cli
eas login
```
2. Build APK:
```bash
eas build --profile preview:apk --platform android
```
3. Install APK and run quick smoke:
- Launch + auth
- Create/join
- Room stability
- Core palette sanity

## Defect Capture Rules
1. One row per issue in defect log template.
2. Include:
- Screen
- Element
- Expected
- Actual
- Severity (P0/P1/P2)
- Screenshot path
3. Screenshot naming format:
- `YYYY-MM-DD_screen_element_short-issue.png`

## Severity Rubric
- P0: Crash, blocker, corrupted core flow.
- P1: Major UX break, unreadable text, broken interaction, obvious palette regression.
- P2: Polish, spacing, minor consistency issues.

## Closeout
1. Update signoff template with:
- build info
- devices tested
- pass/fail summary
- defect counts by severity
2. If P0 exists: fail signoff.
3. If no P0 and acceptable P1/P2: signoff with noted follow-ups.

## Helpful Commands
- `npm run qa:preflight` -> TypeScript + Jest
- `npm run qa:backend` -> backend smoke suite
- `npm run qa:baseline` -> preflight + backend smoke suite
