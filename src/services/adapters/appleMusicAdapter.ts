/**
 * Apple Music adapter backed by iTunes Search API via backend.
 *
 * Uses the public iTunes Search API (proxied through backend at /api/search/apple-music)
 * to search the Apple Music catalog. Returns 30-sec preview URLs for playback.
 *
 * No user authentication is required — search is always available.
 * When MusicKit integration is added later, this adapter can be upgraded
 * to support full playback and user library access.
 */

import { MusicServiceAdapter } from './types';
import { Track } from '../../types';
import { apiFetch } from '../fetchClient';
import { logger } from '../../utils/logger';

class AppleMusicAdapter implements MusicServiceAdapter {
    serviceName = 'appleMusic' as const;

    /**
     * Apple Music search via iTunes is always available (no auth needed).
     * setConnected is a no-op; isConnected always returns true.
     */
    setConnected(_status: boolean) {
        // No-op: iTunes search doesn't require authentication
    }

    isConnected(): boolean {
        // Always available — iTunes Search API is public
        return true;
    }

    async search(query: string, options?: { silent?: boolean; rethrow?: boolean }): Promise<Track[]> {
        try {
            const res = await apiFetch<{ tracks: Track[] }>(
                `/search/apple-music?q=${encodeURIComponent(query)}`
            );
            return res.tracks;
        } catch (e) {
            if (options?.rethrow) throw e;
            if (!options?.silent) {
                logger.warn('appleMusic', 'Search unavailable', e);
            }
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        // For now, Apple Music tracks use their previewUrl directly.
        // The track object already has previewUrl set from the search response.
        // Full playback will require MusicKit SDK integration.
        logger.debug('appleMusic', `getStreamUrl called for ${trackId} — using previewUrl from track`);
        return '';
    }
}

export const appleMusicAdapter = new AppleMusicAdapter();
