/**
 * iTunes Search API — real music catalog, zero auth required.
 *
 * Endpoint: https://itunes.apple.com/search
 * Returns 30-second preview URLs, album art, duration, etc.
 * No API key. No rate limit headers. Just works.
 *
 * We map iTunes results → our Track type so the rest of the app
 * doesn't know or care where the data came from.
 */

import type { Track } from '../types';

// ─── iTunes API Response Types ──────────────────────────────

interface ITunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  trackViewUrl?: string;
}

interface ITunesSearchResponse {
  resultCount: number;
  results: ITunesResult[];
}

// ─── Config ─────────────────────────────────────────────────

const ITUNES_BASE = 'https://itunes.apple.com/search';
const DEFAULT_LIMIT = 20;

// ─── Search ─────────────────────────────────────────────────

/**
 * Search iTunes for tracks. Returns results mapped to our Track type.
 * Filters out results with no preview URL (we need audio to play).
 */
export async function searchItunes(
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<Track[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    term: query.trim(),
    media: 'music',
    entity: 'song',
    limit: String(limit),
  });

  const response = await fetch(`${ITUNES_BASE}?${params}`);

  if (!response.ok) {
    throw new Error(`iTunes search failed: ${response.status}`);
  }

  const data: ITunesSearchResponse = await response.json();

  // Filter to results that have a preview URL and map to our Track type
  return data.results
    .filter((r) => r.previewUrl)
    .map(mapITunesResultToTrack);
}

// ─── Mapper ─────────────────────────────────────────────────

function mapITunesResultToTrack(result: ITunesResult): Track {
  return {
    id: `itunes_${result.trackId}`,
    title: result.trackName,
    artist: result.artistName,
    album: result.collectionName,
    albumArt: upgradeArtworkUrl(result.artworkUrl100),
    previewUrl: result.previewUrl,
    duration: result.trackTimeMillis
      ? Math.round(result.trackTimeMillis / 1000)
      : 30, // preview is ~30s
    source: 'itunes',
    sourceId: String(result.trackId),
  };
}

/**
 * iTunes returns 100x100 artwork by default.
 * Swap to 300x300 for sharper display on mobile.
 */
function upgradeArtworkUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace('100x100bb', '300x300bb');
}

export default { searchItunes };
