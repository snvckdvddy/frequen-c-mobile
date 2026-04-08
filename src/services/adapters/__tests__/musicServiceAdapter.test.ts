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
