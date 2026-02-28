/**
 * ServiceIcon — Renders brand Glass Logo icons for music services.
 *
 * Uses real Icons8 Glass Logo assets for Spotify, Apple Music,
 * YouTube Music, and Discord. Falls back to Ionicons for
 * services without brand assets (SoundCloud, Tidal).
 */

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../../design/tokens/materials';

// ─── Brand icon registry ────────────────────────────────────
// Only services with Glass Logo assets get image sources.

const BRAND_ICONS: Record<string, any> = {
  spotify: require('../../../assets/service-icons/spotify.png'),
  'apple-music': require('../../../assets/service-icons/apple-music.png'),
  'youtube-music': require('../../../assets/service-icons/youtube-music.png'),
  discord: require('../../../assets/service-icons/discord.png'),
};

// Fallback Ionicons for services without brand assets
const FALLBACK_ICONS: Record<string, string> = {
  soundcloud: 'cloud-outline',
  tidal: 'water-outline',
};

// ─── Component ──────────────────────────────────────────────

interface ServiceIconProps {
  /** Service key — lowercase, hyphenated (e.g. 'spotify', 'apple-music') */
  service: string;
  /** Icon size in points (default 20) */
  size?: number;
  /** Whether the service is connected — affects fallback icon tint */
  connected?: boolean;
}

export function ServiceIcon({ service, size = 20, connected = false }: ServiceIconProps) {
  const brandSource = BRAND_ICONS[service.toLowerCase()];

  if (brandSource) {
    return (
      <Image
        source={brandSource}
        style={[styles.icon, { width: size, height: size }]}
        resizeMode="contain"
      />
    );
  }

  // Fallback to Ionicons
  const fallbackName = FALLBACK_ICONS[service.toLowerCase()] || 'musical-notes-outline';
  return (
    <Ionicons
      name={fallbackName as any}
      size={size * 0.7}
      color={connected ? palette.orange : palette.slate}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    // Glass Logo icons have transparent bg — render cleanly on dark surfaces
  },
});

export default ServiceIcon;
