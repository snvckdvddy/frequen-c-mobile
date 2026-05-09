/**
 * OnConnectToastProvider
 *
 * Subscribes to the `handshakeBus` and fires a discovery toast pointing
 * users to where they can connect additional services. Mounts at the app
 * root as a sibling to `HardwareHandshakeProvider` and
 * `HapticHandshakeProvider` so visual + tactile + textual reinforcement
 * all derive from the same bus event.
 *
 * Why a delay:
 *   HardwareHandshakeProvider mounts a fullscreen Modal overlay that
 *   would obscure a toast fired at the same instant. We delay the toast
 *   by ~2s so it appears just as the handshake animation completes —
 *   the message lands at the moment of highest user comprehension
 *   ("I just connected; what's next?") instead of being eaten by the
 *   handshake's own visibility window.
 *
 * Why this exists:
 *   The FirstSourcePicker subtitle now points at "Profile › PATCH CABLES"
 *   as the place to connect more services, and the Profile reorder put
 *   PATCH CABLES at the top of that screen. The toast reinforces the
 *   path at the peak-engagement moment of first connect — users learn by
 *   doing. The three layers (subtitle pre-connect, toast at-connect,
 *   reordered Profile post-navigate) form a coherent end-to-end flow,
 *   not a band-aid pointer to friction.
 *
 * No rendered output — pure side-effect provider.
 */

import { useEffect } from 'react';
import { handshakeBus } from '../../services/handshake/handshakeBus';
import { showToast } from '../ui';

// Wait for the Hardware Handshake modal to dismiss before showing the
// toast. The handshake animation runs ~1.5-2s; this delay lets it own
// the foreground for that beat, then hands off to the toast.
const TOAST_DELAY_MS = 2000;

// Longer than the default 2.5s — the message is informational
// (not urgent) and contains a destination the user may want a moment
// to mentally map ("Profile › PATCH CABLES").
const TOAST_DURATION_MS = 4500;

export function OnConnectToastProvider() {
  useEffect(() => {
    return handshakeBus.subscribe(() => {
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
