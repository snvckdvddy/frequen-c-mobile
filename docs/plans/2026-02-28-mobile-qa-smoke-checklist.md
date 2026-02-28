# Frequen-C Mobile QA Smoke Checklist
Date: 2026-02-28
Scope: Mobile stabilization pass after core nav/socket/auth/config fixes.

## Automated baseline (completed)
Environment used:
- API: `http://127.0.0.1:5000/api`
- Socket: `http://127.0.0.1:5000`

Results:
1. `npm run smoke:backend` -> PASS
2. `npm run smoke:create-session` -> PASS
3. `npm run smoke:spotify` -> PASS
4. `npx tsc --noEmit` -> PASS
5. `npm test` -> PASS (99 tests)

## Priority 0 device checks (must pass before broader rollout)
1. Launch app on physical device and verify auth gate:
`logged-out user -> Login/Register shown`
`valid login -> Tabs shown`
2. Tap center Create CTA from bottom tab bar:
`expect Create Session modal opens every tap`
3. Create room and enter Session Room:
`expect room loads without crash and queue UI renders`
4. Add track and verify queue update:
`expect queue order updates and now-playing state is stable`
5. Force background/foreground once:
`expect socket reconnect + room state recovers`

## Priority 1 device checks (critical UX reliability)
1. Join flow:
`Join by code works`
`QR scanner permission prompt and scan path work`
2. Network resilience:
`toggle airplane mode on/off in room`
`Offline/Connection banners appear and recover`
3. Profile integrations panel:
`service connect buttons launch expected auth flows`
4. Push notifications:
`single permission prompt behavior`
`token registration happens once after login`

## Priority 2 checks (consistency/polish)
1. Typography:
`no obvious fallback-font jumps in Home/Library/Profile/MiniPlayer`
2. Deep links:
`frequenc://join/{code}`
`frequenc://room/{sessionId}`
3. Cross-platform sanity:
`one Android device + one iOS device basic flow`

## Suggested run order for each QA cycle
1. `npm run smoke:all`
2. `npx tsc --noEmit`
3. `npm test`
4. Device P0 checks
5. Device P1 checks
