/**
 * PreviewBadge — Preview-only playback indicator chip.
 * ─────────────────────────────────────────────────────────────
 *
 * Cross-surface "30s" status chip for sources whose playback is
 * currently capped at 30-second previews (vs. full-length tracks).
 *
 * Renders a muted compact badge whenever the given source's
 * `playbackCapability` is `'preview'`. Returns `null` for sources
 * with full playback (`'full'`) or no playback (`'none'`) so call
 * sites can render `<PreviewBadge source={x} />` unconditionally —
 * the conditional lives inside the component, not duplicated at
 * every consumer.
 *
 * Why a shared primitive:
 *   The "30s only" reality of Apple Music / Tidal / Spotify in V1
 *   is a load-bearing UX truth — silently capping playback at 30s
 *   without telling the user is the kind of thing that erodes trust.
 *   Centralizing the visual rendering of the "this will only play
 *   30s" affordance — not just the classification — keeps every
 *   surface honest to a single chip, instead of slightly-different
 *   chips drifting over time. When Phase 3 SDK work lands and a
 *   source flips its `playbackCapability` from 'preview' to 'full'
 *   in SOURCE_META, every consumer surface updates automatically.
 *
 * Visual hierarchy:
 *   PreviewBadge is intentionally muted (silver/grey) so it reads as
 *   informational, not alarming. It can sit next to BetaBadge (orange)
 *   for sources like Spotify that are both restricted-beta AND
 *   preview-only — the two badges communicate distinct concerns
 *   (access requirement vs. playback capability) and shouldn't fight
 *   for the same visual weight.
 *
 * Currently used by:
 *   • TrackListItem (Convergence Strategy track rows)
 *   • MiniPlayer (now-playing strip)
 *   • SignalChainSheetV2 queue rows (session-v2 tactical surface)
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
import { isPreviewOnly } from '../../services/adapters/musicServiceAdapter';
import type { TrackSource } from '../../types';

// Note: this primitive uses react-native `Text` directly rather than the
// custom themed Text wrapper at `./Text`. Same reasoning as BetaBadge:
// the chip is a tightly-styled, surface-agnostic micro-component that owns
// all of its text properties explicitly. Using the variant wrapper would
// introduce a silent precedence collision between variant presets and
// per-chip overrides. Owning the text style here keeps the chip stable
// against future variant refactors in `./Text`.

export interface PreviewBadgeProps {
  /** Music source whose playback capability should be displayed */
  source: TrackSource;
  /**
   * Visual size variant. Default `'sm'`.
   * - `'sm'` — compact track rows, queue rows, search results
   * - `'md'` — larger row contexts (e.g. now-playing strip) where the
   *   surrounding title is bigger and a chunkier badge balances better
   */
  size?: 'sm' | 'md';
  /**
   * Optional layout overrides — typically `marginLeft` for inline
   * placement next to a label. Sizing/coloring lives inside the
   * component; spacing belongs to the parent.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional inner-text overrides — the escape hatch for surfaces that
   * want a different font (e.g. session-v2 tactical surfaces passing
   * `tacticalTokens.fonts.monoBold`). Primitives in `components/ui/`
   * can't import feature-scoped tokens directly, so call sites pass
   * the font through here. The base sizing (fontSize, weight, spacing)
   * is preserved unless explicitly overridden.
   */
  textStyle?: StyleProp<TextStyle>;
}

export function PreviewBadge({
  source,
  size = 'sm',
  style,
  textStyle,
}: PreviewBadgeProps) {
  // Single source of truth — defer to SOURCE_META.playbackCapability.
  // When Phase 3 SDK work flips a source from 'preview' to 'full', the
  // chip disappears automatically across every surface that uses it.
  if (!isPreviewOnly(source)) return null;

  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMd, style]}>
      <Text style={[styles.text, textStyle]}>30s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    // Muted silver — reads as informational/limitation, distinct from
    // BetaBadge's orange (which signals access restriction). The two
    // can coexist on a track row (e.g. Spotify is both beta + preview)
    // without competing for the same visual weight.
    borderColor: withAlpha(palette.silver, 0.45),
    backgroundColor: withAlpha(palette.silver, 0.12),
  },
  badgeMd: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // All text properties owned explicitly here — no variant inheritance.
  // If you need to override the font (e.g. session-v2 tactical surfaces
  // passing tacticalTokens.fonts.monoBold), use the `textStyle` prop.
  text: {
    color: palette.silver,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

export default PreviewBadge;
