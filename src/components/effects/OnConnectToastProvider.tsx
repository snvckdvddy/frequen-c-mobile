/**
 * OnConnectToastProvider
 *
 * Subscribes to the `handshakeBus` and fires a discovery toast pointing
 * users to where they can connect additional services. Mounts at the app
 * root as a sibling to `HardwareHandshakeProvider` and
 * `HapticHandshakeProvider` so visual + tactile + textual reinforcement
 * all derive from the same bus event.
 *
 * Two suppression gates protect against the toast becoming noise:
 *
 *   1. Route gate — if the user is already on a screen where the toast's
 *      destination is the screen itself (e.g., the Profile modal which
 *      contains PATCH CABLES at the top), firing the toast is redundant
 *      and visually distracting. Returning users connecting from PATCH
 *      CABLES obviously know where PATCH CABLES is.
 *
 *   2. Rapid-fire gate — if the user is connecting multiple services
 *      back-to-back (e.g., the multi-PATCH dance on Profile), only the
 *      first event in a 30-second window fires the toast. Subsequent
 *      handshakes within the window are suppressed.
 *
 * Why a delay on the fire path:
 *   HardwareHandshakeProvider mounts a fullscreen Modal overlay that
 *   would obscure a toast fired at the same instant. The 2-second delay
 *   lets the handshake animation own the foreground for its beat, then
 *   hands off to the toast just as the modal dismisses.
 *
 * Why this exists at all:
 *   The FirstSourcePicker subtitle now points at "Profile › PATCH CABLES"
 *   as the place to connect more services, and the Profile reorder put
 *   PATCH CABLES at the top of that screen. The toast reinforces the
 *   path at the peak-engagement moment of first connect — users learn by
 *   doing. The three layers (subtitle pre-connect, toast at-connect,
 *   reordered Profile post-navigate) form a coherent end-to-end flow.
 *
 * No rendered output — pure side-effect provider.
 */

import { useEffect } from 'react';
import { handshakeBus } from '../../services/handshake/handshakeBus';
import { showToast } from '../ui';
import { navigationRef } from '../../navigation/navigationRef';

// Wait for the Hardware Handshake modal to dismiss before showing the
// toast. The handshake animation runs ~1.5-2s; this delay lets it own
// the foreground for that beat, then hands off to the toast.
const TOAST_DELAY_MS = 2000;

// Longer than the default 2.5s — the message is informational
// (not urgent) and contains a destination the user may want a moment
// to mentally map ("Profile › PATCH CABLES").
const TOAST_DURATION_MS = 4500;

// Routes where the toast's "go to Profile › PATCH CABLES" guidance is
// redundant — the user is already there. Keep this set tight; only add
// a route here if the toast genuinely doesn't help in that context.
const SUPPRESS_ON_ROUTES = new Set<string>(['Profile']);

// Burst window: if the same user fires multiple handshakes within this
// window (e.g., tapping PATCH on several services in quick succession),
// only the first fires the toast. Repeats inside the window are noise.
const RAPID_FIRE_GUARD_MS = 30_000;

// Module-level so the gate persists across re-mounts (in practice the
// provider is mounted once at App root and never remounts, but this
// also makes the behavior robust to fast-refresh in dev mode).
let lastFireAt = 0;

export function OnConnectToastProvider() {
  useEffect(() => {
    return handshakeBus.subscribe(() => {
      // Gate 1: if the user is already on a route where the toast's
      // destination is the current screen, suppress it.
      const currentRoute = navigationRef.isReady()
        ? navigationRef.getCurrentRoute()?.name
        : undefined;
      if (currentRoute && SUPPRESS_ON_ROUTES.has(currentRoute)) return;

      // Gate 2: if a previous handshake fired within the rapid-fire
      // window, suppress this one.
      const now = Date.now();
      if (now - lastFireAt < RAPID_FIRE_GUARD_MS) return;
      lastFireAt = now;

      setTimeout(() => {
        showToast(
          'Connected. Add more services anytime in Profile › PATCH CABLES',
          'info',
          undefined,
          TOAST_DURATION_MS
        );
      }, TOAST_DELAY_MS);
    });
  }, []);

  return null;
}
