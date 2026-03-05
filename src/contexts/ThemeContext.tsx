import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import * as Battery from 'expo-battery';
import { palette, glow } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { setVoltageSag as setPlaybackSag } from '../services/playbackEngine';

// ─── Sag Palette (warm amber replaces icy cyan) ─────────────
const SAG_THRESHOLD = 0.10;

const sagOverrides = {
  // Primary accent shifts orange → warm amber
  orange: palette.amber,
  orangeGlow: 'rgba(255, 179, 71, 0.30)',
  orangeDim: palette.amber,
  // Secondary accent shifts ice → amber glow
  ice: palette.amber,
  iceGlow: 'rgba(255, 179, 71, 0.25)',
} as const;

const sagSemanticOverrides = {
  accentPrimary: sagOverrides.orange,
  accentPrimaryGlow: sagOverrides.orangeGlow,
  accentPrimaryDim: sagOverrides.orangeDim,
  accentPrimarySubtle: 'rgba(255, 179, 71, 0.10)',
  accentSecondary: sagOverrides.ice,
  accentSecondaryGlow: sagOverrides.iceGlow,
  accentSecondarySubtle: 'rgba(255, 179, 71, 0.08)',
  borderActive: sagOverrides.orange,
  cvSpend: sagOverrides.orange,
} as const;

// ─── Context Shape ──────────────────────────────────────────
interface ThemeContextType {
  /** Whether Voltage Sag mode is active (battery ≤ 10%) */
  isVoltageSag: boolean;
  /** Battery level 0-1, or null if unavailable */
  batteryLevel: number | null;
  /** Sag-aware raw palette (use for design system internals) */
  themeColors: typeof palette;
  /** Sag-aware semantic colors (use in screens & components) */
  semanticColors: typeof colors;
  /** Whether to reduce animations for battery savings */
  reduceAnimations: boolean;
  /** Accent color — always correct for current mode */
  accent: string;
  /** Accent glow — always correct for current mode */
  accentGlow: string;
  /** LED variant — 'amber' in sag, 'ice' in normal */
  ledVariant: 'ice' | 'amber';
}

const ThemeContext = createContext<ThemeContextType>({
  isVoltageSag: false,
  batteryLevel: null,
  themeColors: palette,
  semanticColors: colors,
  reduceAnimations: false,
  accent: palette.orange,
  accentGlow: palette.orangeGlow,
  ledVariant: 'ice',
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isVoltageSag, setIsVoltageSag] = useState(false);

  useEffect(() => {
    const checkBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        setBatteryLevel(level);
        setIsVoltageSag(level > 0 && level <= SAG_THRESHOLD);
      } catch {
        // Battery API not available (simulator, web) — no sag
        setBatteryLevel(null);
      }
    };
    checkBattery();

    const subscription = Battery.addBatteryLevelListener(({ batteryLevel: lvl }) => {
      setBatteryLevel(lvl);
      setIsVoltageSag(lvl <= SAG_THRESHOLD);
    });

    return () => subscription.remove();
  }, []);

  // Sync Voltage Sag state to playback engine for audio degradation
  useEffect(() => {
    setPlaybackSag(isVoltageSag).catch(() => {});
  }, [isVoltageSag]);

  const value = useMemo<ThemeContextType>(() => {
    if (!isVoltageSag) {
      return {
        isVoltageSag: false,
        batteryLevel,
        themeColors: palette,
        semanticColors: colors,
        reduceAnimations: false,
        accent: palette.orange,
        accentGlow: palette.orangeGlow,
        ledVariant: 'ice',
      };
    }
    return {
      isVoltageSag: true,
      batteryLevel,
      themeColors: { ...palette, ...sagOverrides } as unknown as typeof palette,
      semanticColors: { ...colors, ...sagSemanticOverrides } as unknown as typeof colors,
      reduceAnimations: true,
      accent: sagOverrides.orange,
      accentGlow: sagOverrides.orangeGlow,
      ledVariant: 'amber',
    };
  }, [isVoltageSag, batteryLevel]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/** Use sag-aware theme anywhere in the app */
export const useTheme = () => useContext(ThemeContext);
