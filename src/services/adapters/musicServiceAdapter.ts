import { MusicServiceAdapter } from './types';
import { spotifyAdapter } from './spotifyAdapter';
import { soundcloudAdapter } from './soundcloudAdapter';
import { tidalAdapter } from './tidalAdapter';
import { appleMusicAdapter } from './appleMusicAdapter';
import { youtubeAdapter, itunesAdapter } from './stubAdapter';
import { ConnectedServices, TrackSource } from '../../types';

// ─── Source Tiering ──────────────────────────────────────────
// See plans/modular-tinkering-robin.md §1 for the strategic context.
//
// Tier 1 — Universal access. No auth (or trivial auth) required to use the
//          source's core surface (search/browse). Used as the default routing
//          target whenever possible.
//   • appleMusic: catalog search always works via the public iTunes API;
//                 library + full playback unlock once MusicKit auth completes.
//   • soundcloud: permissive guest access for catalog; OAuth unlocks library.
//   • itunes / youtube: preview-only fallbacks; always callable.
//
// Tier 2 — Subscription required, but every paying user can connect (no
//          allowlist). Provider-side scaling is unrestricted.
//   • tidal: PKCE OAuth + search + stream wired; library browsing TODO.
//
// Tier 3 — Restricted beta. Spotify's Feb 2026 Dev Mode tightening caps the
//          app at 5 allowlisted users until 250k MAU is reached. Treated as
//          a designed "Restricted Beta" surface in the UI rather than a
//          first-class source. See plan §4 for the framing.
//   • spotify: 5-user allowlist; do not route here unless nothing else works.

export type SourceTier = 1 | 2 | 3;

export const SOURCE_TIER: Record<TrackSource, SourceTier> = {
    appleMusic: 1,
    soundcloud: 1,
    itunes: 1,
    youtube: 1,
    tidal: 2,
    spotify: 3,
};

/**
 * Returns the access tier of a given source. Used by UI components to render
 * tier badges ("Restricted Beta", "Subscription Required", etc.) and by the
 * routing layer to walk sources from most-universal → most-restricted.
 */
export function getTierForSource(source: TrackSource): SourceTier {
    return SOURCE_TIER[source];
}

// ─── Sync helper ─────────────────────────────────────────────
// Centralizes connected-state sync so every public function uses
// the same logic and no adapter is accidentally skipped.

function syncConnectedState(connectedServices: ConnectedServices | undefined): void {
    const cs = connectedServices;
    spotifyAdapter.setConnected(!!cs?.spotify?.connected);
    soundcloudAdapter.setConnected(!!cs?.soundcloud?.connected);
    tidalAdapter.setConnected(!!cs?.tidal?.connected);
    // Apple Music catalog search always works; library access needs MusicKit auth.
    // setConnected reflects whether the user has authenticated (for library features).
    appleMusicAdapter.setConnected(!!cs?.appleMusic?.connected);
    // youtube & itunes have no auth flow — always disconnected
    youtubeAdapter.setConnected(false);
    itunesAdapter.setConnected(false);
}

// ─── Complete adapter map (covers every TrackSource) ─────────

const adapterMap: Record<TrackSource, MusicServiceAdapter> = {
    spotify: spotifyAdapter,
    soundcloud: soundcloudAdapter,
    tidal: tidalAdapter,
    appleMusic: appleMusicAdapter,
    youtube: youtubeAdapter,
    itunes: itunesAdapter,
};

/**
 * Derive the list of connected TrackSource keys from the auth context.
 * Single source of truth — use this instead of manually checking each service.
 *
 * Ordered by tier (1 → 3) so consumers that just iterate the list naturally
 * surface the most-universal source first.
 */
export function getConnectedSources(connectedServices: ConnectedServices | undefined): TrackSource[] {
    if (!connectedServices) return [];
    const sources: TrackSource[] = [];
    // Tier 1
    if (connectedServices.appleMusic?.connected) sources.push('appleMusic');
    if (connectedServices.soundcloud?.connected) sources.push('soundcloud');
    // Tier 2
    if (connectedServices.tidal?.connected) sources.push('tidal');
    // Tier 3 (restricted beta — Spotify)
    if (connectedServices.spotify?.connected) sources.push('spotify');
    return sources;
}

/**
 * Returns the highest-priority adapter for default actions (queueing tracks
 * with no explicit source, fallback playback, etc.).
 *
 * Priority is tier-aware: walk Tier 1 → Tier 2 → Tier 3 and prefer the first
 * adapter in each tier whose `isConnected()` is true. Spotify is intentionally
 * the very last choice — see plan §4 for the Feb 2026 Dev Mode context.
 *
 * Within Tier 1, Apple Music wins over SoundCloud because Apple Music's
 * catalog is broader and full-track playback unlocks once MusicKit auth lands.
 * SoundCloud is the strong second for DJ mixes / long-form / indie.
 */
export function getActiveAdapter(connectedServices: ConnectedServices | undefined): MusicServiceAdapter {
    syncConnectedState(connectedServices);

    if (!connectedServices) {
        // Apple Music catalog search works without any auth, so it's the
        // safest fallback when we genuinely have no connected-services payload.
        return appleMusicAdapter;
    }

    // Tier 1 — universal access
    if (appleMusicAdapter.isConnected()) return appleMusicAdapter;
    if (soundcloudAdapter.isConnected()) return soundcloudAdapter;

    // Tier 2 — subscription required, unlimited users
    if (tidalAdapter.isConnected()) return tidalAdapter;

    // Tier 3 — restricted beta (Spotify Feb 2026 Dev Mode 5-user cap)
    if (spotifyAdapter.isConnected()) return spotifyAdapter;

    // Final fallback: Apple Music catalog still works without auth, so
    // returning it lets search keep functioning even when no services are
    // connected. Library/playback methods on the adapter remain gated by
    // isConnected() and degrade gracefully.
    return appleMusicAdapter;
}

/**
 * Returns the adapter that owns a specific track source.
 * Use for playback — routes to the correct service instead of the
 * highest-priority connected one.
 *
 * Falls back to getActiveAdapter if the source adapter isn't connected
 * (e.g. another user queued a Tidal track but you only have Spotify).
 */
// Preview-only sources use direct URLs — no adapter resolution needed.
const PREVIEW_ONLY_SOURCES: TrackSource[] = ['itunes', 'youtube'];

export function getAdapterForSource(
    source: TrackSource | undefined,
    connectedServices: ConnectedServices | undefined,
): MusicServiceAdapter {
    syncConnectedState(connectedServices);

    // iTunes/YouTube tracks carry their own preview URL — return the stub
    // directly so we don't fire a useless request against a real service API.
    if (source && PREVIEW_ONLY_SOURCES.includes(source)) {
        return adapterMap[source];
    }

    const target = source ? adapterMap[source] : undefined;
    if (target?.isConnected()) return target;

    // Source adapter unavailable — fall back to priority routing
    return getActiveAdapter(connectedServices);
}

/**
 * Returns ALL connected adapters — used for library browsing where
 * the user should see playlists from every service they've linked,
 * not just the highest-priority one.
 *
 * Ordered by tier (1 → 3) so library UIs render universal-access sources
 * first and the restricted Tier 3 (Spotify) last.
 */
export function getAllConnectedAdapters(connectedServices: ConnectedServices | undefined): MusicServiceAdapter[] {
    syncConnectedState(connectedServices);

    const adapters: MusicServiceAdapter[] = [];
    // Tier 1
    if (appleMusicAdapter.isConnected()) adapters.push(appleMusicAdapter);
    if (soundcloudAdapter.isConnected()) adapters.push(soundcloudAdapter);
    // Tier 2
    if (tidalAdapter.isConnected()) adapters.push(tidalAdapter);
    // Tier 3 (restricted beta — Spotify)
    if (spotifyAdapter.isConnected()) adapters.push(spotifyAdapter);

    return adapters;
}
