import { MusicServiceAdapter } from './types';
import { spotifyAdapter } from './spotifyAdapter';
import { soundcloudAdapter } from './soundcloudAdapter';
import { tidalAdapter } from './tidalAdapter';
import { ConnectedServices } from '../../types';

export function getActiveAdapter(connectedServices: ConnectedServices | undefined): MusicServiceAdapter {
    if (!connectedServices) {
        spotifyAdapter.setConnected(false);
        soundcloudAdapter.setConnected(false);
        tidalAdapter.setConnected(false);
        return spotifyAdapter; // Safe fallback since disconnected returns empty
    }

    // Sync internal state with the global AuthContext payload
    spotifyAdapter.setConnected(!!connectedServices.spotify?.connected);
    soundcloudAdapter.setConnected(!!connectedServices.soundcloud?.connected);
    tidalAdapter.setConnected(!!connectedServices.tidal?.connected);

    // Priority Routing: Tidal > Spotify > SoundCloud
    if (tidalAdapter.isConnected()) {
        return tidalAdapter;
    }

    if (spotifyAdapter.isConnected()) {
        return spotifyAdapter;
    }

    if (soundcloudAdapter.isConnected()) {
        return soundcloudAdapter;
    }

    // Default fallback returns empty responses safely due to the !isConnected checks inside the adapters
    return spotifyAdapter;
}
