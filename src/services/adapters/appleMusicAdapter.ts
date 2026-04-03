/**
 * Apple Music adapter — dual-mode: public catalog search + authenticated library access.
 *
 * Catalog search: Always available via the public iTunes Search API (no auth needed).
 * Library access: Requires a MusicKit user token stored after the user connects their
 * Apple Music account. Library playlists and songs are fetched through the backend,
 * which uses the stored Music User Token to call Apple Music API.
 *
 * isConnected() reflects whether the user has authenticated their Apple Music.
 * Search always works regardless — the adapter routes to catalog or library based on intent.
 */

import { MusicServiceAdapter } from './types';
import { Track } from '../../types';
import { apiFetch } from '../fetchClient';
import { logger } from '../../utils/logger';

interface LibraryResponse {
    tracks: Track[];
    hasMore: boolean;
}

interface PlaylistResponse {
    playlists: Array<{ id: string; name: string; description: string; artwork: string }>;
    hasMore: boolean;
}

class AppleMusicAdapter implements MusicServiceAdapter {
    serviceName = 'appleMusic' as const;
    private _connected = false;

    /**
     * Set whether the user has authenticated their Apple Music account.
     * Does NOT affect catalog search — only library features.
     */
    setConnected(status: boolean) {
        this._connected = status;
    }

    /**
     * Returns true if the user has connected their Apple Music account.
     * Catalog search works regardless; this gates library-only features.
     */
    isConnected(): boolean {
        return this._connected;
    }

    /**
     * Catalog search — always available (public iTunes API).
     */
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
        // Full playback handled by WebView SDK backend in Phase 3.
        // Track objects carry previewUrl from search — used as fallback until then.
        logger.debug('appleMusic', `getStreamUrl called for ${trackId} — using previewUrl from track`);
        return '';
    }

    // ─── Library Access (MusicServiceAdapter interface) ──────

    async getUserPlaylists(): Promise<import('../../types').Playlist[]> {
        if (!this._connected) return [];
        try {
            const res = await apiFetch<PlaylistResponse>(
                '/auth/apple-music/library/playlists?limit=100'
            );
            return res.playlists.map((p) => ({
                id: p.id,
                name: p.name,
                coverArt: p.artwork || undefined,
                trackCount: 0, // Apple Music doesn't return count in list endpoint
                source: 'appleMusic' as const,
            }));
        } catch (e) {
            logger.warn('appleMusic', 'Failed to fetch library playlists', e);
            return [];
        }
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        if (!this._connected) return [];
        try {
            const res = await apiFetch<LibraryResponse>(
                `/auth/apple-music/library/playlists/${playlistId}/tracks?limit=300`
            );
            return res.tracks;
        } catch (e) {
            logger.warn('appleMusic', 'Failed to fetch playlist tracks', e);
            return [];
        }
    }

    async getLikedTracks(): Promise<Track[]> {
        if (!this._connected) return [];
        try {
            const res = await apiFetch<LibraryResponse>(
                '/auth/apple-music/library/songs?limit=100'
            );
            return res.tracks;
        } catch (e) {
            logger.warn('appleMusic', 'Failed to fetch library songs', e);
            return [];
        }
    }
}

export const appleMusicAdapter = new AppleMusicAdapter();
