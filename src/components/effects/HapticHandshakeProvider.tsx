/**
 * HapticHandshakeProvider
 *
 * Subscribes to the `handshakeBus` and fires the per-source haptic pattern
 * whenever a provider successfully connects. Mounts at the app root as a
 * sibling to `HardwareHandshakeProvider` so visual + tactile feedback fire
 * together from the same bus event.
 *
 * No rendered output — this is a pure side-effect provider.
 *
 * iOS-only: the haptic logic itself gates on `Platform.OS === 'ios'`, so
 * this component is safe to mount unconditionally on Android (no-ops).
 */

import { useEffect } from 'react';
import { handshakeBus } from '../../services/handshake/handshakeBus';
import { fireHapticHandshake } from '../../services/handshake/hapticHandshake';

export function HapticHandshakeProvider() {
  useEffect(() => {
    const unsubscribe = handshakeBus.subscribe((source) => {
      // Fire-and-forget — haptic failure must never surface to the user.
      void fireHapticHandshake(source);
    });
    return unsubscribe;
  }, []);

  return null;
}
