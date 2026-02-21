import { MusicServiceAdapter } from './types';
import { Track } from '../../types';
import { apiFetch } from '../fetchClient';

class SpotifyAdapter implements MusicServiceAdapter {
    serviceName = 'spotify' as const;
    private connected = false;

    setConnected(status: boolean) {
        this.connected = status;
    }

    isConnected(): boolean {
        return this.connected;
    }

    async search(query: string): Promise<Track[]> {
        if (!this.connected) return [];
        try {
            // Calls existing backend endpoint which uses the stored access token
            const res = await apiFetch<{ tracks: Track[] }>(`/search/tracks?q=${encodeURIComponent(query)}`);
            return res.tracks;
        } catch (e) {
            console.error('SpotifyAdapter search failed:', e);
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        // Our existing backend mapping exposes the 30-second `previewUrl`.
        // We will ping our proxy to fetch the single track for playback if needed.
        try {
            const res = await apiFetch<{ track: Track }>(`/spotify/track/${trackId}`);
            return res.track.previewUrl || '';
        } catch (e) {
            console.error('SpotifyAdapter getStreamUrl failed:', e);
            return '';
        }
    }
}

export const spotifyAdapter = new SpotifyAdapter();
