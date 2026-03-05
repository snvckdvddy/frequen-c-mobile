/**
 * useVoltageSag — Battery-aware theme mode hook.
 *
 * When battery drops to ≤10%, enables "Voltage Sag" mode:
 * - UI shifts from icy cyan to warm amber palette
 * - Animations reduce to minimum
 * - Components can read `isVoltageSag` to conditionally style
 *
 * App Feature: "Voltage Sag (Low Battery Mode)"
 * Integrated during Phase 2 UX Convergence to avoid retrofitting.
 */

import { useState, useEffect, useCallback } from 'react';
import { palette } from '../design/tokens/materials';

// Voltage Sag palette — warm amber replaces icy cyan
const sagPalette = {
  accent: palette.amber,       // Warm amber replaces teal accent in sag mode
  accentGlow: 'rgba(255, 179, 71, 0.12)',
  accentSubtle: 'rgba(255, 179, 71, 0.08)',
  accentOverlay: 'rgba(255, 179, 71, 0.20)',
  accentText: palette.void,    // Dark text on amber buttons
} as const;

interface VoltageSagState {
  /** Whether Voltage Sag is active (battery ≤ 10%) */
  isVoltageSag: boolean;
  /** Current battery level (0-1), or null if unavailable */
  batteryLevel: number | null;
  /** Accent color — ice in normal mode, amber in sag mode */
  accent: string;
  /** Accent glow overlay */
  accentGlow: string;
  /** Whether animations should be reduced */
  reduceAnimations: boolean;
  /** Force sag on/off (for testing) */
  setForceSag: (force: boolean | null) => void;
}

const SAG_THRESHOLD = 0.10; // 10% battery

export function useVoltageSag(): VoltageSagState {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [forceSag, setForceSag] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function initBattery() {
      try {
        // Dynamically import expo-battery — graceful fallback if not installed
        const Battery = await import('expo-battery');

        // Get initial level
        const level = await Battery.getBatteryLevelAsync();
        if (mounted) setBatteryLevel(level);

        // Subscribe to changes
        const subscription = Battery.addBatteryLevelListener(({ batteryLevel: lvl }) => {
          if (mounted) setBatteryLevel(lvl);
        });

        return () => {
          subscription.remove();
        };
      } catch {
        // expo-battery not available — that's fine, sag mode just won't auto-trigger
        if (mounted) setBatteryLevel(null);
      }
    }

    const cleanup = initBattery();
    return () => {
      mounted = false;
      cleanup.then((fn) => fn?.()).catch(() => {});
    };
  }, []);

  const isVoltageSag = forceSag !== null
    ? forceSag
    : batteryLevel !== null && batteryLevel <= SAG_THRESHOLD;

  return {
    isVoltageSag,
    batteryLevel,
    accent: isVoltageSag ? sagPalette.accent : palette.orange,
    accentGlow: isVoltageSag ? sagPalette.accentGlow : palette.iceGlow,
    reduceAnimations: isVoltageSag,
    setForceSag: useCallback((force: boolean | null) => setForceSag(force), []),
  };
}

export { sagPalette };
export default useVoltageSag;
