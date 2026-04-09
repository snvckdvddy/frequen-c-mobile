/**
 * CrossMatchBadge — Cross-service discovery attribution chip.
 * ─────────────────────────────────────────────────────────────
 *
 * Renders a small "via {source}" badge whenever a track was discovered
 * on one service but resolved to another for playback (e.g., found on
 * Spotify's catalog, played back through Apple Music via an ISRC match).
 * Returns `null` when there is no cross-match, so call sites can render
 * `<CrossMatchBadge ... />` unconditionally — the conditional lives
 * inside the component, not duplicated at every consumer.
 *
 * Why a shared primitive:
 *   Phase 5's metadata-layer pattern (canonical plan: the Spotify
 *   Client Credentials path) produces tracks with two source fields:
 *   `source` (what plays) and `metadataSource` (what was searched).
 *   When they diverge, the UI needs to attribute the discovery to the
 *   original service. Centralizing the *visual rendering* of that
 *   signal — not just the classification — keeps every surface honest
 *   to a single affordance, instead of slightly-different chips
 *   drifting over time. This is the same argument that justifies
 *   `TierBadge`, and the implementation follows the same shape.
 *
 * Currently used by:
 *   • TrackListItem            (Convergence Strategy rows)
 *   • SignalChainTrackBlock    (session-v2 tactical patch bay)
 *
 * Future-proofing: the condition is generalized to "metadataSource and
 * source both present and different," not "Spotify-specific." If Phase 6
 * adds cross-match from another catalog (YouTube → Apple Music, say),
 * the chip already handles it — only the default label fallback needs
 * a branch, and the `label` prop lets call sites override even that.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { palette, withAlpha } from '../../design/tokens/materials';
import type { TrackSource } from '../../types';

// Note: this primitive uses react-native `Text` directly rather than the
// custom themed Text wrapper at `./Text`. Same reasoning as `TierBadge`:
// the chip is a tightly-styled, surface-agnostic micro-component that owns
// all of its text properties explicitly. Using the variant wrapper would
// introduce a silent precedence collision between variant presets and
// per-chip overrides. Owning the text style here keeps the chip stable
// against future variant refactors.

export interface CrossMatchBadgeProps {
  /** The track's playback source (where it will actually play from) */
  source?: TrackSource;
  /** The track's discovery source (where the search hit originated) */
  metadataSource?: TrackSource;
  /**
   * Display label override. Default is derived from `metadataSource`
   * (e.g., `'spotify'` → `'via Spotify'`). Pass an explicit label for
   * surface-specific typography cases — e.g., the tactical session-v2
   * patch bay passes `'VIA SPOTIFY'` to match its uppercase mono font.
   */
  label?: string;
  /**
   * Optional layout overrides — typically `marginLeft` for inline
   * placement next to a title. Coloring and sizing live inside the
   * component; spacing belongs to the parent.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional inner-text overrides — the escape hatch for surfaces that
   * want a different font family (e.g., session-v2 tactical surfaces
   * passing `tacticalTokens.fonts.mono`). Primitives in `components/ui/`
   * can't import feature-scoped tokens directly, so call sites pass the
   * font through here. Base sizing and color are preserved unless the
   * override sets them explicitly.
   */
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Derive a default display label from a discovery source. Only branches
 * for the sources Phase 5 actually produces (currently just Spotify).
 * Fallback is a lowercase "via {source}" so future sources render
 * *something* sane without breaking the chip.
 */
function defaultLabelFor(metadataSource: TrackSource): string {
  switch (metadataSource) {
    case 'spotify':
      return 'via Spotify';
    default:
      return `via ${metadataSource}`;
  }
}

export function CrossMatchBadge({
  source,
  metadataSource,
  label,
  style,
  textStyle,
}: CrossMatchBadgeProps) {
  // Only render when the track was discovered via one service but
  // resolved to a different one for playback. Both fields must be
  // present, and they must differ. Spotify-on-Spotify (the Tier 3
  // allowlist playback path) correctly returns null — no chip needed.
  if (!metadataSource || !source) return null;
  if (metadataSource === source) return null;

  const displayLabel = label ?? defaultLabelFor(metadataSource);

  return (
    <View
      style={[styles.badge, style]}
      accessibilityLabel={`Discovered ${displayLabel}`}
    >
      <Text style={[styles.text, textStyle]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Visual language mirrors `TierBadge`: same orange accent, same pill
  // shape, same border radius. "Restricted origin" signals should read
  // as one family across the app — TierBadge says "this provider is in
  // restricted-beta", CrossMatchBadge says "this result came from a
  // restricted provider and was resolved elsewhere." Related concepts,
  // related visuals.
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: withAlpha(palette.orange, 0.45),
    backgroundColor: withAlpha(palette.orange, 0.18),
    flexShrink: 0,
  },
  text: {
    color: palette.orange,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

export default CrossMatchBadge;
