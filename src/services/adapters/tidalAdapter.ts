import { MusicServiceAdapter } from './types';
import { Track } from '../../types';
import { apiFetch } from '../fetchClient';

class TidalAdapter implements MusicServiceAdapter {
    serviceName = 'tidal' as const;
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
            const res = await apiFetch<{ tracks: Track[] }>(`/auth/tidal/search?q=${encodeURIComponent(query)}`);
            return res.tracks;
        } catch (e) {
            console.error('TidalAdapter search failed:', e);
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        try {
            const res = await apiFetch<{ url: string }>(`/auth/tidal/stream/${trackId}`);
            return res.url;
        } catch (e) {
            console.error('TidalAdapter getStreamUrl failed:', e);
            return '';
        }
    }
}

export const tidalAdapter = new TidalAdapter();
