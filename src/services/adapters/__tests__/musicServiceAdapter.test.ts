/**
 * Tier model + routing contract tests for musicServiceAdapter.
 *
 * The tier model is the load-bearing piece of the Spotify Feb 2026 response
 * (see plans/modular-tinkering-robin.md §1). These tests lock in the
 * priority order so future refactors can't silently regress it.
 *
 * ─── On adapter mocking ─────────────────────────────────────
 * Real adapters transitively import expo-device (via fetchClient → config),
 * which Jest's ts-jest preset can't transform. We mock each adapter module
 * at the test level so the import chain never reaches expo-* modules.
 * Each mock is a tiny singleton implementing just the surface that
 * musicServiceAdapter touches: `serviceName`, `setConnected`, `isConnected`.
 *
 * The mocks must be declared BEFORE importing musicServiceAdapter so Jest's
 * hoisting works correctly.
 */

// Lightweight adapter stub factory — matches the MusicServiceAdapter interface
// surface that musicServiceAdapter.ts actually calls (serviceName/setConnected/
// isConnected). The other interface methods are stubbed so TypeScript stays
// happy without bringing in real network code.
function makeAdapterStub(name: string) {
    let connected = false;
    return {
        serviceName: name,
        setConnected(status: boolean) { connected = status; },
        isConnected() { return connected; },
        // Methods that exist on the real adapters but aren't called by the
        // tier-routing layer — stubbed to no-op for type compatibility.
        search: jest.fn(async () => []),
        getStreamUrl: jest.fn(async () => null),
        getUserPlaylists: jest.fn(async () => ({ playlists: [], hasMore: false })),
        getPlaylistTracks: jest.fn(async () => ({ tracks: [], hasMore: false })),
        getLikedTracks: jest.fn(async () => ({ tracks: [], hasMore: false })),
    };
}

jest.mock('../spotifyAdapter', () => ({ spotifyAdapter: makeAdapterStub('spotify') }));
jest.mock('../soundcloudAdapter', () => ({ soundcloudAdapter: makeAdapterStub('soundcloud') }));
jest.mock('../tidalAdapter', () => ({ tidalAdapter: makeAdapterStub('tidal') }));
jest.mock('../appleMusicAdapter', () => ({ appleMusicAdapter: makeAdapterStub('appleMusic') }));
jest.mock('../stubAdapter', () => ({
    youtubeAdapter: makeAdapterStub('youtube'),
    itunesAdapter: makeAdapterStub('itunes'),
}));

import {
    SOURCE_TIER,
    getTierForSource,
    getActiveAdapter,
    getConnectedSources,
    getAllConnectedAdapters,
    isEffectivelyConnected,
    isServiceExpired,
} from '../musicServiceAdapter';
import type { ConnectedServices, TrackSource } from '../../../types';

// Helper: build a ConnectedServices payload with all unspecified services
// explicitly disconnected. Avoids the ambiguity of "missing key vs disconnected."
function services(connected: Partial<Record<keyof ConnectedServices, boolean>>): ConnectedServices {
    return {
        spotify: { connected: !!connected.spotify },
        appleMusic: { connected: !!connected.appleMusic },
        soundcloud: { connected: !!connected.soundcloud },
        tidal: { connected: !!connected.tidal },
        youtube: { connected: !!connected.youtube },
        lastfm: { connected: !!connected.lastfm },
    };
}

// Helper: build a ConnectedServices payload where a named provider is
// connected BUT has an already-expired token. Used to exercise the
// isEffectivelyConnected expiry filter added in the overclaim-audit fix.
// All other providers are explicitly disconnected so the test output is
// unambiguously attributable to the expired provider's filtering.
function servicesWithExpired(
    provider: 'spotify' | 'tidal' | 'soundcloud',
    expiresAtMs: number = Date.now() - 60_000, // 1 minute in the past
): ConnectedServices {
    const base = services({});
    base[provider] = { connected: true, expiresAt: expiresAtMs };
    return base;
}

describe('SOURCE_TIER mapping', () => {
    it('classifies appleMusic as Tier 1 (universal access via iTunes catalog)', () => {
        expect(SOURCE_TIER.appleMusic).toBe(1);
    });

    it('classifies soundcloud as Tier 1 (permissive guest access)', () => {
        expect(SOURCE_TIER.soundcloud).toBe(1);
    });

    it('classifies itunes + youtube as Tier 1 (universal preview fallbacks)', () => {
        expect(SOURCE_TIER.itunes).toBe(1);
        expect(SOURCE_TIER.youtube).toBe(1);
    });

    it('classifies tidal as Tier 2 (subscription required, no allowlist)', () => {
        expect(SOURCE_TIER.tidal).toBe(2);
    });

    it('classifies spotify as Tier 3 (Feb 2026 Dev Mode 5-user cap)', () => {
        expect(SOURCE_TIER.spotify).toBe(3);
    });

    it('covers every TrackSource (compile-time enforced via Record type)', () => {
        const expectedSources: TrackSource[] = [
            'spotify', 'soundcloud', 'tidal', 'appleMusic', 'youtube', 'itunes',
        ];
        expectedSources.forEach((source) => {
            expect(SOURCE_TIER[source]).toBeGreaterThanOrEqual(1);
            expect(SOURCE_TIER[source]).toBeLessThanOrEqual(3);
        });
    });
});

describe('getTierForSource', () => {
    it('returns 1 for Tier 1 sources', () => {
        expect(getTierForSource('appleMusic')).toBe(1);
        expect(getTierForSource('soundcloud')).toBe(1);
    });

    it('returns 2 for Tier 2 sources', () => {
        expect(getTierForSource('tidal')).toBe(2);
    });

    it('returns 3 for Tier 3 sources', () => {
        expect(getTierForSource('spotify')).toBe(3);
    });
});

describe('getActiveAdapter — tier-aware priority', () => {
    it('falls back to appleMusicAdapter when connectedServices is undefined', () => {
        const adapter = getActiveAdapter(undefined);
        expect(adapter.serviceName).toBe('appleMusic');
    });

    it('falls back to appleMusicAdapter when nothing is connected', () => {
        const adapter = getActiveAdapter(services({}));
        expect(adapter.serviceName).toBe('appleMusic');
    });

    it('returns appleMusicAdapter when only Apple Music is connected', () => {
        const adapter = getActiveAdapter(services({ appleMusic: true }));
        expect(adapter.serviceName).toBe('appleMusic');
    });

    it('returns soundcloudAdapter when only SoundCloud is connected', () => {
        const adapter = getActiveAdapter(services({ soundcloud: true }));
        expect(adapter.serviceName).toBe('soundcloud');
    });

    it('returns tidalAdapter when only Tidal is connected (Tier 2 fallback)', () => {
        const adapter = getActiveAdapter(services({ tidal: true }));
        expect(adapter.serviceName).toBe('tidal');
    });

    it('returns spotifyAdapter when only Spotify is connected (Tier 3 last-resort)', () => {
        const adapter = getActiveAdapter(services({ spotify: true }));
        expect(adapter.serviceName).toBe('spotify');
    });

    it('prefers Apple Music over SoundCloud within Tier 1 (catalog breadth)', () => {
        const adapter = getActiveAdapter(services({ appleMusic: true, soundcloud: true }));
        expect(adapter.serviceName).toBe('appleMusic');
    });

    it('prefers Tier 1 (SoundCloud) over Tier 2 (Tidal)', () => {
        const adapter = getActiveAdapter(services({ soundcloud: true, tidal: true }));
        expect(adapter.serviceName).toBe('soundcloud');
    });

    it('prefers Tier 2 (Tidal) over Tier 3 (Spotify)', () => {
        const adapter = getActiveAdapter(services({ tidal: true, spotify: true }));
        expect(adapter.serviceName).toBe('tidal');
    });

    it('prefers Tier 1 over Tier 2 over Tier 3 when all are connected', () => {
        const adapter = getActiveAdapter(services({
            appleMusic: true, soundcloud: true, tidal: true, spotify: true,
        }));
        expect(adapter.serviceName).toBe('appleMusic');
    });

    it('regression guard: Spotify is never preferred over a Tier 1 source', () => {
        const adapter = getActiveAdapter(services({ spotify: true, appleMusic: true }));
        expect(adapter.serviceName).not.toBe('spotify');
    });
});

describe('getConnectedSources — tier-ordered output', () => {
    it('returns empty array when connectedServices is undefined', () => {
        expect(getConnectedSources(undefined)).toEqual([]);
    });

    it('returns empty array when nothing is connected', () => {
        expect(getConnectedSources(services({}))).toEqual([]);
    });

    it('returns Tier 1 sources before Tier 2 before Tier 3', () => {
        const sources = getConnectedSources(services({
            spotify: true, tidal: true, soundcloud: true, appleMusic: true,
        }));
        expect(sources).toEqual(['appleMusic', 'soundcloud', 'tidal', 'spotify']);
    });

    it('puts Apple Music first within Tier 1', () => {
        const sources = getConnectedSources(services({ soundcloud: true, appleMusic: true }));
        expect(sources[0]).toBe('appleMusic');
        expect(sources[1]).toBe('soundcloud');
    });
});

describe('getAllConnectedAdapters — tier-ordered output', () => {
    it('returns adapters in tier order matching getConnectedSources', () => {
        const adapters = getAllConnectedAdapters(services({
            spotify: true, tidal: true, soundcloud: true, appleMusic: true,
        }));
        const names = adapters.map((a) => a.serviceName);
        expect(names).toEqual(['appleMusic', 'soundcloud', 'tidal', 'spotify']);
    });

    it('returns empty array when nothing is connected', () => {
        expect(getAllConnectedAdapters(services({}))).toEqual([]);
    });
});

// ─── Expiry-aware filtering ──────────────────────────────────
// These tests lock in the Option 1 fix from the overclaim audit:
// isEffectivelyConnected filters providers whose stored OAuth token
// has already expired, so downstream selectors never return a provider
// that will immediately 401 on first API call. See docs/ops/current-status.md
// for the broader "structural vs behavioral claim" vocabulary ladder context.

describe('getConnectedSources — expiry-aware filtering', () => {
    it('filters out Tidal when its token has already expired', () => {
        const sources = getConnectedSources(servicesWithExpired('tidal'));
        expect(sources).not.toContain('tidal');
        expect(sources).toEqual([]);
    });

    it('filters out Spotify when its token has already expired', () => {
        const sources = getConnectedSources(servicesWithExpired('spotify'));
        expect(sources).not.toContain('spotify');
        expect(sources).toEqual([]);
    });

    it('filters out SoundCloud when its token has already expired', () => {
        const sources = getConnectedSources(servicesWithExpired('soundcloud'));
        expect(sources).not.toContain('soundcloud');
        expect(sources).toEqual([]);
    });

    it('keeps non-expired providers while filtering expired ones', () => {
        // Tidal connected-and-fresh, Spotify connected-but-expired
        const cs: ConnectedServices = {
            ...services({ tidal: true }),
            spotify: { connected: true, expiresAt: Date.now() - 5_000 },
        };
        const sources = getConnectedSources(cs);
        expect(sources).toContain('tidal');
        expect(sources).not.toContain('spotify');
    });

    it('keeps providers whose expiresAt is in the future (not yet expired)', () => {
        const cs: ConnectedServices = {
            ...services({}),
            tidal: { connected: true, expiresAt: Date.now() + 60_000 },
        };
        expect(getConnectedSources(cs)).toContain('tidal');
    });

    it('keeps providers with no expiresAt field (lastfm/appleMusic semantic)', () => {
        // appleMusic has no expiry in practice — isEffectivelyConnected's
        // `typeof === 'number'` guard short-circuits and the .connected flag
        // is the only signal. Regression guard so a future refactor that
        // tightens the predicate doesn't accidentally drop these providers.
        const sources = getConnectedSources(services({ appleMusic: true, soundcloud: true }));
        expect(sources).toContain('appleMusic');
        expect(sources).toContain('soundcloud');
    });
});

describe('getAllConnectedAdapters — expiry-aware filtering', () => {
    it('filters out Tidal adapter when its token has already expired', () => {
        // syncConnectedState uses isEffectivelyConnected, so tidalAdapter
        // gets setConnected(false) during sync → not returned here.
        const adapters = getAllConnectedAdapters(servicesWithExpired('tidal'));
        const names = adapters.map((a) => a.serviceName);
        expect(names).not.toContain('tidal');
        expect(names).toEqual([]);
    });

    it('keeps non-expired adapters alongside excluded expired ones', () => {
        const cs: ConnectedServices = {
            ...services({ appleMusic: true }),
            spotify: { connected: true, expiresAt: Date.now() - 1_000 },
        };
        const adapters = getAllConnectedAdapters(cs);
        const names = adapters.map((a) => a.serviceName);
        expect(names).toContain('appleMusic');
        expect(names).not.toContain('spotify');
    });
});

describe('getActiveAdapter — expiry-aware fallback', () => {
    it('skips expired Tidal when picking the active adapter', () => {
        // Only Tidal is "connected" structurally, but its token is expired.
        // getActiveAdapter should fall through to the Apple Music fallback
        // instead of returning the stale Tidal adapter.
        const adapter = getActiveAdapter(servicesWithExpired('tidal'));
        expect(adapter.serviceName).toBe('appleMusic');
    });

    it('prefers fresh Apple Music over expired Spotify', () => {
        const cs: ConnectedServices = {
            ...services({ appleMusic: true }),
            spotify: { connected: true, expiresAt: Date.now() - 1_000 },
        };
        expect(getActiveAdapter(cs).serviceName).toBe('appleMusic');
    });
});

// ─── Direct predicate exports ────────────────────────────────
// isEffectivelyConnected and isServiceExpired are the two sibling predicates
// exported for reuse by UI surfaces that need opposite narrative senses.
// The helper layer (syncConnectedState, getConnectedSources) uses
// isEffectivelyConnected to FILTER expired providers. UI layers (ProfileScreen
// Patch Cables rows) use isServiceExpired to RENDER the expired state as
// distinct from fresh-connected. Both derive from the same underlying
// expiresAt comparison so the rule lives in exactly one place.

describe('isEffectivelyConnected predicate', () => {
    it('returns false for undefined service', () => {
        expect(isEffectivelyConnected(undefined)).toBe(false);
    });

    it('returns false when connected is false', () => {
        expect(isEffectivelyConnected({ connected: false })).toBe(false);
    });

    it('returns true for connected service with no expiresAt (lastfm/appleMusic)', () => {
        expect(isEffectivelyConnected({ connected: true })).toBe(true);
    });

    it('returns true for connected service with future expiresAt', () => {
        expect(isEffectivelyConnected({ connected: true, expiresAt: Date.now() + 60_000 })).toBe(true);
    });

    it('returns false for connected service whose expiresAt has already passed', () => {
        expect(isEffectivelyConnected({ connected: true, expiresAt: Date.now() - 60_000 })).toBe(false);
    });
});

describe('isServiceExpired predicate', () => {
    it('returns false for undefined service', () => {
        // Nothing to be expired about — no connection, no expiry concept.
        expect(isServiceExpired(undefined)).toBe(false);
    });

    it('returns false when the service is not connected at all', () => {
        // UNPATCHED providers are never "expired" — expiry implies a prior patch.
        expect(isServiceExpired({ connected: false })).toBe(false);
    });

    it('returns false for connected service with no expiresAt field', () => {
        // Providers like lastfm/appleMusic that have no expiry concept must NOT
        // be classified as expired — the typeof guard short-circuits the check.
        expect(isServiceExpired({ connected: true })).toBe(false);
    });

    it('returns false for connected service whose expiresAt is still in the future', () => {
        expect(isServiceExpired({ connected: true, expiresAt: Date.now() + 60_000 })).toBe(false);
    });

    it('returns true for connected service whose expiresAt has already passed', () => {
        // The ProfileScreen Patch Cables row renders this as "PATCHED · EXPIRED"
        // and swaps the button label to RECONNECT. The predicate is the single
        // source of truth for that branch.
        expect(isServiceExpired({ connected: true, expiresAt: Date.now() - 60_000 })).toBe(true);
    });

    it('is the logical opposite of isEffectivelyConnected for connected services', () => {
        // Sibling predicates share a single underlying comparison. For any
        // `connected: true` input, exactly one of the two should be true.
        // (Both are false for disconnected services — no "expired" claim
        // can be made about a provider that was never patched.)
        const fresh = { connected: true, expiresAt: Date.now() + 60_000 };
        const expired = { connected: true, expiresAt: Date.now() - 60_000 };
        const noExpiry = { connected: true };

        expect(isEffectivelyConnected(fresh)).toBe(true);
        expect(isServiceExpired(fresh)).toBe(false);

        expect(isEffectivelyConnected(expired)).toBe(false);
        expect(isServiceExpired(expired)).toBe(true);

        expect(isEffectivelyConnected(noExpiry)).toBe(true);
        expect(isServiceExpired(noExpiry)).toBe(false);
    });
});
