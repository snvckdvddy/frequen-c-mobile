/**
 * useDevMode — hidden developer test surface activation flag.
 *
 * When enabled, the app renders a floating DEV button (bottom-right of
 * every screen) that opens a dev panel with quick-test actions:
 *   - Force room mode without going through System Preferences
 *   - Toggle isHost UI override (preview non-host UI as a single user)
 *   - Reset first-time-visit / Read Manual flags
 *   - Disable Dev Mode
 *
 * Activation: tap the BUILD version row in Profile screen 5 times in
 * quick succession. Classic Android-style hidden gesture — invisible
 * to normal users, easy for the operator to discover/document.
 *
 * Storage: AsyncStorage so the flag survives app restarts. Multi-
 * subscriber broadcast pattern matches useManualMode + useFirstTimeVisit
 * so all consumers stay in sync.
 *
 * Why a runtime flag instead of __DEV__: OTA bundles ship to release-
 * mode native builds where __DEV__ is false. The dev panel needs to be
 * activatable on those OTAs without rebuilding the APK. Trade-off: the
 * dev-panel code ships in production bundles. Mitigated by:
 *   - Gated rendering (zero visual surface when devMode=false)
 *   - Hidden activation gesture
 *   - Small footprint (~200 LOC total dev-mode surface)
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'frequenc.devMode';

let devModeFlag = false;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<(next: boolean) => void>();
const readyListeners = new Set<(ready: boolean) => void>();

function broadcast(next: boolean) {
  devModeFlag = next;
  listeners.forEach((listener) => listener(next));
  AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {
    // Storage unavailable — degrade to in-memory for this session.
  });
}

function broadcastReady() {
  hydrated = true;
  readyListeners.forEach((listener) => listener(true));
}

function ensureHydrated(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((stored) => {
      devModeFlag = stored === '1';
      listeners.forEach((listener) => listener(devModeFlag));
      broadcastReady();
    })
    .catch(() => {
      broadcastReady();
    });
  return hydrationPromise;
}

export function useDevMode() {
  const [devMode, setDevModeState] = useState(devModeFlag);
  const [devModeReady, setDevModeReadyState] = useState(hydrated);

  useEffect(() => {
    const valueListener = (next: boolean) => setDevModeState(next);
    const readyListener = (ready: boolean) => setDevModeReadyState(ready);
    listeners.add(valueListener);
    readyListeners.add(readyListener);
    void ensureHydrated();
    return () => {
      listeners.delete(valueListener);
      readyListeners.delete(readyListener);
    };
  }, []);

  const setDevMode = useCallback((next: boolean) => {
    broadcast(next);
  }, []);

  return { devMode, setDevMode, devModeReady };
}

export default useDevMode;
