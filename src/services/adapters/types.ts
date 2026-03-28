import { Track, Playlist } from '../../types';

export interface MusicServiceAdapter {
    /**
     * Identifies the service this adapter handles
     */
    readonly serviceName: 'spotify' | 'soundcloud' | 'tidal' | 'appleMusic';

    /**
     * Search for tracks on this service
     */
    search(query: string, options?: { silent?: boolean; rethrow?: boolean }): Promise<Track[]>;

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

    // ─── Library Access (optional — not all adapters support these yet) ───

    /**
     * Fetch the user's playlists from this service
     */
    getUserPlaylists?(): Promise<Playlist[]>;

    /**
     * Fetch the tracks within a specific playlist
     */
    getPlaylistTracks?(playlistId: string): Promise<Track[]>;

    /**
     * Fetch the user's liked/saved tracks on this service
     */
    getLikedTracks?(): Promise<Track[]>;
}
