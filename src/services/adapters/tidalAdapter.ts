import { MusicServiceAdapter } from './types';
import { Track } from '../../types';
import { apiFetch } from '../fetchClient';
import { logger } from '../../utils/logger';

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
                logger.warn('tidal', 'Search unavailable', e);
            }
            return [];
        }
    }

    async getStreamUrl(trackId: string): Promise<string> {
        try {
            // Backend handles iTunes fallback for MPEG-DASH manifests automatically.
            // If Tidal returns a direct URL, we get it. If it returns a DASH manifest,
            // the backend fetches track metadata and searches iTunes for a 30s preview.
            const res = await apiFetch<{ url: string }>(`/auth/tidal/stream/${trackId}`);
            return res.url || '';
        } catch (e) {
            logger.warn('tidal', 'getStreamUrl unavailable', e);
            return '';
        }
    }
}

export const tidalAdapter = new TidalAdapter();
