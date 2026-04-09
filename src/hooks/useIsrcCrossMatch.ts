/**
 * ISRC Cross-Match — Playable-track resolver.
 * ─────────────────────────────────────────────────────────────
 * Spotify search returns results to EVERY user via the backend
 * Client Credentials metadata proxy, but Spotify full-track
 * playback is restricted to the ≤5 allowlisted users inside
 * Spotify's Feb 2026 Dev Mode cap. For everyone else, a queued
 * Spotify track must be resolved to a playable equivalent on
 * Apple Music / Tidal / SoundCloud / iTunes-preview via ISRC
 * (and title+artist fuzzy fallback for sources without ISRC APIs).
 *
 * This module is NOT a React hook — the `use*` prefix is kept for
 * naming consistency with other hook files in `src/hooks/`. It's a
 * pure async function that hits `POST /api/match/resolve` on the
 * backend and swaps the track shape in-place if a better Tier 1/2
 * equivalent is found. The real call site is `SessionRoomScreen`'s
 * `handleAddTrack` (wrapped in a fire-and-forget IIFE so the sync
 * boolean return contract is preserved for prop-type compatibility).
 *
 * Resolution priority (highest tier wins):
 *   1. Apple Music  (Tier 1, ISRC-exact)
 *   2. SoundCloud   (Tier 1, title+artist fuzzy)
 *   3. Tidal        (Tier 2, ISRC-exact)
 *   4. iTunes       (Tier 1 preview, title+artist fuzzy)
 *   5. Original track (Tier 3 Spotify — the allowlist path)
 *
 * The backend service is infallible: provider failures settle as
 * `undefined` in the response rather than throwing. On total API
 * failure we return the original track so the queue still works.
 */

import { Track } from '../types';
import { apiFetch } from '../services/fetchClient';
import { logger } from '../utils/logger';

/**
 * Response shape of `POST /api/match/resolve`. Each field is optional
 * because the backend returns only the providers that matched — missing
 * providers mean "no playable equivalent found", not an error.
 */
interface CrossMatchResponse {
  appleMusic?: Track;
  soundcloud?: Track;
  tidal?: Track;
  itunes?: Track;
}

/**
 * Resolve a discovered track to its highest-tier playable equivalent.
 *
 * Only touches Spotify-sourced tracks. All other sources (Apple Music,
 * SoundCloud, Tidal, iTunes, YouTube) are already Tier 1/2 and play
 * natively on their own adapters — no resolution needed.
 *
 * @returns the resolved track (with `metadataSource: 'spotify'` set),
 *          or the original track unchanged if no better equivalent was
 *          found OR the resolve call failed.
 */
export async function resolvePlayableTrack(track: Track): Promise<Track> {
  // Non-Spotify sources already play on their own adapter — nothing to do.
  if (track.source !== 'spotify') return track;

  // The backend needs title + artist for the SoundCloud/iTunes fuzzy paths.
  // Without them, only an exact-ISRC Apple/Tidal match would work, and if
  // those fail we'd silently return the original anyway — cheaper to skip.
  if (!track.title || !track.artist) return track;

  try {
    const match = await apiFetch<CrossMatchResponse>('/match/resolve', {
      method: 'POST',
      body: JSON.stringify({
        isrc: track.isrc,
        title: track.title,
        artist: track.artist,
      }),
    });

    // Priority walk — highest tier first.
    const resolved =
      match.appleMusic || match.soundcloud || match.tidal || match.itunes;

    if (!resolved) {
      // No cross-match hit on any provider. The allowlist path (full
      // Spotify playback) is still viable for Tier 3 users, so keep the
      // original track.
      return track;
    }

    return {
      ...resolved,
      // Preserve queue bookkeeping fields from the Spotify result so the
      // UI (voteCount, addedBy, votedBy, etc.) stays attached to the
      // *same* logical queue entry after resolution.
      addedBy: track.addedBy,
      votes: track.votes,
      voltageBoost: track.voltageBoost,
      reactions: track.reactions,
      // Attribution: let the UI render a "via Spotify" chip on the
      // resolved Apple/SoundCloud/Tidal/iTunes row.
      metadataSource: 'spotify',
      // Carry ISRC forward — the Spotify track had it, the resolved track
      // may not (iTunes search results often lack ISRC even on exact hits).
      isrc: track.isrc ?? resolved.isrc,
    };
  } catch (e) {
    // Cross-match is best-effort. If the backend is down or the user
    // has poor network, fall back to the original track so enqueue
    // still works — it just won't get the tier upgrade.
    logger.warn('isrcCrossMatch', 'resolvePlayableTrack failed, using original', e);
    return track;
  }
}
