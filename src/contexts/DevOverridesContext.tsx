/**
 * DevOverridesContext — in-memory runtime overrides for dev-panel testing.
 *
 * Distinct from useDevMode (which is just the activation flag stored in
 * AsyncStorage). These overrides are deliberately NOT persisted — they
 * reset on every app launch. That's correct behavior: testing overrides
 * shouldn't accidentally bleed into a real-use session.
 *
 * Current overrides:
 *   - isHostOverride: when non-null, replaces the real isHost computation
 *     in SessionRoomScreen. Lets the operator preview non-host UI as a
 *     single user without needing a second device + account.
 *
 * Add new overrides here as the dev panel grows. Each one needs:
 *   1. A field on the DevOverrides interface
 *   2. A setter on the context value
 *   3. A consumer somewhere in the app that reads from it
 *
 * The pattern is intentionally lightweight — single Context, single
 * state object, no per-field event bus. Dev tooling stays simple.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface DevOverrides {
  /**
   * When non-null, overrides the real isHost computation in
   * SessionRoomScreen + downstream consumers. `true` previews host
   * UI as a non-host; `false` previews non-host UI as a host.
   * `null` means "use real isHost computation."
   */
  isHostOverride: boolean | null;
}

interface DevOverridesContextValue extends DevOverrides {
  setIsHostOverride: (value: boolean | null) => void;
  /** Reset all overrides to defaults (null). */
  resetOverrides: () => void;
}

const DEFAULT_OVERRIDES: DevOverrides = {
  isHostOverride: null,
};

const DevOverridesContext = createContext<DevOverridesContextValue | undefined>(undefined);

export function DevOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<DevOverrides>(DEFAULT_OVERRIDES);

  const setIsHostOverride = useCallback((value: boolean | null) => {
    setOverrides((prev) => ({ ...prev, isHostOverride: value }));
  }, []);

  const resetOverrides = useCallback(() => {
    setOverrides(DEFAULT_OVERRIDES);
  }, []);

  const value = useMemo<DevOverridesContextValue>(
    () => ({
      ...overrides,
      setIsHostOverride,
      resetOverrides,
    }),
    [overrides, setIsHostOverride, resetOverrides],
  );

  return (
    <DevOverridesContext.Provider value={value}>
      {children}
    </DevOverridesContext.Provider>
  );
}

export function useDevOverrides(): DevOverridesContextValue {
  const context = useContext(DevOverridesContext);
  if (!context) {
    // When not wrapped in the provider (shouldn't happen since App.tsx
    // mounts it), degrade gracefully — return defaults + no-op setters
    // so consumers don't have to handle "context missing" explicitly.
    return {
      ...DEFAULT_OVERRIDES,
      setIsHostOverride: () => {},
      resetOverrides: () => {},
    };
  }
  return context;
}

/**
 * Helper for consumers that want the effective isHost (real or
 * overridden). Pure function — no hooks — so it can be used in
 * places that already have devOverrides in scope.
 */
export function resolveEffectiveIsHost(
  realIsHost: boolean,
  devMode: boolean,
  isHostOverride: boolean | null,
): boolean {
  if (devMode && isHostOverride !== null) {
    return isHostOverride;
  }
  return realIsHost;
}
