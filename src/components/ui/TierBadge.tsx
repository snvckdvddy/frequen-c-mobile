/**
 * TierBadge — Source tier indicator chip.
 * ─────────────────────────────────────────────────────────────
 *
 * Cross-surface "BETA" status chip for Tier 3 music sources.
 *
 * Renders an orange-tinted compact badge whenever the given source
 * is classified as Tier 3 in the tier model (musicServiceAdapter).
 * Returns `null` for Tier 1 and Tier 2 sources so call sites can
 * render `<TierBadge source={x} />` unconditionally — the conditional
 * lives inside the component, not duplicated at every consumer.
 *
 * Why a shared primitive:
 *   The tier model is the load-bearing piece of the Frequen-C
 *   post-Spotify-wall response (see plans/modular-tinkering-robin.md).
 *   Centralizing the visual rendering of the tier signal — not just
 *   the classification — keeps every surface honest to a single
 *   "this provider is in restricted-beta" affordance, instead of
 *   slightly-different chips drifting over time.
 *
 * Currently used by:
 *   • Library tab pills           (ServiceSelectorPills)
 *   • Search source filter pills  (SearchHudOverlay)
 *   • Patch bay rows              (ProfileScreen)
 */

import React from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
  type StyleProp,
} from 'react-native';
import { Text } from './Text';
import { palette, withAlpha } from '../../design/tokens/materials';
import { getTierForSource } from '../../services/adapters/musicServiceAdapter';
import type { TrackSource } from '../../types';

export interface TierBadgeProps {
  /** Music source whose tier should be displayed */
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

export function TierBadge({
  source,
  size = 'sm',
  style,
  textStyle,
}: TierBadgeProps) {
  // Single source of truth — defer to the tier model. If a future change
  // promotes another source to Tier 3, the chip moves with it automatically.
  if (getTierForSource(source) !== 3) return null;

  return (
    <View style={[styles.badge, size === 'md' && styles.badgeMd, style]}>
      <Text
        variant="labelSmall"
        color={palette.orange}
        style={[styles.text, textStyle]}
      >
        BETA
      </Text>
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
  text: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});

export default TierBadge;
