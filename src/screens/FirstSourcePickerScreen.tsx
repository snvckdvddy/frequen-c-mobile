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

type Tier = 1 | 2 | 3;

interface ProviderTile {
  source: HandshakeSource;
  serviceKey: string; // for ServiceIcon
  label: string;
  tier: Tier;
  badge: string;
}

const PROVIDER_TILES: ProviderTile[] = [
  {
    source: 'appleMusic',
    serviceKey: 'apple-music',
    label: 'APPLE MUSIC',
    tier: 1,
    badge: 'TIER 1',
  },
  {
    source: 'soundcloud',
    serviceKey: 'soundcloud',
    label: 'SOUNDCLOUD',
    tier: 1,
    badge: 'TIER 1',
  },
  {
    source: 'tidal',
    serviceKey: 'tidal',
    label: 'TIDAL',
    tier: 2,
    badge: 'TIER 2',
  },
  {
    source: 'spotify',
    serviceKey: 'spotify',
    label: 'SPOTIFY',
    tier: 3,
    badge: 'TIER 3 · BETA',
  },
];

const TIER_ACCENT: Record<Tier, string> = {
  1: palette.green, // matches Hardware Handshake Tier 1 color
  2: palette.ice,   // matches Hardware Handshake Tier 2 color
  3: palette.orange, // matches Hardware Handshake Tier 3 color
};

const TIER_GLOW: Record<Tier, string> = {
  1: withAlpha(palette.green, 0.18),
  2: palette.iceGlow,
  3: palette.orangeGlow,
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
                const accent = TIER_ACCENT[tile.tier];
                const glow = TIER_GLOW[tile.tier];
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

            {/* Tier explainer — expandable */}
            <Pressable
              onPress={() => setExplainerOpen((o) => !o)}
              accessibilityRole="button"
              accessibilityLabel="What do tiers mean"
              accessibilityState={{ expanded: explainerOpen }}
              style={({ pressed }) => [
                styles.explainerToggle,
                pressed && styles.explainerTogglePressed,
              ]}
            >
              <MonoText style={styles.explainerToggleText}>
                WHAT DO TIERS MEAN?
              </MonoText>
              <Ionicons
                name={explainerOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={palette.silver}
              />
            </Pressable>

            {explainerOpen && (
              <View style={styles.explainerBody}>
                <View style={styles.explainerRow}>
                  <View style={[styles.explainerDot, { backgroundColor: TIER_ACCENT[1] }]} />
                  <View style={styles.explainerText}>
                    <MonoText style={styles.explainerTitle}>TIER 1 — UNIVERSAL</MonoText>
                    <MonoText style={styles.explainerCopy}>
                      Always available. Tracks play for everyone in the room.
                    </MonoText>
                  </View>
                </View>
                <View style={styles.explainerRow}>
                  <View style={[styles.explainerDot, { backgroundColor: TIER_ACCENT[2] }]} />
                  <View style={styles.explainerText}>
                    <MonoText style={styles.explainerTitle}>TIER 2 — SUBSCRIPTION</MonoText>
                    <MonoText style={styles.explainerCopy}>
                      Plays for users who have the same subscription.
                    </MonoText>
                  </View>
                </View>
                <View style={styles.explainerRow}>
                  <View style={[styles.explainerDot, { backgroundColor: TIER_ACCENT[3] }]} />
                  <View style={styles.explainerText}>
                    <MonoText style={styles.explainerTitle}>TIER 3 — RESTRICTED BETA</MonoText>
                    <MonoText style={styles.explainerCopy}>
                      Search and discovery work for everyone. Full-track playback
                      is allowlist-only during beta.
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
