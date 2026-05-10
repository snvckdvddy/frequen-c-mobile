/**
 * PatchCablesProviderRow
 *
 * One row in the PATCH CABLES section of ProfileScreen — represents a
 * single music/scrobbling service (Apple Music, SoundCloud, Tidal,
 * Spotify, Last.fm). Renders the service icon + name + status string +
 * action button (PATCH / UNPATCH / RECONNECT / OPENING… / AUTO).
 *
 * Why this is a separate, memoized component:
 *
 *   ProfileScreen has ~950 lines of JSX with many useState hooks. Every
 *   tap on a PATCH/UNPATCH button caused a synchronous re-render of the
 *   entire screen tree (PROVIDERS.map + SonicAuraCard + LOCAL ROUTING +
 *   SECURITY + CONFIG BUS sections). On a real phone that's a 500-1500ms
 *   blocking work window during which the JS thread can't service touch
 *   events — felt to the user as "the whole screen freezes for 1-2
 *   seconds when I tap PATCH or UNPATCH."
 *
 *   Extracting the row + wrapping in `React.memo` means a tap on row N
 *   re-renders ONLY row N, not the other 4 rows or any other section.
 *   The parent still re-renders (it owns pendingProvider state), but
 *   the children with unchanged primitive props short-circuit.
 *
 *   For this to work, the parent must:
 *   1. Pass primitive props (booleans/strings) instead of objects whose
 *      reference identity might change on every parent render.
 *   2. Use `useCallback` for the callback props (onConnect /
 *      onDisconnectPrompt) so their reference stays stable across
 *      parent re-renders.
 *
 * Props design rationale:
 *
 *   The parent computes connected/isExpired/blocked/status once per row
 *   (it has `profileUser?.connectedServices` in scope) and passes them
 *   in. The row stays purely presentational — given these primitives,
 *   it always renders the same JSX. This is what makes shallow-compare
 *   in `React.memo` correct.
 *
 *   We do NOT pass the raw `service: ServiceConnection | undefined`
 *   object as a prop because the connectedServices object is replaced
 *   wholesale on every user-state update (per the SET_USER reducer
 *   action), which would change reference identity and defeat the memo
 *   even when the underlying connection state is unchanged.
 */

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { ServiceIcon } from '../../components/icons/ServiceIcon';
import { BetaBadge } from '../../components/ui';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';
import { tapMedium } from '../../utils/haptics';
import { getAccessForSource } from '../../services/adapters/musicServiceAdapter';
import type { DisconnectableProvider } from '../../services/api';
import type { TrackSource } from '../../types';

// Type guard: which DisconnectableProvider values are also valid
// TrackSource values (i.e. actual playback sources, not scrobbling/
// social services)? Mirror of the same predicate in ProfileScreen.tsx
// — kept local here so this row is self-contained and the parent doesn't
// have to pass the predicate as a prop. Last.fm is the outlier we
// exclude (it's a scrobbling service, not a playback source).
type MusicProvider = Extract<DisconnectableProvider, TrackSource>;
const isMusicTrackSource = (
  p: DisconnectableProvider | undefined,
): p is MusicProvider =>
  p === 'spotify' || p === 'soundcloud' || p === 'tidal' || p === 'appleMusic';

export interface PatchCablesProviderEntry {
  label: string;
  serviceKey: string;
  provider?: DisconnectableProvider;
  key: string;
  alwaysOn?: boolean;
}

export interface PatchCablesProviderRowProps {
  entry: PatchCablesProviderEntry;
  /** True for the last row in the list — controls divider rendering. */
  isLast: boolean;
  /** True if this provider's connection is currently active (or alwaysOn). */
  connected: boolean;
  /** True if the stored token has expired (PATCHED · EXPIRED state). */
  isExpired: boolean;
  /** True if the provider is blocked by missing config (mobile or backend). */
  blocked: boolean;
  /** Pre-computed status string (e.g. "PATCHED // @USER", "READY TO PATCH"). */
  status: string;
  /** True if THIS row's connect flow is currently mid-launch (shows OPENING…). */
  isPending: boolean;
  /** True if a SIBLING row is mid-launch (this row should appear muted/disabled). */
  isAnotherPending: boolean;
  /** Triggered on PATCH/RECONNECT taps — parent's startConnect helper. */
  onConnect: (provider: DisconnectableProvider, label: string) => void;
  /** Triggered on UNPATCH tap — parent opens the disconnect confirm prompt. */
  onDisconnectPrompt: (provider: DisconnectableProvider, name: string) => void;
}

function PatchCablesProviderRowImpl({
  entry,
  isLast,
  connected,
  isExpired,
  blocked,
  status,
  isPending,
  isAnotherPending,
  onConnect,
  onDisconnectPrompt,
}: PatchCablesProviderRowProps) {
  const isRestrictedBeta =
    isMusicTrackSource(entry.provider) &&
    getAccessForSource(entry.provider) === 'subscription-beta';

  // A11y mirrors the three-way visible label: RECONNECT for expired,
  // Disconnect for live, Connect for fresh. Without the isExpired branch,
  // a screen reader would announce "Disconnect Spotify" on a button that
  // actually re-runs the OAuth patch — user-hostile for assistive tech.
  const baseA11y = isExpired
    ? `Reconnect ${entry.label}`
    : `${connected ? 'Unpatch' : 'Patch'} ${entry.label}`;
  const buttonA11y = isRestrictedBeta ? `${baseA11y}, restricted beta` : baseA11y;

  const handlePress = useCallback(() => {
    // Guard: another row's connect flow is mid-launch — ignore this tap so
    // we don't pile up multiple OAuth opens.
    if (isAnotherPending) return;
    if (!entry.provider) return;
    // isExpired branch must come BEFORE the `connected` branch — an expired
    // token still has connected===true, so the old order would route to the
    // Disconnect confirm dialog and force a three-tap dance (UNPATCH →
    // confirm → PATCH) for a one-tap reflow.
    if (isExpired) {
      tapMedium();
      onConnect(entry.provider, entry.label);
      return;
    }
    if (connected) {
      tapMedium();
      onDisconnectPrompt(entry.provider, entry.label);
      return;
    }
    tapMedium();
    onConnect(entry.provider, entry.label);
  }, [entry.provider, entry.label, isAnotherPending, isExpired, connected, onConnect, onDisconnectPrompt]);

  const a11yState: { disabled: boolean; busy: boolean } = {
    disabled: blocked || isAnotherPending,
    busy: isPending,
  };

  const buttonStyle = ({ pressed }: { pressed: boolean }): StyleProp<TextStyle>[] => [
    styles.providerAction,
    // Reconnect takes the neutral "default" style, not the danger style.
    // Danger red signals destructive intent — reconnect is a restore
    // action, the opposite of destructive.
    isExpired
      ? styles.providerActionDefault
      : connected
        ? styles.providerActionDanger
        : blocked
          ? styles.providerActionMuted
          : styles.providerActionDefault,
    pressed ? styles.pressed : null,
    isAnotherPending ? styles.providerActionMuted : null,
  ];

  return (
    <View style={!isLast ? styles.divider : undefined}>
      <View style={styles.providerRow}>
        <View style={styles.providerMeta}>
          <View style={styles.providerIcon}>
            <ServiceIcon service={entry.serviceKey} size={18} connected={connected} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.providerTitleRow}>
              <Text style={[textStyles.display, styles.providerTitle]}>{entry.label}</Text>
              {isMusicTrackSource(entry.provider) && (
                <BetaBadge
                  source={entry.provider}
                  size="md"
                  textStyle={styles.betaBadgeMono}
                />
              )}
            </View>
            <Text style={[textStyles.mono, styles.providerStatus]}>{status}</Text>
          </View>
        </View>
        {entry.alwaysOn ? (
          <View style={[styles.providerAction, styles.providerActionMuted]}>
            <Text style={[textStyles.monoBold, styles.providerActionText]}>AUTO</Text>
          </View>
        ) : (
          <Pressable
            onPress={handlePress}
            // Disable the *other* PATCH/UNPATCH buttons while one is mid-launch.
            // The pending button itself stays interactive (the handlePress guard
            // catches re-taps) so its pressed style still gives tactile feedback.
            disabled={isAnotherPending}
            accessibilityRole="button"
            accessibilityLabel={buttonA11y}
            accessibilityState={a11yState}
            style={buttonStyle}
          >
            {isPending ? (
              <View style={styles.providerActionPending}>
                <ActivityIndicator size="small" color={tacticalTokens.colors.white} />
                <Text style={[textStyles.monoBold, styles.providerActionText]}>OPENING</Text>
              </View>
            ) : (
              <Text style={[textStyles.monoBold, styles.providerActionText]}>
                {isExpired ? 'RECONNECT' : connected ? 'UNPATCH' : 'PATCH'}
              </Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

/**
 * Memoized export — sibling rows skip re-render when they're unchanged.
 *
 * Default shallow comparison works because all props are primitives or
 * useCallback-stabilized references. If callers ever start passing
 * non-primitive props (e.g. a service object), update this to use a
 * custom areEqual function — otherwise the memo silently no-ops on
 * changed-by-reference-only props.
 */
export const PatchCablesProviderRow = React.memo(PatchCablesProviderRowImpl);

// ─── Styles ─────────────────────────────────────────────────────────
//
// Copied from ProfileScreen.tsx so the row is self-contained. The
// parent's StyleSheet still has equivalents (slight duplication is OK
// here — the alternative is exporting styles from ProfileScreen.tsx,
// which is an unusual pattern, or threading them as props, which is
// verbose). If style drift becomes a concern, dedupe by extracting a
// shared `patchCablesStyles.ts` module.

const textStyles = StyleSheet.create({
  mono: { fontFamily: tacticalTokens.fonts.mono },
  monoBold: { fontFamily: tacticalTokens.fonts.monoBold },
  display: { fontFamily: tacticalTokens.fonts.display },
});

const styles = StyleSheet.create({
  divider: { borderBottomWidth: 1, borderBottomColor: tacticalTokens.colors.borderSoft },
  providerRow: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  providerMeta: { flexDirection: 'row', gap: 12, alignItems: 'center', flex: 1 },
  providerIcon: { width: 40, height: 40, borderWidth: 1, borderColor: tacticalTokens.colors.border, backgroundColor: tacticalTokens.colors.matte, alignItems: 'center', justifyContent: 'center' },
  providerTitle: { fontSize: 16, color: tacticalTokens.colors.white },
  providerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  providerStatus: { marginTop: 2, fontSize: 10, color: tacticalTokens.colors.textMuted, letterSpacing: 1.2 },
  // Layering rule: components/ui/ primitives can't import session-v2 tokens,
  // so this surface opts in via the textStyle prop on BetaBadge.
  betaBadgeMono: {
    fontFamily: tacticalTokens.fonts.monoBold,
    letterSpacing: 0.7,
  },
  providerAction: { minWidth: 92, minHeight: 44, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  // Inline row layout for the pending state — spinner + "OPENING" label
  // sit side by side with consistent spacing.
  providerActionPending: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  providerActionDefault: { borderColor: tacticalTokens.colors.ice, backgroundColor: '#04161A' },
  providerActionDanger: { borderColor: tacticalTokens.colors.orange, backgroundColor: '#1A120D' },
  providerActionMuted: { borderColor: tacticalTokens.colors.borderGhost, backgroundColor: tacticalTokens.colors.matte },
  providerActionText: { fontSize: 10, color: tacticalTokens.colors.white, letterSpacing: 1.5 },
  pressed: { opacity: 0.82 },
});
