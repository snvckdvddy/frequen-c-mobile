/**
 * Tests for fireHapticHandshake (Section 5b — Haptic Patch Bay)
 *
 * Updated 2026-05-09 alongside the SOURCE_TIER → SOURCE_META refactor:
 * the haptic patterns are now keyed per-HandshakeSource directly (named
 * by feel, not tier number) and the implementation no longer imports
 * from musicServiceAdapter. The pattern-to-source mapping reflects the
 * new access-class story:
 *
 *   • Subscription streaming (Apple Music / SoundCloud / Tidal):
 *     "heavy-mechanical" — Heavy → 120ms → Medium (2 impacts)
 *   • Subscription + beta allowlist (Spotify):
 *     "industrial-latch" — Medium → 80ms → Medium → 120ms → Heavy (3 impacts)
 *   • Scrobble/metadata (Last.fm):
 *     "smooth-electric" — single Heavy (1 impact)
 *
 * All tests mock expo-haptics and react-native's Platform so we validate
 * the pattern logic (impact style sequence, delays) without requiring a
 * real device or native module.
 */

import * as Haptics from 'expo-haptics';
import { fireHapticHandshake } from '../hapticHandshake';

// ─── Mocks ────────────────────────────────────────────────────

// Mock Platform.OS so tests can control the iOS/Android branch without
// importing the real react-native (ESM, can't be transformed in this
// Jest config).
let mockPlatformOS: string = 'ios';

jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockPlatformOS;
    },
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
    Rigid: 'Rigid',
    Soft: 'Soft',
  },
}));

const impactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;

// Fake timers so delay() resolves immediately in tests
jest.useFakeTimers();

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatformOS = 'ios'; // default to iOS for most tests
});

// ─── Platform guard ───────────────────────────────────────────

describe('iOS-only guard', () => {
  it('fires haptics on iOS', async () => {
    mockPlatformOS = 'ios';
    const promise = fireHapticHandshake('soundcloud');
    await jest.runAllTimersAsync();
    await promise;
    expect(impactAsync).toHaveBeenCalled();
  });

  it('is a no-op on Android', async () => {
    mockPlatformOS = 'android';
    const promise = fireHapticHandshake('spotify');
    await jest.runAllTimersAsync();
    await promise;
    expect(impactAsync).not.toHaveBeenCalled();
  });
});

// ─── Subscription streaming — "heavy-mechanical" ──────────────

describe('subscription streaming sources fire heavy-mechanical', () => {
  it('appleMusic fires Heavy then Medium — two impacts', async () => {
    const promise = fireHapticHandshake('appleMusic');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(2);
    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Heavy);
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
  });

  it('soundcloud fires Heavy then Medium — two impacts', async () => {
    const promise = fireHapticHandshake('soundcloud');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(2);
    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Heavy);
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
  });

  it('tidal fires Heavy then Medium — two impacts', async () => {
    const promise = fireHapticHandshake('tidal');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(2);
    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Heavy);
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
  });
});

// ─── Subscription + beta — "industrial-latch" ─────────────────

describe('spotify (subscription-beta) fires industrial-latch', () => {
  it('fires Medium, Medium, Heavy — ascending weight, three impacts', async () => {
    const promise = fireHapticHandshake('spotify');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(3);
    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Medium);
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
    expect(impactAsync).toHaveBeenNthCalledWith(3, Haptics.ImpactFeedbackStyle.Heavy);
  });
});

// ─── Last.fm — "smooth-electric" ──────────────────────────────

describe('lastfm (scrobble/metadata) fires smooth-electric', () => {
  it('fires exactly one Heavy impact', async () => {
    const promise = fireHapticHandshake('lastfm');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(1);
    expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });
});

// ─── Error resilience ─────────────────────────────────────────

describe('error resilience', () => {
  it('swallows expo-haptics errors and resolves cleanly', async () => {
    impactAsync.mockRejectedValueOnce(new Error('haptics unavailable'));

    const promise = fireHapticHandshake('lastfm');
    await jest.runAllTimersAsync();

    await expect(promise).resolves.toBeUndefined();
  });
});
