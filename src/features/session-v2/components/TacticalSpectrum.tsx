/**
 * TacticalSpectrum — real-time-style spectrum analyzer for the play screen.
 *
 * Replaces the previous static "TacticalWaveform" (a deterministic
 * hash-of-track-id bar graph that didn't move). Caleb 2026-05-11:
 *   "[the waveform] feels out of place and, to me, elementary... it
 *    would be nice to get it more unique/custom to the track."
 *
 * Design direction (option W4 in the brainstorm): live spectrum analyzer
 * aesthetic — bars animated in real time while playing, frozen on pause.
 * Matches the "tactical hardware rack" identity (LEDReadout, ChromeButton,
 * VoidSurface, TacticalGridBackground) better than a static SoundCloud-
 * style waveform would.
 *
 * Three audio-data paths, fall-through priority:
 *
 *   1. `amplitudeBins` (optional prop): if provided, render those values
 *      directly. Future hookup point for Web Audio AnalyserNode running
 *      inside the Spotify / Apple Music WebView SDK backend (postMessage
 *      amplitude samples to RN). Real audio reactivity for the two DRM
 *      streaming sources.
 *
 *   2. Procedural motion (default): each bar oscillates via a sum of
 *      sine waves whose frequencies are seeded by the track id. Two
 *      tracks have visibly different "spectrum signatures" even though
 *      neither uses real audio. Bars freeze when isPlaying is false.
 *
 *   3. Idle (no track): low-amplitude breathing pattern. Distinct from
 *      both "playing" and "paused" states.
 *
 * Performance: all per-frame height computation runs in a Reanimated
 * worklet on the UI thread (useFrameCallback). The JS thread sees only
 * progress/isPlaying/trackId prop changes and re-renders ~2-3 times per
 * track, not 60 times per second. Performant on mid-range Android.
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useFrameCallback,
  withTiming,
  interpolateColor,
  type SharedValue,
} from 'react-native-reanimated';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalSpectrumProps {
  trackId?: string | null;
  elapsed: number;
  duration: number;
  progress: number;
  isPlaying: boolean;
  /**
   * Optional real-audio amplitude data, normalized 0..1, one per bar.
   * When provided, replaces procedural motion. Future plumbing point
   * for Web Audio AnalyserNode in the SDK backends (Spotify / Apple).
   * Length should match BAR_COUNT (38); shorter arrays are extended
   * with zeros, longer arrays are truncated.
   */
  amplitudeBins?: number[];
}

// Bumped 38 -> 80 (2026-05-11) per UX feedback. Thin dense bars read as
// audio data; chunky bars at low density read as discrete blocks. This
// also makes the per-bar phase offsets more visible — at 80 bars the
// procedural sine sum produces a continuous-looking wavy fingerprint
// instead of a "few bars dancing" effect.
const BAR_COUNT = 80;

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${h.toString().padStart(2, '0')}:${m
    .toString()
    .padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Deterministic 31-bit hash of a string. */
function hashSeed(value: string): number {
  return value.split('').reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 2147483647,
    7,
  );
}

/**
 * Per-bar oscillation parameters. Two frequencies summed gives organic
 * variation that doesn't look mechanically uniform. Seeded by track id
 * so each track has its own visual "spectrum signature."
 */
interface BarParams {
  freq1: number; // primary oscillation, rad/sec-equivalent
  freq2: number; // secondary modulation
  phase: number; // per-bar phase offset
  weight1: number; // amplitude weight of primary
  weight2: number; // amplitude weight of secondary
}

function buildBarParams(seed: number): BarParams[] {
  const out: BarParams[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    // Spread frequencies across a musically-suggestive range. The
    // numbers below are tuned empirically to feel "alive" without
    // looking jittery — slow enough to track, fast enough to feel
    // responsive to imaginary audio.
    const s = (seed + i * 41) % 1000;
    const freq1 = 1.8 + (s % 90) / 90 * 1.4; // 1.8–3.2 Hz-ish
    const freq2 = 4.5 + ((s * 7) % 80) / 80 * 2.0; // 4.5–6.5 Hz-ish
    const phase = (s % 360) / 360 * Math.PI * 2;
    const weight1 = 0.32 + (s % 30) / 30 * 0.18; // 0.32–0.50
    const weight2 = 0.08 + (s % 40) / 40 * 0.12; // 0.08–0.20
    out.push({ freq1, freq2, phase, weight1, weight2 });
  }
  return out;
}

// Hex strings outside worklet (Reanimated needs string color values
// available at worklet creation time, not React Native style enums).
const HEX = {
  white: tacticalTokens.colors.white,
  orange: tacticalTokens.colors.orange,
  inactive: '#2D2D2D',
  idle: '#1F1F1F',
};

interface SpectrumBarProps {
  index: number;
  params: BarParams;
  timeMs: SharedValue<number>;
  progress: SharedValue<number>;
  playState: SharedValue<number>; // 0 = idle/no-track, 1 = paused, 2 = playing
  /**
   * Shared array of all bars' amplitude overrides (length BAR_COUNT).
   * Each value: -1 = no override (use procedural motion), 0..1 = use as-is.
   * Single shared array (rather than per-bar SharedValues) avoids
   * Rules-of-Hooks violations and lets all bars stay in sync on each
   * amplitude refresh.
   */
  amplitudeOverrides: SharedValue<number[]>;
}

/**
 * Single bar. All per-frame math runs as a worklet (UI thread); the JS
 * thread never sees any of this per-frame logic.
 */
function SpectrumBar({
  index,
  params,
  timeMs,
  progress,
  playState,
  amplitudeOverrides,
}: SpectrumBarProps) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    // Idle state (no track patched): low slow breathing.
    if (playState.value < 0.5) {
      const idleWave =
        0.10 + 0.05 * Math.sin(timeMs.value * 0.0015 + index * 0.4);
      return {
        height: `${idleWave * 100}%`,
        backgroundColor: HEX.idle,
      };
    }

    // External amplitude data (e.g. real Web Audio output from SDK
    // backend). Use it directly when provided for this bar index.
    let amp: number;
    const override = amplitudeOverrides.value[index];
    if (typeof override === 'number' && override >= 0) {
      amp = override;
    } else if (playState.value < 1.5) {
      // Paused: hold a static low value so the visualization "stops"
      // moving but doesn't collapse entirely.
      amp = 0.18 + (params.weight1 * 0.6);
    } else {
      // Playing — procedural sum of two sines.
      const t = timeMs.value * 0.001;
      const base = 0.18; // floor so bars are always slightly visible
      const wave =
        base +
        params.weight1 * Math.abs(Math.sin(t * params.freq1 + params.phase + index * 0.27)) +
        params.weight2 * Math.abs(Math.sin(t * params.freq2 + params.phase * 1.7 + index * 0.13));
      amp = Math.max(0.08, Math.min(0.95, wave));
    }

    // Active vs inactive coloring. Bars to the left of the playhead
    // are "active"; bars to the right are dim.
    const isActive = index <= Math.round(progress.value * (BAR_COUNT - 1));

    // Blend smoothly toward orange as a bar runs hot. The previous
    // [0.72, 0.73] band was effectively a binary switch evaluated per
    // frame — bars oscillating across the threshold strobed
    // white/orange (Caleb, 2026-07-25). A wide band makes color read
    // as continuous heat, so per-frame amplitude motion produces
    // gradual warmth instead of flashes.
    const color = isActive
      ? interpolateColor(amp, [0.45, 0.95], [HEX.white, HEX.orange])
      : HEX.inactive;

    return {
      height: `${amp * 100}%`,
      backgroundColor: color,
      opacity: isActive ? 0.95 : 0.55,
    };
  });

  return <Animated.View style={[styles.bar, animatedStyle]} />;
}

export function TacticalSpectrum({
  trackId,
  elapsed,
  duration,
  progress,
  isPlaying,
  amplitudeBins,
}: TacticalSpectrumProps) {
  const idle = !trackId;

  // Compute per-bar oscillation parameters once per track id change.
  // Different tracks => visibly different motion signatures.
  const params = useMemo(
    () => buildBarParams(hashSeed(trackId || 'idle-signal')),
    [trackId],
  );

  // Time accumulator updated on the UI thread by useFrameCallback.
  // Reading happens inside each bar's worklet.
  const timeMs = useSharedValue(0);
  // Progress mirrored as a shared value so each bar's worklet can read
  // it without taking a JS-thread round-trip.
  const progressSv = useSharedValue(progress);
  // State machine for the bars: 0 = idle, 1 = paused, 2 = playing.
  // Eased so transitions between play/pause aren't jarring.
  const playStateSv = useSharedValue(idle ? 0 : isPlaying ? 2 : 1);
  // Per-bar amplitude overrides packed into a single shared array.
  // Each entry: -1 = no override (use procedural motion), 0..1 = real
  // audio data from the SDK backend. Single SharedValue<number[]> keeps
  // us on the right side of Rules-of-Hooks (no per-bar useSharedValue
  // inside a loop) and lets every bar refresh in lockstep when a new
  // amplitude snapshot arrives.
  const amplitudeOverrides = useSharedValue<number[]>(
    new Array(BAR_COUNT).fill(-1),
  );

  // Sync the JS-side state into the shared values whenever props change.
  useEffect(() => {
    progressSv.value = withTiming(progress, { duration: 250 });
  }, [progress, progressSv]);

  useEffect(() => {
    const next = idle ? 0 : isPlaying ? 2 : 1;
    playStateSv.value = withTiming(next, { duration: 220 });
  }, [idle, isPlaying, playStateSv]);

  useEffect(() => {
    if (!amplitudeBins || amplitudeBins.length === 0) {
      // No real audio data — broadcast "use procedural" to every bar.
      amplitudeOverrides.value = new Array(BAR_COUNT).fill(-1);
      return;
    }
    const next = new Array(BAR_COUNT).fill(-1);
    for (let i = 0; i < BAR_COUNT; i++) {
      const v = amplitudeBins[i];
      next[i] = typeof v === 'number' && v >= 0 ? Math.min(1, v) : -1;
    }
    amplitudeOverrides.value = next;
  }, [amplitudeBins, amplitudeOverrides]);

  // Drive the time accumulator on the UI thread. Pauses when state ≠ playing.
  useFrameCallback((info) => {
    'worklet';
    if (playStateSv.value < 1.5) return;
    timeMs.value += info.timeSincePreviousFrame ?? 16;
  }, true);

  const remaining = Math.max(0, (duration || 0) - (elapsed || 0));

  return (
    <View style={[styles.container, idle && styles.idleContainer]}>
      <View style={styles.waveRow}>
        {params.map((p, i) => (
          <SpectrumBar
            key={`spec-bar-${i}`}
            index={i}
            params={p}
            timeMs={timeMs}
            progress={progressSv}
            playState={playStateSv}
            amplitudeOverrides={amplitudeOverrides}
          />
        ))}
      </View>

      <View style={styles.timeRow}>
        <Text style={[styles.timeText, idle && styles.timeTextIdle]}>
          {formatTime(elapsed)}
        </Text>
        <Text style={[styles.timeText, idle && styles.timeTextIdle]}>
          -{formatTime(remaining)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tacticalTokens.spacing.xs + 2,
    marginHorizontal: tacticalTokens.spacing.xl,
    paddingTop: 2,
  },
  idleContainer: {
    marginTop: 1,
  },
  waveRow: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    flex: 1,
    // Reduced 4 -> 1 (2026-05-11) so 80 bars actually pack densely.
    // The flex:1 + minWidth:1 combination lets each bar render at the
    // available pixel width (~2-3px on a typical phone screen) which
    // matches SoundCloud's waveform aesthetic — bars feel like data,
    // not blocks.
    minWidth: 1,
  },
  timeRow: {
    marginTop: 1,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.acid,
  },
  timeTextIdle: {
    color: '#6E6E6E',
  },
});

export default TacticalSpectrum;
