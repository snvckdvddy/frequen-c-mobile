import { Track } from '../../types';

export interface MusicServiceAdapter {
    /**
     * Identifies the service this adapter handles
     */
    readonly serviceName: 'spotify' | 'soundcloud' | 'tidal';

    /**
     * Search for tracks on this service
     */
    search(query: string): Promise<Track[]>;

    /**
     * Retrieve an audio stream URL (or equivalent identifier) for playback
     * Note: For Spotify, this might return the uri directly for a proxy, 
     * while Soundcloud/Tidal return actual stream URLs.
     */
    getStreamUrl(trackId: string): Promise<string>;

    /**
     * Checks if this service is currently authenticated/connected
     */
    isConnected(): boolean;
}
