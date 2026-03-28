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

    async search(query: string, options?: { silent?: boolean; rethrow?: boolean }): Promise<Track[]> {
        if (!this.connected) return [];
        try {
            const res = await apiFetch<{ tracks: Track[] }>(`/auth/tidal/search?q=${encodeURIComponent(query)}`);
            return res.tracks;
        } catch (e) {
            if (options?.rethrow) {
                throw e;
            }
            if (!options?.silent) {
                console.log('TidalAdapter search unavailable:', e);
            }
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        try {
            const res = await apiFetch<{ url: string }>(`/auth/tidal/stream/${trackId}`);
            return res.url;
        } catch (e) {
            console.log('TidalAdapter getStreamUrl unavailable:', e);
            return '';
        }
    }
}

export const tidalAdapter = new TidalAdapter();
