/**
 * FirstSourcePickerScreen
 *
 * The single-task screen that follows WelcomeBootScreen for first-run users.
 * Shown ONLY after a fresh registration (gated by the `welcomeBootState`
 * flag, same mechanism as WelcomeBootScreen).
 *
 * Why this screen exists (research-backed):
 *   - NN/g activation studies: time-to-first-value is the dominant retention
 *     signal in onboarding funnels. Every step between "I just registered"
 *     and "I connected my music" depletes intent.
 *   - Hick's Law: a single-task screen has measurably higher completion
 *     than a multi-task settings page where the user has to find the
 *     right section.
 *   - Krug / progressive disclosure: new users don't need to see SECURITY,
 *     biometric toggles, theme settings, etc. before they've connected
 *     a service. Show them only what they need for the immediate decision.
 *
 * The previous flow (Welcome → CONNECT A SERVICE → reset to Profile) made
 * users scroll past unrelated settings to find the providers. This replaces
 * that landing point with a 2x2 tile grid focused on one decision.
 *
 * After a tile tap, the existing handshakeBus / Hardware Handshake animation
 * fires automatically when the OAuth flow completes (the bus subscriber is
 * mounted at the App.tsx level, so it works regardless of which screen is
 * active when OAuth resolves).
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeScreen } from '../components/ui';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { palette, withAlpha } from '../design/tokens/materials';
import { ServiceIcon } from '../components/icons/ServiceIcon';
import type { HandshakeSource } from '../services/handshake/handshakeBus';

interface FirstSourcePickerScreenProps {
  /** Called after a tile is tapped — AppNavigator handles the navigate-to-Tabs. */
  onSelected: (source: HandshakeSource) => void;
  /** Called when "Skip for now" is tapped. */
  onSkipped: () => void;
}

function MonoText(props: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text {...props} />;
}

// ─── Provider catalog ─────────────────────────────────────────
// Last.fm is intentionally excluded — it's a scrobbling/metadata
// service, not a playback source. This screen is for "pick where
// your tracks come from" decisions only.
//
// Reframed 2026-05-09 from abstract "TIER 1/2/3" labels to concrete
// access requirements ("SUBSCRIPTION", "BETA · SUBSCRIPTION").
// The prior labels were Frequen-C-product abstractions that didn't
// match how the underlying services actually gate playback. Apple
// Music being labeled "TIER 1" implied universal access — but full
// playback always requires an Apple Music subscription. Honest
// labels at the picker means users know what they need *before*
// they tap a tile and run an OAuth flow that ends in a
// preview-only experience. Frequen-C is a streaming-first app;
// connecting a service without a subscription gives at best 30s
// previews, which is worse than not connecting it at all.
//
// The underlying SOURCE_TIER mapping in musicServiceAdapter.ts is
// unchanged — those tiers drive cross-match resolution priority
// and other product logic. This refactor only changes how the
// tiers are *presented* to users on the picker.

type AccessClass = 'subscription' | 'subscription-beta';

interface ProviderTile {
  source: HandshakeSource;
  serviceKey: string; // for ServiceIcon
  label: string;
  access: AccessClass;
  badge: string;
}

const PROVIDER_TILES: ProviderTile[] = [
  {
    source: 'appleMusic',
    serviceKey: 'apple-music',
    label: 'APPLE MUSIC',
    access: 'subscription',
    badge: 'SUBSCRIPTION',
  },
  {
    source: 'soundcloud',
    serviceKey: 'soundcloud',
    label: 'SOUNDCLOUD',
    access: 'subscription',
    badge: 'SUBSCRIPTION',
  },
  {
    source: 'tidal',
    serviceKey: 'tidal',
    label: 'TIDAL',
    access: 'subscription',
    badge: 'SUBSCRIPTION',
  },
  {
    source: 'spotify',
    serviceKey: 'spotify',
    label: 'SPOTIFY',
    access: 'subscription-beta',
    badge: 'BETA · SUBSCRIPTION',
  },
];

// Accent + glow per access class. Same Hardware-Handshake-aligned
// palette. Subscription-required services share the ice (teal)
// accent — they're functionally equivalent from a "what do I need"
// standpoint. Spotify's BETA + SUBSCRIPTION combo gets orange to
// signal the additional restriction (allowlist) on top of subscription.
const ACCESS_ACCENT: Record<AccessClass, string> = {
  subscription: palette.ice,
  'subscription-beta': palette.orange,
};

const ACCESS_GLOW: Record<AccessClass, string> = {
  subscription: palette.iceGlow,
  'subscription-beta': palette.orangeGlow,
};

// ─── Component ────────────────────────────────────────────────

export function FirstSourcePickerScreen({ onSelected, onSkipped }: FirstSourcePickerScreenProps) {
  const auth = useAuth();
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [pendingSource, setPendingSource] = useState<HandshakeSource | null>(null);

  const handleTile = useCallback(
    async (tile: ProviderTile) => {
      if (pendingSource) return; // ignore double-taps
      setPendingSource(tile.source);

      // Fire-and-forget the connect handler. The OAuth flow opens in the
      // browser; when it resolves, AuthContext fires handshakeBus.fire(...)
      // automatically, which renders the Hardware Handshake animation
      // wherever the user has navigated to in the meantime.
      try {
        switch (tile.source) {
          case 'spotify':
            void auth.connectSpotify();
            break;
          case 'soundcloud':
            void auth.connectSoundcloud();
            break;
          case 'tidal':
            void auth.connectTidal();
            break;
          case 'appleMusic':
            void auth.connectAppleMusic();
            break;
        }
      } catch (err) {
        console.error('[FirstSourcePicker] connect kickoff threw:', err);
      }

      // Navigate forward immediately. If the user cancels OAuth, they
      // land on Home with no provider connected — they can retry from
      // Profile / Patch Cables. This matches existing connect UX.
      onSelected(tile.source);
    },
    [auth, onSelected, pendingSource]
  );

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.4} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Headline */}
            <View style={styles.headline}>
              <MonoText style={styles.eyebrow}>SYS.FREQ // PATCH BAY</MonoText>
              <View accessibilityRole="header">
                <MonoText style={styles.title}>PICK YOUR FIRST SOURCE</MonoText>
              </View>
              <MonoText style={styles.subtitle}>
                Connect a music service to queue tracks. You can add more later.
              </MonoText>
            </View>

            {/* 2x2 tile grid */}
            <View style={styles.grid}>
              {PROVIDER_TILES.map((tile) => {
                const accent = ACCESS_ACCENT[tile.access];
                const glow = ACCESS_GLOW[tile.access];
                const isPending = pendingSource === tile.source;
                const isDisabled = pendingSource !== null && !isPending;

                return (
                  <Pressable
                    key={tile.source}
                    onPress={() => handleTile(tile)}
                    disabled={isDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={`Connect ${tile.label}, ${tile.badge}`}
                    accessibilityState={{ disabled: isDisabled, busy: isPending }}
                    style={({ pressed }) => [
                      styles.tile,
                      { borderColor: accent, shadowColor: accent },
                      pressed && !isDisabled && styles.tilePressed,
                      isPending && { backgroundColor: glow },
                      isDisabled && styles.tileDisabled,
                    ]}
                  >
                    <View style={styles.tileIcon}>
                      <ServiceIcon service={tile.serviceKey} size={36} connected={false} />
                    </View>
                    <MonoText style={styles.tileLabel}>{tile.label}</MonoText>
                    <View style={[styles.tierPill, { borderColor: accent }]}>
                      <MonoText style={[styles.tierPillText, { color: accent }]}>
                        {tile.badge}
                      </MonoText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Access-class explainer — expandable */}
            <Pressable
              onPress={() => setExplainerOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel="What do these labels mean"
              accessibilityState={{ expanded: explainerOpen }}
              style={({ pressed }) => [
                styles.explainerToggle,
                pressed && styles.explainerTogglePressed,
              ]}
            >
              <MonoText style={styles.explainerToggleText}>
                WHAT DO THESE LABELS MEAN?
              </MonoText>
              <Ionicons
                name={explainerOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={palette.silver}
              />
            </Pressable>

            {explainerOpen && (
              <View style={styles.explainerBody}>
                <MonoText style={styles.explainerIntro}>
                  Frequen-C plays full tracks, not previews. Connect a service you
                  have an active subscription with — otherwise the service will
                  return 30-second samples instead of the song.
                </MonoText>
                <View style={styles.explainerRow}>
                  <View style={[styles.explainerDot, { backgroundColor: ACCESS_ACCENT['subscription'] }]} />
                  <View style={styles.explainerText}>
                    <MonoText style={styles.explainerTitle}>SUBSCRIPTION</MonoText>
                    <MonoText style={styles.explainerCopy}>
                      Requires an active paid subscription with the service. No
                      subscription means no full-track playback.
                    </MonoText>
                  </View>
                </View>
                <View style={styles.explainerRow}>
                  <View style={[styles.explainerDot, { backgroundColor: ACCESS_ACCENT['subscription-beta'] }]} />
                  <View style={styles.explainerText}>
                    <MonoText style={styles.explainerTitle}>BETA · SUBSCRIPTION</MonoText>
                    <MonoText style={styles.explainerCopy}>
                      Subscription required AND your device has to be on the
                      Frequen-C beta allowlist. Search and discovery work for
                      everyone; full-track playback is gated until we exit beta.
                    </MonoText>
                  </View>
                </View>
              </View>
            )}

            {/* Skip — small, low emphasis (escape hatch, not a feature) */}
            <Pressable
              onPress={onSkipped}
              accessibilityRole="button"
              accessibilityLabel="Skip for now"
              style={({ pressed }) => [
                styles.skipButton,
                pressed && styles.skipPressed,
              ]}
            >
              <MonoText style={styles.skipText}>Skip for now</MonoText>
            </Pressable>
          </ScrollView>
        </View>
      </VoidSurface>
    </SafeScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xl,
  },

  // Headline block
  headline: {
    marginBottom: tacticalTokens.spacing.xl,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.6,
    marginBottom: tacticalTokens.spacing.sm,
  },
  title: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
    marginBottom: tacticalTokens.spacing.md,
  },
  subtitle: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    lineHeight: 21,
    letterSpacing: 0.8,
  },

  // 2x2 grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.lg,
  },
  tile: {
    width: '48%',
    aspectRatio: 1,
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
    // Subtle glow ring; intensifies on pending state via dynamic style
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 2,
  },
  tilePressed: {
    opacity: 0.85,
  },
  tileDisabled: {
    opacity: 0.4,
  },
  tileIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tacticalTokens.spacing.xs,
  },
  tileLabel: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  tierPill: {
    borderWidth: 1,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: 3,
    backgroundColor: tacticalTokens.colors.void,
  },
  tierPillText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.4,
  },

  // Explainer
  explainerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tacticalTokens.spacing.sm,
    paddingHorizontal: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.borderGhost,
  },
  explainerTogglePressed: {
    opacity: 0.6,
  },
  explainerToggleText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: palette.silver,
    letterSpacing: 1.4,
  },
  explainerBody: {
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.lg,
    gap: tacticalTokens.spacing.md,
  },
  explainerIntro: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    lineHeight: 20,
    letterSpacing: 0.6,
    marginBottom: tacticalTokens.spacing.sm,
  },
  explainerRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
    alignItems: 'flex-start',
  },
  explainerDot: {
    width: 10,
    height: 10,
    marginTop: 6,
  },
  explainerText: {
    flex: 1,
  },
  explainerTitle: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  explainerCopy: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    lineHeight: 18,
    letterSpacing: 0.6,
  },

  // Skip — small text link, low emphasis
  skipButton: {
    alignItems: 'center',
    paddingVertical: tacticalTokens.spacing.lg,
    marginTop: 'auto',
    minHeight: 44, // WCAG 2.5.5 target size
  },
  skipPressed: {
    opacity: 0.5,
  },
  skipText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },
});
