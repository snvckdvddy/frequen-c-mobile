import { MusicServiceAdapter } from './types';
import { Track, Playlist } from '../../types';
import { apiFetch } from '../fetchClient';
import { logger } from '../../utils/logger';

class SoundCloudAdapter implements MusicServiceAdapter {
    serviceName = 'soundcloud' as const;
    private connected = false;

    setConnected(status: boolean) {
        this.connected = status;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async search(query: string, options?: { silent?: boolean; rethrow?: boolean }): Promise<Track[]> {
        if (!this.connected) return [];
        try {
            // Proxy through backend to avoid CORS and attach server-side OAuth token
            const res = await apiFetch<{ tracks: Track[] }>(`/auth/soundcloud/search?q=${encodeURIComponent(query)}`);
            return res.tracks;
        } catch (e) {
            if (options?.rethrow) {
                throw e;
            }
            if (!options?.silent) {
                logger.warn('soundcloud', 'Search unavailable', e);
            }
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        try {
            const res = await apiFetch<{ url: string }>(`/auth/soundcloud/stream/${trackId}`);
            return res.url;
        } catch (e) {
            logger.warn('soundcloud', 'getStreamUrl unavailable', e);
            return '';
        }
    }

    // ─── Library Access ─────────────────────────────────────

    async getUserPlaylists(): Promise<Playlist[]> {
        if (!this.connected) return [];
        try {
            const res = await apiFetch<{ playlists: Playlist[] }>('/auth/soundcloud/playlists');
            return res.playlists;
        } catch (e) {
            logger.warn('soundcloud', 'getUserPlaylists unavailable', e);
            return [];
        }
    }

    async getPlaylistTracks(playlistId: string): Promise<Track[]> {
        if (!this.connected) return [];
        try {
            const res = await apiFetch<{ tracks: Track[] }>(`/auth/soundcloud/playlists/${playlistId}/tracks`);
            return res.tracks;
        } catch (e) {
            logger.warn('soundcloud', 'getPlaylistTracks unavailable', e);
            return [];
        }
    }

    async getLikedTracks(): Promise<Track[]> {
        if (!this.connected) return [];
        try {
            const res = await apiFetch<{ tracks: Track[] }>('/auth/soundcloud/likes');
            return res.tracks;
        } catch (e) {
            logger.warn('soundcloud', 'getLikedTracks unavailable', e);
            return [];
        }
    }
}

export const soundcloudAdapter = new SoundCloudAdapter();
