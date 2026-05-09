/**
 * Haptic Patch Bay — per-tier haptic textures (Section 5b WOW factor)
 *
 * Tactile companion to the Hardware Handshake animation (Section 5a). Each
 * tier has a distinct haptic pattern that reinforces the modular-synth
 * metaphor — connecting a service should feel like patching a real piece of
 * audio gear.
 *
 * Tier patterns ("patch textures"):
 *   Tier 1 — "smooth electric":  single Heavy impact
 *             Clean, instant, decisive. Like an XLR socket clicking in.
 *
 *   Tier 2 — "heavy mechanical": Heavy → 120ms → Medium
 *             Double-pulse. The second beat confirms the latch.
 *
 *   Tier 3 — "industrial latch": Medium → 80ms → Medium → 120ms → Heavy
 *             Triple-pulse with weighted finale. Builds tension, then locks.
 *
 * iOS-only: Android haptic behaviour varies too widely across OEM firmware
 * to guarantee a consistent experience. The guard is centralised here so
 * callers don't need to know about it.
 *
 * `expo-haptics` is already installed; no APK rebuild needed.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { SOURCE_TIER, type SourceTier } from '../adapters/musicServiceAdapter';
import type { HandshakeSource } from './handshakeBus';

// ─── Helpers ──────────────────────────────────────────────────

/** Resolves to the next tick after `ms` milliseconds. */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Tier patterns ────────────────────────────────────────────

type HapticPattern = () => Promise<void>;

const TIER_PATTERNS: Record<SourceTier, HapticPattern> = {
  /**
   * Tier 1 — "smooth electric"
   * One clean Heavy impact. Fast, authoritative, no aftertaste.
   */
  1: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Tier 2 — "heavy mechanical"
   * Heavy → pause → Medium. Like a relay closing in two stages.
   */
  2: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(120);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * Tier 3 — "industrial latch"
   * Medium → pause → Medium → pause → Heavy.
   * Three beats with an ascending weight — builds anticipation, then locks.
   */
  3: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(80);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(120);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
};

// Last.fm isn't in SOURCE_TIER (metadata-only); treat as Tier 2.
const LASTFM_TIER: SourceTier = 2;

// ─── Public API ───────────────────────────────────────────────

/**
 * Fire the per-tier haptic pattern for a successfully connected provider.
 *
 * - iOS-only. Silently resolves on Android.
 * - Fire-and-forget: async but callers don't need to await it.
 * - Errors from expo-haptics (e.g. haptics not supported) are caught and
 *   silently discarded — a failed haptic must never break the auth flow.
 */
export async function fireHapticHandshake(source: HandshakeSource): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const tier: SourceTier = source === 'lastfm' ? LASTFM_TIER : SOURCE_TIER[source];
  const pattern = TIER_PATTERNS[tier];

  try {
    await pattern();
  } catch {
    // Haptics failing (e.g. device doesn't support them) should be invisible.
  }
}
