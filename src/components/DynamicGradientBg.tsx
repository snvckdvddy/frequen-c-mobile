/**
 * DynamicGradientBg — Album-art-driven ambient gradient.
 *
 * Convergence Strategy §2.4:
 * Extract 2-3 dominant colors from current album art.
 * Apply as a subtle radial gradient behind the player,
 * fading into palette.void at edges.
 * Crossfade on track change over 800ms ease-in-out.
 *
 * Platform-normalized: iOS returns background/primary/secondary;
 * Android returns dominant/vibrant/darkVibrant.
 * We unify into { primary, secondary, accent } for gradient stops.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ImageColors from 'react-native-image-colors';
import type { ImageColorsResult } from 'react-native-image-colors';
import { colors } from '../theme/colors';

// ─── Types ─────────────────────────────────────────────────

interface GradientPalette {
  primary: string;
  secondary: string;
  accent: string;
}

interface DynamicGradientBgProps {
  /** Album art URI to extract colors from */
  imageUri?: string;
  /** Crossfade duration in ms (default 800) */
  fadeDuration?: number;
  /** Opacity cap for the gradient overlay (default 0.55) */
  maxOpacity?: number;
}

// ─── Defaults ──────────────────────────────────────────────

const VOID = colors.bg.primary;  // #06080F — deepest dark
const DEFAULT_PALETTE: GradientPalette = {
  primary: VOID,
  secondary: VOID,
  accent: VOID,
};

// ─── Normalize platform colors ─────────────────────────────

function normalizePalette(result: ImageColorsResult): GradientPalette {
  if (result.platform === 'ios') {
    return {
      primary: result.background || VOID,
      secondary: result.primary || VOID,
      accent: result.secondary || VOID,
    };
  }
  if (result.platform === 'android') {
    return {
      primary: result.dominant || VOID,
      secondary: result.darkVibrant || result.vibrant || VOID,
      accent: result.muted || result.darkMuted || VOID,
    };
  }
  // Web fallback
  if (result.platform === 'web') {
    return {
      primary: result.dominant || VOID,
      secondary: result.darkVibrant || result.vibrant || VOID,
      accent: result.muted || result.darkMuted || VOID,
    };
  }
  return DEFAULT_PALETTE;
}

/**
 * Darken a hex color by mixing it toward #000000.
 * Factor 0 = original, 1 = pure black.
 */
function darkenHex(hex: string, factor: number): string {
  try {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    const dr = Math.round(r * (1 - factor));
    const dg = Math.round(g * (1 - factor));
    const db = Math.round(b * (1 - factor));
    return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  } catch {
    return VOID;
  }
}

// ─── Component ─────────────────────────────────────────────

export function DynamicGradientBg({
  imageUri,
  fadeDuration = 800,
  maxOpacity = 0.55,
}: DynamicGradientBgProps) {
  const [palette, setPalette] = useState<GradientPalette>(DEFAULT_PALETTE);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!imageUri) {
      // No art → fade out to void
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: fadeDuration,
        useNativeDriver: true,
      }).start();
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Fade out current gradient
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: fadeDuration / 3,
          useNativeDriver: true,
        }).start();

        const result = await ImageColors.getColors(imageUri, {
          fallback: VOID,
          cache: true,
          key: imageUri,
          quality: 'low',
          ...(Platform.OS === 'android' ? { pixelSpacing: 10 } : {}),
        });

        if (cancelled) return;

        const normalized = normalizePalette(result);
        // Darken extracted colors to keep the player dark/moody
        setPalette({
          primary: darkenHex(normalized.primary, 0.4),
          secondary: darkenHex(normalized.secondary, 0.5),
          accent: darkenHex(normalized.accent, 0.6),
        });

        // Fade in new gradient
        Animated.timing(fadeAnim, {
          toValue: maxOpacity,
          duration: fadeDuration,
          useNativeDriver: true,
        }).start();
      } catch (err) {
        // Silent fail — just stay dark. No gradient is fine.
        console.warn('DynamicGradientBg: color extraction failed', err);
      }
    })();

    return () => { cancelled = true; };
  }, [imageUri, fadeDuration, maxOpacity]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="none">
      <LinearGradient
        colors={[palette.primary, palette.secondary, palette.accent, VOID]}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

export default DynamicGradientBg;
