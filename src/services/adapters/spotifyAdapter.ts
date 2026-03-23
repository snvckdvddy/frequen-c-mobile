import { MusicServiceAdapter } from './types';
import { Track } from '../../types';
import { apiFetch } from '../fetchClient';
import { searchItunes } from '../itunesSearch';

class SpotifyAdapter implements MusicServiceAdapter {
    serviceName = 'spotify' as const;
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
            // Calls existing backend endpoint which uses the stored access token
            const res = await apiFetch<{ tracks: Track[] }>(`/search/tracks?q=${encodeURIComponent(query)}`);
            return res.tracks;
        } catch (e) {
            if (options?.rethrow) {
                throw e;
            }
            if (!options?.silent) {
                console.log('SpotifyAdapter search unavailable:', e);
            }
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        // Our existing backend mapping exposes the 30-second `previewUrl`.
        // We will ping our proxy to fetch the single track for playback if needed.
        try {
            const res = await apiFetch<{ track: Track }>(`/spotify/track/${trackId}`);
            const url = res.track.previewUrl;
            if (url) return url;

            // Spotify preview unavailable — silently fall back to iTunes 30s preview.
            // This keeps playback working without the user ever noticing the source swap.
            return this.fallbackToItunes(res.track.title, res.track.artist);
        } catch (e) {
            console.log('SpotifyAdapter getStreamUrl unavailable:', e);
            return '';
        }
    }

    /**
     * Silent iTunes fallback — searches by "title artist" and returns the first
     * matching preview URL. Returns empty string if no match found.
     */
    private async fallbackToItunes(title?: string, artist?: string): Promise<string> {
        if (!title) return '';
        try {
            const query = artist ? `${title} ${artist}` : title;
            const results = await searchItunes(query, 1);
            return results[0]?.previewUrl || '';
        } catch {
            // Fallback failed silently — no audio is better than a crash
            return '';
        }
    }
}

export const spotifyAdapter = new SpotifyAdapter();
