/**
 * useFirstTimeVisit — per-screen one-time onboarding signal.
 *
 * The companion to useManualMode for users who haven't enabled the
 * global Read Manual toggle. For those users, when they hit a screen
 * for the FIRST TIME (per fresh-app-install), we want to show the
 * manual guidance once with a dismiss affordance — then never auto-show
 * again on that screen.
 *
 * Storage shape: single AsyncStorage key holding a JSON-encoded
 * `{ [screenId: string]: true }` map. Keeps the storage footprint
 * compact and supports adding/removing screens without per-key
 * migrations. Stable string IDs live in `src/content/manual/index.ts`
 * as MANUAL_SCREEN_IDS — change a string there and existing users
 * will see auto-show again for that screen, so treat them as load-
 * bearing.
 *
 * Hook API:
 *   const { autoShow, dismiss, ready } = useFirstTimeVisit('login');
 *
 *   - autoShow: true when this screen hasn't been seen yet AND
 *     hydration has completed.
 *   - dismiss(): mark this screen seen + persist. Calling it flips
 *     autoShow to false immediately for this and any other mounted
 *     instances of the same screenId.
 *   - ready: true once we've hydrated the seen map from AsyncStorage.
 *
 * Combine with useManualMode for the canonical "should I render
 * manual content?" gate:
 *
 *   const { readManual, manualReady } = useManualMode();
 *   const { autoShow, dismiss, ready } = useFirstTimeVisit('login');
 *   const showManual = manualReady && ready && (readManual || autoShow);
 *
 *   {showManual ? (
 *     <ManualPanel
 *       {...loginScreenManual}
 *       // Dismiss only enabled when the global toggle is OFF (i.e.
 *       // we're showing because of auto-show, not the persistent
 *       // toggle).
 *       onDismiss={!readManual ? dismiss : undefined}
 *     />
 *   ) : null}
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'frequenc.manualSeen';

type SeenMap = Record<string, boolean>;

let seenMap: SeenMap = {};
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function broadcast() {
  listeners.forEach((listener) => listener());
}

function persist() {
  // Fire-and-forget. Storage failure degrades to in-memory only for
  // the current session — auto-show will not fire again this session
  // for already-dismissed screens, just won't be remembered next launch.
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seenMap)).catch(() => {
    /* storage unavailable */
  });
}

function ensureHydrated(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = AsyncStorage.getItem(STORAGE_KEY)
    .then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            seenMap = parsed as SeenMap;
          }
        } catch {
          // Corrupt JSON — drop, start fresh. Storage will be overwritten
          // on next dismiss.
        }
      }
      hydrated = true;
      broadcast();
    })
    .catch(() => {
      hydrated = true;
      broadcast();
    });
  return hydrationPromise;
}

export function useFirstTimeVisit(screenId: string) {
  const [tick, setTick] = useState(0); // re-render trigger
  const [ready, setReady] = useState(hydrated);

  useEffect(() => {
    const listener = () => {
      setReady(hydrated);
      setTick((t) => t + 1);
    };
    listeners.add(listener);
    void ensureHydrated();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = useCallback(() => {
    if (!hydrated) {
      // Defer the dismiss until hydration completes so we don't
      // overwrite the persisted map with a half-loaded one. Practically
      // unreachable because UI dismiss buttons can only be tapped
      // after the panel rendered, which requires ready=true — but
      // belt-and-suspenders.
      void ensureHydrated().then(() => {
        seenMap = { ...seenMap, [screenId]: true };
        persist();
        broadcast();
      });
      return;
    }
    if (seenMap[screenId]) return; // already dismissed
    seenMap = { ...seenMap, [screenId]: true };
    persist();
    broadcast();
  }, [screenId]);

  const autoShow = ready && !seenMap[screenId];

  // Reference tick to keep React's render coupled to broadcast events.
  // (Otherwise stale closures over `seenMap` would never re-trigger
  // re-render when another instance dismisses.)
  void tick;

  return { autoShow, dismiss, ready };
}

export default useFirstTimeVisit;
