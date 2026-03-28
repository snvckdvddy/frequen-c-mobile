# AI Handoff — Session Room V2 Lock Notes (2026-03-19)

## Scope
- Canonical repo: `Frequen-C-Mobile`
- Primary orchestration file: `src/screens/SessionRoomScreen.tsx`
- This note exists to prevent future cleanup/features from regressing the current Session Room V2 flow.

## Locked UX Invariants
- `SessionRoomScreen` is the active Session V2 shell. Do not restore the legacy `OverflowMenu` / `RoomSettingsPanel` render path.
- Room actions flow through `TacticalSystemPreferencesPanel`.
- Room overlays use tactical V2 shells/prompts:
  - chat
  - listener roster
  - QR
  - lyrics
  - share prompt
  - leave/end prompt
  - power confirmations
- Do not reintroduce native `Alert.alert(...)` for normal room actions/prompts if a tactical overlay/prompt can carry the interaction.
- Queue adds are intentionally free. Do not attach CV cost/spend to baseline add-to-queue or queue search results.
- CV is reserved for power moves and special room mechanics:
  - `phantom_power`
  - `overdrive`
  - `phase_cancel`
- The `PATCH TRACK` search overlay should remain open after adding from the queue flow.
- Presence should remain compact at the top. Only the listener count pill should open the roster drawer; the broader strip should stay passive.

## Overlay Safety Rule
- `closeTransientPanels()` in `src/screens/SessionRoomScreen.tsx` is the central mutual-exclusion guard for room overlays.
- Any new in-room modal/panel must be folded into that function before it is considered complete.
- Reason: broad overlapping press surfaces previously caused the room to become non-interactive on device.

## Current Layout Decisions
- The transport row stays visually contiguous.
- The blue CV pill lives with track meta, not between transport and routing.
- Routing cells sit directly beneath the playbar.
- Idle state keeps the same structural layout with ghosted/default states instead of collapsing into a different composition.

## Files That Matter Most
- `src/screens/SessionRoomScreen.tsx`
- `src/features/session-v2/components/TacticalSystemPreferencesPanel.tsx`
- `src/features/session-v2/components/TacticalActionPrompt.tsx`
- `src/features/session-v2/components/TacticalPresenceStrip.tsx`
- `src/components/ListenerPresence.tsx`
- `src/components/ChatPanel.tsx`
- `src/components/ui/LyricsOverlay.tsx`
- `src/components/QRCodeDisplay.tsx`
- `src/features/search-hud/SearchHudOverlay.tsx`

## Safe Next Areas
- Move to the next screen/flow instead of squeezing Session Room further.
- If Session Room is revisited, prefer polish or additive tactical overlays rather than structural rewrites.
