/**
 * Tests for fireHapticHandshake (Section 5b — Haptic Patch Bay)
 *
 * All tests mock expo-haptics, react-native's Platform, and musicServiceAdapter
 * so we validate the pattern logic (impact style sequence, delays) without
 * requiring a real device, native module, or expo-device's ESM import chain.
 *
 * Pattern: musicServiceAdapter transitively imports expo-device (via
 * fetchClient → config), which Jest's ts-jest preset can't transform.
 * We mock it with just the SOURCE_TIER constant we need. See
 * `musicServiceAdapter.test.ts` for the same technique.
 */

import * as Haptics from 'expo-haptics';
import { fireHapticHandshake } from '../hapticHandshake';

// ─── Mocks ────────────────────────────────────────────────────

// Break the expo-device ESM chain. Only SOURCE_TIER is used by hapticHandshake.
// IMPORTANT: keep these values in sync with musicServiceAdapter.ts SOURCE_TIER.
// `itunes` and `youtube` are included to match the full Record<TrackSource, SourceTier>
// shape — omitting them would leave undefined lookups that silently swallow haptics.
jest.mock('../../adapters/musicServiceAdapter', () => ({
  SOURCE_TIER: {
    spotify: 3,
    soundcloud: 1,
    tidal: 2,
    appleMusic: 1,
    itunes: 1,   // preview-only source; Tier 1 — matches musicServiceAdapter.ts
    youtube: 1,  // preview-only source; Tier 1 — matches musicServiceAdapter.ts
  },
}));

// Mock Platform.OS so tests can control the iOS/Android branch without
// importing the real react-native (which uses ESM and can't be transformed
// in this Jest config).
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
    jest.runAllTimers();
    await promise;
    expect(impactAsync).toHaveBeenCalled();
  });

  it('is a no-op on Android', async () => {
    mockPlatformOS = 'android';
    const promise = fireHapticHandshake('spotify');
    jest.runAllTimers();
    await promise;
    expect(impactAsync).not.toHaveBeenCalled();
  });
});

// ─── Tier patterns ────────────────────────────────────────────

describe('Tier 1 — smooth electric', () => {
  it('soundcloud (Tier 1) fires exactly one Heavy impact', async () => {
    const promise = fireHapticHandshake('soundcloud');
    jest.runAllTimers();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(1);
    expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });

  it('appleMusic (Tier 1) fires exactly one Heavy impact', async () => {
    const promise = fireHapticHandshake('appleMusic');
    jest.runAllTimers();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(1);
    expect(impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  });
});

describe('Tier 2 — heavy mechanical', () => {
  it('tidal (Tier 2) fires Heavy then Medium — two impacts total', async () => {
    const promise = fireHapticHandshake('tidal');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(2);
    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Heavy);
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
  });

  it('lastfm (metadata Tier 2) fires Heavy then Medium', async () => {
    const promise = fireHapticHandshake('lastfm');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(2);
    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Heavy);
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
  });
});

describe('Tier 3 — industrial latch', () => {
  it('spotify (Tier 3) fires Medium, Medium, Heavy — ascending weight', async () => {
    const promise = fireHapticHandshake('spotify');
    await jest.runAllTimersAsync();
    await promise;

    expect(impactAsync).toHaveBeenCalledTimes(3);
    expect(impactAsync).toHaveBeenNthCalledWith(1, Haptics.ImpactFeedbackStyle.Medium);
    expect(impactAsync).toHaveBeenNthCalledWith(2, Haptics.ImpactFeedbackStyle.Medium);
    expect(impactAsync).toHaveBeenNthCalledWith(3, Haptics.ImpactFeedbackStyle.Heavy);
  });
});

// ─── Error resilience ─────────────────────────────────────────

describe('error resilience', () => {
  it('swallows expo-haptics errors and resolves cleanly', async () => {
    impactAsync.mockRejectedValueOnce(new Error('haptics unavailable'));

    const promise = fireHapticHandshake('soundcloud');
    jest.runAllTimers();

    await expect(promise).resolves.toBeUndefined();
  });
});
