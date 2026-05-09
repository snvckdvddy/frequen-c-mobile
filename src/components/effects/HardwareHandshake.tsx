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
 * Color is keyed by ACCESS class (per SOURCE_META in musicServiceAdapter.ts)
 * so the handshake stays in lockstep with the picker's honest labels —
 * tap an "ice / SUBSCRIPTION" tile in the picker, see an ice handshake
 * fire when the OAuth resolves. Source identity lives in the typography
 * ("SPOTIFY · ONLINE"). Last.fm is metadata/scrobble (not a TrackSource)
 * but does have a connect flow, so it's mapped to 'subscription' for the
 * handshake color.
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
import { getAccessForSource, type AccessClass } from '../../services/adapters/musicServiceAdapter';

// ─── Access mapping ───────────────────────────────────────────
// Color is keyed by the canonical `access` class so the handshake
// stays in lockstep with the picker's honest labels. Tap an
// "ice / SUBSCRIPTION" tile in the picker → see an ice handshake fire
// when the OAuth resolves. No more visual discontinuity.
//
// Last.fm isn't a TrackSource (it's metadata/scrobbling, not a
// streaming source), so it can't go through getAccessForSource.
// It does have a connect flow, so we map it to 'subscription' for
// the handshake — same color story as the streaming services.

const SOURCE_TO_ACCESS: Record<HandshakeSource, AccessClass> = {
  spotify: getAccessForSource('spotify'),
  soundcloud: getAccessForSource('soundcloud'),
  tidal: getAccessForSource('tidal'),
  appleMusic: getAccessForSource('appleMusic'),
  // Last.fm: not a TrackSource. Treat as subscription-class for the
  // handshake color (it does require an account/login). If we add
  // a 'social' or 'metadata' access class for it later, swap here.
  lastfm: 'subscription',
};

// Only the access classes that actually appear in HandshakeSource
// need palette entries here. 'metadata-only' isn't included because
// HandshakeSource excludes iTunes/YouTube (those don't have a
// connect flow — they're preview-only and resolved automatically).
const ACCESS_PALETTE: Record<'subscription' | 'subscription-beta', { primary: string; glow: string }> = {
  subscription: { primary: palette.ice, glow: palette.iceGlow },
  'subscription-beta': { primary: palette.orange, glow: palette.orangeGlow },
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

  // Safety timeout that hides the overlay even if a Reanimated worklet
  // fails to deliver its completion callback. Belt-and-suspenders for
  // rare JS-thread pause/resume edge cases on Android.
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Defensive cleanup — clear pending safety timeout on unmount.
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
        safetyTimeoutRef.current = null;
      }
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play: (source: HandshakeSource) => {
        // Cancel the previous run's safety timeout if any. The Reanimated
        // values themselves are reset by reassignment below — Reanimated 3
        // cancels in-flight animations when a SharedValue is reassigned, so
        // the prior run's `withTiming` completion callback receives done=false
        // and never calls runOnJS(finish). This second `play()` call's finish
        // is the sole owner of the overlay-hide transition from this point on.
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }

        // Reset all animated values to base state.
        overlayOpacity.value = 0;
        filamentOpacity.value = 0;
        meterFill.value = 0;
        labelOpacity.value = 0;

        setActiveSource(source);

        const finish = () => {
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }
          setActiveSource(null);
        };

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
          // Safety net for the reduced-motion path. 1500ms hold + 300ms fade
          // = 1800ms; pad to 2300ms.
          safetyTimeoutRef.current = setTimeout(finish, 2300);
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

        // Phase 5 (2800-4000ms): hold 800ms, then fade out 400ms, then finish.
        // The hold is expressed as `withDelay(800, ...)` rather than a
        // 1.0→1.0 tween — same outcome, but self-documenting (no future
        // reader will wonder if the same-value tween was intentional).
        overlayOpacity.value = withDelay(
          2800 + 800,
          withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) }, (done) => {
            'worklet';
            if (done) runOnJS(finish)();
          })
        );

        // Safety net: if the worklet completion never delivers (rare,
        // Android JS-pause edge case), force-hide at total budget + 500ms.
        // finish() is idempotent so a double-fire is harmless.
        safetyTimeoutRef.current = setTimeout(finish, 4500);
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

  const access = SOURCE_TO_ACCESS[activeSource];
  // Cast is safe — SOURCE_TO_ACCESS only ever produces classes covered
  // by ACCESS_PALETTE (no HandshakeSource maps to 'metadata-only').
  const accessColors = ACCESS_PALETTE[access as 'subscription' | 'subscription-beta'];
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
              <Circle cx={60} cy={60} r={42} fill={accessColors.glow} />
              <Circle cx={60} cy={60} r={26} fill={accessColors.primary} fillOpacity={0.45} />
              <Circle cx={60} cy={60} r={14} fill={accessColors.primary} />
              {/* `palette.white` (#E8E6F0) used here as a bright neutral
                  highlight, not as a text color. `palette.frost` was avoided
                  to keep text-hierarchy tokens semantically clean. */}
              <Circle cx={60} cy={60} r={5} fill={palette.white} />
            </Svg>
          </Animated.View>

          {/* Power meter — bar fills from 0 to ~85% with overshoot */}
          <View style={styles.meterTrack}>
            <Animated.View
              style={[
                styles.meterFill,
                { backgroundColor: accessColors.primary },
                meterStyle,
              ]}
            />
          </View>

          {/* Source label — fades in last */}
          <Animated.View style={labelStyle}>
            <Text style={[styles.labelText, { color: accessColors.primary }]}>
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
