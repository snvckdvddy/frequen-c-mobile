/**
 * BetaBadge — Restricted-beta access status chip.
 * ─────────────────────────────────────────────────────────────
 *
 * Cross-surface "BETA" status chip for sources whose access class
 * is `subscription-beta` (currently: Spotify under the closed-beta
 * allowlist).
 *
 * Renders an orange-tinted compact badge whenever the given source's
 * access class is `subscription-beta`. Returns `null` for any other
 * access class so call sites can render `<BetaBadge source={x} />`
 * unconditionally — the conditional lives inside the component, not
 * duplicated at every consumer.
 *
 * Why a shared primitive:
 *   The access-class model (SOURCE_META in musicServiceAdapter.ts) is
 *   the load-bearing piece of how Frequen-C communicates restricted
 *   access to users. Centralizing the visual rendering of the
 *   "this provider is in restricted-beta" affordance — not just the
 *   classification — keeps every surface honest to a single chip,
 *   instead of slightly-different chips drifting over time.
 *
 * Currently used by:
 *   • Library tab pills           (ServiceSelectorPills)
 *   • Search source filter pills  (SearchHudOverlay)
 *   • Patch bay rows              (ProfileScreen)
 *   • Signal chain queue rows     (SignalChainSheetV2)
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
import { getAccessForSource } from '../../services/adapters/musicServiceAdapter';
import type { TrackSource } from '../../types';

// Note: this primitive uses react-native `Text` directly rather than the
// custom themed Text wrapper at `./Text`. The wrapper exists to apply
// typography variants + color tokens — useful when you want to inherit
// a typographic preset. The BETA chip is a tightly-styled, surface-agnostic
// micro-component that owns all of its text properties explicitly, so the
// wrapper would only introduce a silent collision: every variant brings its
// own fontSize/fontWeight/letterSpacing that we'd have to override anyway,
// and the override-vs-variant precedence would depend on style-array order
// instead of being legible at the call site. Owning the text style here
// keeps the chip stable against future variant changes in `./Text`.

export interface BetaBadgeProps {
  /** Music source whose access class should be displayed */
  source: TrackSource;
  /**
   * Visual size variant. Default `'sm'`.
   * - `'sm'` — compact pill rows (Library, Search source filter)
   * - `'md'` — larger row contexts (Profile patch bay) where the
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

export function BetaBadge({
  source,
  size = 'sm',
  style,
  textStyle,
}: BetaBadgeProps) {
  // Single source of truth — defer to the access-class model. If a future
  // change adds another beta-restricted source, the chip moves with it
  // automatically.
  if (getAccessForSource(source) !== 'subscription-beta') return null;

  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMd, style]}>
      <Text style={[styles.text, textStyle]}>BETA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: withAlpha(palette.orange, 0.45),
    backgroundColor: withAlpha(palette.orange, 0.18),
  },
  badgeMd: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  // All text properties owned explicitly here — no variant inheritance.
  // If you need to override the font (e.g. session-v2 tactical surfaces
  // passing tacticalTokens.fonts.monoBold), use the `textStyle` prop.
  text: {
    color: palette.orange,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

export default BetaBadge;
