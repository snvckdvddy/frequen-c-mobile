/**
 * useManualMode — global toggle for "Read Manual" guided UI.
 *
 * When `readManual` is true, screens render contextual ManualPanel
 * guidance explaining what each control does, what each room mode
 * means, etc. Off by default; users opt-in via the toggle in
 * ProfileScreen ("READ THE MANUAL" row).
 *
 * Architecture:
 *   - Single in-memory flag broadcast to all subscribers via a
 *     listener set. Multiple screens can subscribe; all stay in sync
 *     when any one toggles.
 *   - Persisted to AsyncStorage so the toggle survives app restarts.
 *     Loaded once on first hook mount; written on every change.
 *   - `manualReady` flips true once the persisted value has loaded
 *     (or determined missing). Screens can use it to avoid a
 *     1-frame flicker showing the wrong state on cold launch.
 *
 * Bug history (2026-05-11): the previous implementation only used
 * the in-memory flag with no persistence. Toggle ON, restart the app,
 * the toggle was gone — making Read Manual feel broken. Fixed by
 * wiring AsyncStorage as the durable backing store.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'frequenc.readManual';

let manualFlag = false;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<(next: boolean) => void>();
const readyListeners = new Set<(ready: boolean) => void>();

function broadcast(next: boolean) {
  manualFlag = next;
  listeners.forEach((listener) => listener(next));
  // Fire-and-forget persistence. Failure shouldn't break the toggle —
  // worst case the flag is in-memory only for this session, which is
  // exactly the pre-fix behavior, so a degraded fallback is safe.
  AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {
    // Storage unavailable (rare on real devices) — no recovery action.
  });
}

function broadcastReady() {
  hydrated = true;
  readyListeners.forEach((listener) => listener(true));
}

/**
 * Hydrate the in-memory flag from AsyncStorage. Idempotent — multiple
 * concurrent calls share one promise so we don't read the store more
 * than once on cold boot when N screens mount simultaneously.
 */
function ensureHydrated(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      manualFlag = stored === '1';
      // Notify any listeners that subscribed before hydration completed.
      listeners.forEach((listener) => listener(manualFlag));
      broadcastReady();
    })
    .catch(() => {
      // If reading from storage fails, leave the flag at its default
      // (false) and mark ready so the UI doesn't hang forever.
      broadcastReady();
    });
  return hydrationPromise;
}

export function useManualMode() {
  const [readManual, setReadManualState] = useState(manualFlag);
  const [manualReady, setManualReadyState] = useState(hydrated);

  useEffect(() => {
    const valueListener = (next: boolean) => setReadManualState(next);
    const readyListener = (ready: boolean) => setManualReadyState(ready);
    listeners.add(valueListener);
    readyListeners.add(readyListener);

    // Kick off hydration on first mount. If already hydrated, this
    // resolves immediately and the listeners get the current value.
    void ensureHydrated();

    return () => {
      listeners.delete(valueListener);
      readyListeners.delete(readyListener);
    };
  }, []);

  const setReadManual = useCallback((next: boolean) => {
    broadcast(next);
  }, []);

  return { readManual, setReadManual, manualReady };
}

export default useManualMode;
