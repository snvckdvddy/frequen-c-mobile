import { MusicServiceAdapter } from './types';
import { spotifyAdapter } from './spotifyAdapter';
import { soundcloudAdapter } from './soundcloudAdapter';
import { tidalAdapter } from './tidalAdapter';
import { appleMusicAdapter } from './appleMusicAdapter';
import { youtubeAdapter, itunesAdapter } from './stubAdapter';
import { ConnectedServices, ServiceConnection, TrackSource } from '../../types';

// ─── Source metadata ─────────────────────────────────────────
// Two orthogonal axes per source — replaces the previous SOURCE_TIER 1/2/3
// mapping that was conflating "what does the user need" with "what order
// should we try sources." Decoupled 2026-05-09 because the conflation was
// producing UX inconsistencies (picker showed honest "SUBSCRIPTION" labels
// while Hardware Handshake / BetaBadge still rendered "Tier 1/2/3" with
// colors that didn't match the picker).
//
// Two axes:
//
//   • `access` — user-facing requirement. Drives picker tile labels,
//     Hardware Handshake colors, BetaBadge / "BETA" chip, error messages,
//     and any other UI that has to tell the user what they need to bring.
//
//   • `crossMatchPriority` — backend/resolver-only. Higher = preferred
//     when resolving a Spotify-discovered track to a playable equivalent
//     (Phase 5 ISRC cross-match). Eventually layered with user preference
//     ("default service" setting) at consumer sites — see
//     plans/modular-tinkering-robin.md.
//
// The previous 1/2/3 tier numbers conflated these — Tier 1 implied both
// "no requirements" AND "try first," but no streaming source actually
// has zero requirements (all need a subscription for full playback). The
// "Tier 1" label was a fiction. Replacing it with two honest axes:
//   • appleMusic / tidal / soundcloud — access: 'subscription'
//   • spotify                          — access: 'subscription-beta'
//   • itunes / youtube                 — access: 'metadata-only'
//
// Future Phase B addition: local files would join as
//   { access: 'local', crossMatchPriority: 110 }  // preferred over streaming
// because a local file is the most reliable playback path when available.
//
// See plans/modular-tinkering-robin.md §1 for strategic context and
// plans/graceful-plotting-storm.md Phase 5 for cross-match resolver.

export type AccessClass =
  | 'subscription'        // Paid streaming service. Full playback requires
                          // an active subscription. Connecting without one
                          // gives 30-second previews — Frequen-C is a
                          // streaming-first app, so honest labeling at the
                          // picker prevents that wasted-OAuth case.
  | 'subscription-beta'   // Subscription PLUS device on Frequen-C beta
                          // allowlist. Today: Spotify (Dev Mode 5-user cap).
                          // Will collapse to 'subscription' if/when Spotify
                          // approves Frequen-C for Extended Quota Mode.
  | 'metadata-only';      // Catalog/search/discovery only. No playback.
                          // Used for iTunes Search API (cross-match metadata
                          // source) and YouTube (preview-only fallback).

export interface SourceMeta {
    /** User-facing access requirement — drives all visible labels + colors */
    access: AccessClass;
    /**
     * Resolver priority — higher number tried first during ISRC cross-match.
     * Values use a 10-point step so future sources (esp. local files,
     * which should outrank streaming) can slot in without renumbering.
     */
    crossMatchPriority: number;
}

export const SOURCE_META: Record<TrackSource, SourceMeta> = {
    // Streaming services that require a paid subscription for full playback.
    // Cross-match priority preserves the empirical fallback order from the
    // pre-refactor resolver (Apple → SoundCloud → Tidal → iTunes). The
    // numeric gaps are wide enough to slot future sources between any two
    // existing entries without renumbering. Re-tune values when real usage
    // data shows which providers actually win cross-matches most often.
    appleMusic: { access: 'subscription',      crossMatchPriority: 100 },
    soundcloud: { access: 'subscription',      crossMatchPriority: 90  },
    tidal:      { access: 'subscription',      crossMatchPriority: 80  },
    // Subscription PLUS allowlist. Sits below the universally-available
    // subscription sources because cross-match exists specifically to
    // resolve away FROM Spotify when the playback-allowlist gate fails.
    spotify:    { access: 'subscription-beta', crossMatchPriority: 70  },
    // Metadata-only sources — no full playback. Used as last-ditch
    // cross-match candidates and as catalog fillers.
    itunes:     { access: 'metadata-only',     crossMatchPriority: 60  },
    youtube:    { access: 'metadata-only',     crossMatchPriority: 50  },
};

/** User-facing access class for a source — drives badges, colors, copy. */
export function getAccessForSource(source: TrackSource): AccessClass {
    return SOURCE_META[source].access;
}

/** Resolver priority for a source — backend/cross-match consumers only. */
export function getCrossMatchPriority(source: TrackSource): number {
    return SOURCE_META[source].crossMatchPriority;
}

// ─── Connection-state predicates ─────────────────────────────
// Pure helpers for reasoning about whether a service connection is
// BEHAVIORALLY alive vs STRUCTURALLY present. The backend flips
// `.connected` on a 401, but only after a failed request — a quietly-
// expired token can lag reality for minutes-to-hours until the next
// API call. Gating on `expiresAt < now()` catches expired tokens BEFORE
// we claim the provider is usable.
//
// Providers with no expiry field (lastfm, appleMusic) short-circuit the
// expiry check — `typeof undefined === 'number'` is false, so the
// `.connected` flag is the only signal and they behave exactly as they
// did before the overclaim-audit fix.
//
// Two helpers because consumers need OPPOSITE narrative senses:
//
//   • `isEffectivelyConnected` — "can this provider serve a request right
//     now?" Used by the helper layer (getConnectedSources, syncConnectedState)
//     to FILTER expired providers out of selector results so downstream
//     callers never receive a dead connection.
//
//   • `isServiceExpired` — "is this provider specifically in the
//     'connected-but-expired' state?" Used by UI surfaces (ProfileScreen's
//     Patch Cables rows) that need to RENDER expired providers as a
//     distinct state ("PATCHED · EXPIRED") rather than filter them out.
//
// Both helpers derive from the same underlying comparison, so there's
// only one place to change if the expiry semantics ever grow (grace
// periods, clock-skew allowance, etc.).
//
// FOLLOW-UP (Option 2 from the overclaim audit): consumers currently
// compose these two booleans by hand. A future refactor could collapse
// them into a tri-state `getServiceState(service): 'connected' | 'expired'
// | 'unpatched'` so UI layers pattern-match on a single enum. Deferred
// until per-consumer UX design lands for inline-reconnect affordances
// in Library pills and SearchHud source lists.

export function isEffectivelyConnected(service: ServiceConnection | undefined): boolean {
    if (!service?.connected) return false;
    if (typeof service.expiresAt === 'number' && service.expiresAt < Date.now()) return false;
    return true;
}

export function isServiceExpired(service: ServiceConnection | undefined): boolean {
    if (!service?.connected) return false;
    return typeof service.expiresAt === 'number' && service.expiresAt < Date.now();
}

// ─── Sync helper ─────────────────────────────────────────────
// Centralizes connected-state sync so every public function uses
// the same logic and no adapter is accidentally skipped. Expired
// tokens are treated as not-connected at sync time, so downstream
// `.isConnected()` checks across every adapter-based selector
// (getActiveAdapter, getAdapterForSource, getAllConnectedAdapters)
// automatically inherit the expiry-aware filter without each
// getter needing its own check.

function syncConnectedState(connectedServices: ConnectedServices | undefined): void {
    const cs = connectedServices;
    spotifyAdapter.setConnected(isEffectivelyConnected(cs?.spotify));
    soundcloudAdapter.setConnected(isEffectivelyConnected(cs?.soundcloud));
    tidalAdapter.setConnected(isEffectivelyConnected(cs?.tidal));
    // Apple Music catalog search always works; library access needs MusicKit auth.
    // setConnected reflects whether the user has authenticated (for library features).
    // appleMusic has no expiresAt, so isEffectivelyConnected is a no-op upgrade here.
    appleMusicAdapter.setConnected(isEffectivelyConnected(cs?.appleMusic));
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
 * Filters out providers whose stored OAuth token has already expired, so the
 * returned list is BEHAVIORALLY honest (every listed provider can actually
 * serve requests right now) rather than merely STRUCTURALLY present (the
 * connection record exists but the token is dead). See isEffectivelyConnected
 * above for the rationale — same predicate as syncConnectedState.
 *
 * Ordered by tier (1 → 3) so consumers that just iterate the list naturally
 * surface the most-universal source first.
 */
export function getConnectedSources(connectedServices: ConnectedServices | undefined): TrackSource[] {
    if (!connectedServices) return [];
    const sources: TrackSource[] = [];
    // Tier 1
    if (isEffectivelyConnected(connectedServices.appleMusic)) sources.push('appleMusic');
    if (isEffectivelyConnected(connectedServices.soundcloud)) sources.push('soundcloud');
    // Tier 2
    if (isEffectivelyConnected(connectedServices.tidal)) sources.push('tidal');
    // Tier 3 (restricted beta — Spotify)
    if (isEffectivelyConnected(connectedServices.spotify)) sources.push('spotify');
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
