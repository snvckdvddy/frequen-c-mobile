/**
 * Font Loading Utility
 * ─────────────────────────────────────────────────────────────
 * Wraps expo-font to load all design system fonts.
 * Use in App.tsx or root layout before rendering any UI.
 *
 * Usage:
 *   const [fontsLoaded] = useDesignFonts();
 *   if (!fontsLoaded) return <SplashScreen />;
 */

import { useFonts, FontSource } from 'expo-font';
import { fontAssets } from './tokens/typography';

/**
 * Hook that loads all Frequen-C design system fonts.
 * Returns [loaded: boolean, error: Error | null].
 */
export function useDesignFonts() {
  return useFonts(fontAssets as Record<string, FontSource>);
}

/**
 * For imperative loading (outside React components).
 * Returns a promise that resolves when fonts are ready.
 */
export { fontAssets };
