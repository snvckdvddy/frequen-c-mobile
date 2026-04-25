/**
 * Hardware Handshake — vacuum-tube warm-up animation
 *
 * Reusable visual flourish that fires on successful provider connect. Sells
 * the "modular synth hardware" metaphor that anchors System C — connecting
 * a streaming service should feel like patching a real piece of audio gear,
 * not flipping a settings switch.
 *
 * Canonical design: docs/ops/decisions/2026-04-25-hardware-handshake-design.md
 *
 * Color is keyed by TIER (per `SOURCE_TIER` in musicServiceAdapter.ts) rather
 * than per-source — reinforces the existing TierBadge metaphor and tells a
 * cleaner visual story (tier IS the meaningful axis; source identity lives
 * in the typography). Last.fm is metadata-only and treated as Tier 2.
 *
 * Reduced motion is respected (WCAG 2.3.3): when the user has requested
 * reduced motion via OS settings, the animation collapses to a 1.5s static
 * "ONLINE" state with a brief fade-out. The information conveyed is the
 * same; the motion is not.
 *
 * Implementation: Reanimated 3 + react-native-svg, both already installed.
 * No native module additions, so no APK rebuild needed — ships via OTA.
 */

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { palette, withAlpha } from '../../design/tokens/materials';
import { fontFamily } from '../../design/tokens/typography';
import type { HandshakeSource } from '../../services/handshake/handshakeBus';

// ─── Tier mapping ─────────────────────────────────────────────
// Mirrors `SOURCE_TIER` in musicServiceAdapter.ts but extends it with
// `lastfm` (which isn't a TrackSource so isn't in the canonical map).
// Keep these in sync if the canonical tier map ever changes.

type Tier = 1 | 2 | 3;

const SOURCE_TO_TIER: Record<HandshakeSource, Tier> = {
  appleMusic: 1,
  soundcloud: 1,
  tidal: 2,
  lastfm: 2,
  spotify: 3,
};

const TIER_PALETTE: Record<Tier, { primary: string; glow: string }> = {
  1: { primary: palette.green, glow: withAlpha(palette.green, 0.3) },
  2: { primary: palette.ice, glow: palette.iceGlow },
  3: { primary: palette.orange, glow: palette.orangeGlow },
};

const SOURCE_LABEL: Record<HandshakeSource, string> = {
  spotify: 'SPOTIFY',
  soundcloud: 'SOUNDCLOUD',
  tidal: 'TIDAL',
  appleMusic: 'APPLE MUSIC',
  lastfm: 'LAST.FM',
};

// ─── Geometry ─────────────────────────────────────────────────

const METER_WIDTH = 240;
const METER_HEIGHT = 6;
const FILAMENT_SIZE = 120;

// ─── Public API ───────────────────────────────────────────────

export type HardwareHandshakeRef = {
  play: (source: HandshakeSource) => void;
};

// ─── Component ────────────────────────────────────────────────

export const HardwareHandshake = forwardRef<HardwareHandshakeRef>((_props, ref) => {
  const [activeSource, setActiveSource] = useState<HandshakeSource | null>(null);

  // Live-tracked reduced motion preference (kept in a ref so the imperative
  // play() always sees the freshest value without triggering re-renders).
  const reduceMotionRef = useRef(false);

  const overlayOpacity = useSharedValue(0);
  const filamentOpacity = useSharedValue(0);
  const meterFill = useSharedValue(0);
  const labelOpacity = useSharedValue(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) reduceMotionRef.current = value;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      reduceMotionRef.current = value;
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: (source: HandshakeSource) => {
        // Reset all animated values to base state. Worklet-safe assignment.
        overlayOpacity.value = 0;
        filamentOpacity.value = 0;
        meterFill.value = 0;
        labelOpacity.value = 0;

        setActiveSource(source);

        const finish = () => setActiveSource(null);

        if (reduceMotionRef.current) {
          // Reduced-motion path: snap to "ONLINE" state, hold 1.5s, fade out.
          // Same information, no motion.
          overlayOpacity.value = 1;
          filamentOpacity.value = 1;
          meterFill.value = 0.85;
          labelOpacity.value = 1;
          overlayOpacity.value = withDelay(
            1500,
            withTiming(0, { duration: 300 }, (done) => {
              'worklet';
              if (done) runOnJS(finish)();
            })
          );
          return;
        }

        // Full sequence — 4000ms total.
        // Phase 1 (0-200ms): overlay fades in
        overlayOpacity.value = withTiming(1, { duration: 200 });

        // Phase 2 (0-800ms): filament warm-up with two flicker dips
        filamentOpacity.value = withSequence(
          withTiming(0.6, { duration: 200, easing: Easing.linear }),
          withTiming(0.2, { duration: 80 }),
          withTiming(0.85, { duration: 150 }),
          withTiming(0.4, { duration: 80 }),
          withTiming(1, { duration: 290, easing: Easing.out(Easing.cubic) })
        );

        // Phase 3 (800-2000ms): meter swing with overshoot settle
        meterFill.value = withDelay(
          800,
          withSequence(
            withTiming(0.92, { duration: 1000, easing: Easing.out(Easing.cubic) }),
            withTiming(0.85, { duration: 200, easing: Easing.inOut(Easing.cubic) })
          )
        );

        // Phase 4 (2000-2600ms): "ONLINE" label fade in
        labelOpacity.value = withDelay(
          2000,
          withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) })
        );

        // Phase 5 (2800-4000ms): hold + fade out + finish
        overlayOpacity.value = withDelay(
          2800,
          withSequence(
            withTiming(1, { duration: 800 }),
            withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }, (done) => {
              'worklet';
              if (done) runOnJS(finish)();
            })
          )
        );
      },
    }),
    [overlayOpacity, filamentOpacity, meterFill, labelOpacity]
  );

  // Animated styles — always declared (hooks rule).
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const filamentStyle = useAnimatedStyle(() => ({ opacity: filamentOpacity.value }));
  const meterStyle = useAnimatedStyle(() => ({
    width: METER_WIDTH * meterFill.value,
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

  // Render guard AFTER hooks so the rules-of-hooks invariant holds.
  if (activeSource === null) {
    return null;
  }

  const tier = SOURCE_TO_TIER[activeSource];
  const tierColors = TIER_PALETTE[tier];
  const label = SOURCE_LABEL[activeSource];
  const accessibilityLabel = `${label} connected`;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      // Do NOT make this dismissable — the animation is short and informative.
      onRequestClose={() => {}}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.overlay, overlayStyle]}
        accessibilityRole="alert"
        accessibilityLabel={accessibilityLabel}
        accessibilityLiveRegion="polite"
      >
        <View style={styles.center}>
          {/* Vacuum tube filament — concentric SVG circles with glow */}
          <Animated.View style={filamentStyle}>
            <Svg width={FILAMENT_SIZE} height={FILAMENT_SIZE} viewBox="0 0 120 120">
              <Circle cx={60} cy={60} r={42} fill={tierColors.glow} />
              <Circle cx={60} cy={60} r={26} fill={tierColors.primary} fillOpacity={0.45} />
              <Circle cx={60} cy={60} r={14} fill={tierColors.primary} />
              <Circle cx={60} cy={60} r={5} fill={palette.frost} />
            </Svg>
          </Animated.View>

          {/* Power meter — bar fills from 0 to ~85% with overshoot */}
          <View style={styles.meterTrack}>
            <Animated.View
              style={[
                styles.meterFill,
                { backgroundColor: tierColors.primary },
                meterStyle,
              ]}
            />
          </View>

          {/* Source label — fades in last */}
          <Animated.View style={labelStyle}>
            <Text style={[styles.labelText, { color: tierColors.primary }]}>
              {label} · ONLINE
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
});

HardwareHandshake.displayName = 'HardwareHandshake';

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: withAlpha(palette.void, 0.94),
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 36,
  },
  meterTrack: {
    width: METER_WIDTH,
    height: METER_HEIGHT,
    backgroundColor: withAlpha(palette.frost, 0.08),
    overflow: 'hidden',
  },
  meterFill: {
    height: METER_HEIGHT,
  },
  labelText: {
    fontFamily: fontFamily.monoBold,
    fontSize: 14,
    letterSpacing: 3,
  },
});
