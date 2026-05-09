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
import type { HandshakeSource } from './handshakeBus';

// ─── Helpers ──────────────────────────────────────────────────

/** Resolves to the next tick after `ms` milliseconds. */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─── Pattern map (per-source, named by haptic feel) ────────────
// Patterns describe the TACTILE feel, not an abstract tier number.
// Mapping is per-HandshakeSource directly — simpler than going through
// the access-class indirection because the pattern choice is about
// emotional weight (rare/restricted = bigger reward), and not all
// access classes deserve different feels (subscription Apple Music
// and subscription Tidal can share the same pattern without losing
// meaning).

type HapticPatternKey = 'smooth-electric' | 'heavy-mechanical' | 'industrial-latch';
type HapticPattern = () => Promise<void>;

const PATTERNS: Record<HapticPatternKey, HapticPattern> = {
  /**
   * "smooth electric" — one clean Heavy impact.
   * Fast, authoritative, no aftertaste. The lightest tactile reward
   * for sources that connect with minimal ceremony.
   */
  'smooth-electric': async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * "heavy mechanical" — Heavy → pause → Medium.
   * Two-stage relay close. The default for paid streaming subscriptions —
   * a moderate reward that confirms a real connection has been latched.
   */
  'heavy-mechanical': async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await delay(120);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * "industrial latch" — Medium → Medium → Heavy.
   * Triple-pulse with ascending weight. Reserved for the
   * subscription-beta tier (Spotify) — the rarest connection, biggest
   * tactile payoff to match.
   */
  'industrial-latch': async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(80);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(120);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
};

const SOURCE_PATTERN: Record<HandshakeSource, HapticPatternKey> = {
  // Subscription streaming — moderate reward
  appleMusic: 'heavy-mechanical',
  soundcloud: 'heavy-mechanical',
  tidal: 'heavy-mechanical',
  // Subscription + beta allowlist — biggest reward
  spotify: 'industrial-latch',
  // Last.fm (scrobble/metadata) — lightest reward
  lastfm: 'smooth-electric',
};

// ─── Public API ───────────────────────────────────────────────

/**
 * Fire the per-source haptic pattern for a successfully connected provider.
 *
 * - iOS-only. Silently resolves on Android.
 * - Fire-and-forget: async but callers don't need to await it.
 * - Errors from expo-haptics (e.g. haptics not supported) are caught and
 *   silently discarded — a failed haptic must never break the auth flow.
 */
export async function fireHapticHandshake(source: HandshakeSource): Promise<void> {
  if (Platform.OS !== 'ios') return;

  const patternKey = SOURCE_PATTERN[source];
  const pattern = PATTERNS[patternKey];

  try {
    await pattern();
  } catch {
    // Haptics failing (e.g. device doesn't support them) should be invisible.
  }
}
