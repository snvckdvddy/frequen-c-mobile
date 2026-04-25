/**
 * HardwareHandshakeProvider
 *
 * Mounts the `HardwareHandshake` overlay near the root of the app and
 * subscribes once to the `handshakeBus`. Any caller anywhere in the tree
 * can fire `handshakeBus.fire('spotify')` and this provider routes the
 * event to the underlying animated component.
 *
 * Mount point: App.tsx, inside the providers but at the same level as
 * `<AppNavigator />` so the Modal-based overlay renders above all
 * navigation surfaces.
 *
 * The provider renders no children of its own — it's a fire-and-forget
 * sibling that owns the overlay's ref and subscription lifecycle.
 */

import React, { useEffect, useRef } from 'react';
import { HardwareHandshake, HardwareHandshakeRef } from './HardwareHandshake';
import { handshakeBus } from '../../services/handshake/handshakeBus';

export function HardwareHandshakeProvider() {
  const ref = useRef<HardwareHandshakeRef>(null);

  useEffect(() => {
    // Subscribe once on mount; unsubscribe on unmount. The bus tolerates
    // fires before subscription (no-ops) so there's no startup race here.
    const unsubscribe = handshakeBus.subscribe((source) => {
      ref.current?.play(source);
    });
    return unsubscribe;
  }, []);

  return <HardwareHandshake ref={ref} />;
}
