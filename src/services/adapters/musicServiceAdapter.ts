import { MusicServiceAdapter } from './types';
import { spotifyAdapter } from './spotifyAdapter';
import { soundcloudAdapter } from './soundcloudAdapter';
import { tidalAdapter } from './tidalAdapter';
import { ConnectedServices, TrackSource } from '../../types';

/**
 * Derive the list of connected TrackSource keys from the auth context.
 * Single source of truth — use this instead of manually checking each service.
 */
export function getConnectedSources(connectedServices: ConnectedServices | undefined): TrackSource[] {
    if (!connectedServices) return [];
    const sources: TrackSource[] = [];
    if (connectedServices.soundcloud?.connected) sources.push('soundcloud');
    if (connectedServices.spotify?.connected) sources.push('spotify');
    if (connectedServices.appleMusic?.connected) sources.push('appleMusic');
    if (connectedServices.tidal?.connected) sources.push('tidal');
    return sources;
}

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

/**
 * Returns the adapter that owns a specific track source.
 * Use for playback — routes to the correct service instead of the
 * highest-priority connected one.
 *
 * Falls back to getActiveAdapter if the source adapter isn't connected
 * (e.g. another user queued a Tidal track but you only have Spotify).
 */
export function getAdapterForSource(
    source: TrackSource | undefined,
    connectedServices: ConnectedServices | undefined,
): MusicServiceAdapter {
    // Sync state so .isConnected() is fresh
    if (connectedServices) {
        spotifyAdapter.setConnected(!!connectedServices.spotify?.connected);
        soundcloudAdapter.setConnected(!!connectedServices.soundcloud?.connected);
        tidalAdapter.setConnected(!!connectedServices.tidal?.connected);
    }

    const adapterMap: Record<string, MusicServiceAdapter> = {
        spotify: spotifyAdapter,
        soundcloud: soundcloudAdapter,
        tidal: tidalAdapter,
    };

    const target = source ? adapterMap[source] : undefined;
    if (target?.isConnected()) return target;

    // Source adapter unavailable — fall back to priority routing
    return getActiveAdapter(connectedServices);
}

/**
 * Returns ALL connected adapters — used for library browsing where
 * the user should see playlists from every service they've linked,
 * not just the highest-priority one.
 */
export function getAllConnectedAdapters(connectedServices: ConnectedServices | undefined): MusicServiceAdapter[] {
    if (!connectedServices) return [];

    // Sync internal state
    spotifyAdapter.setConnected(!!connectedServices.spotify?.connected);
    soundcloudAdapter.setConnected(!!connectedServices.soundcloud?.connected);
    tidalAdapter.setConnected(!!connectedServices.tidal?.connected);

    const adapters: MusicServiceAdapter[] = [];
    if (soundcloudAdapter.isConnected()) adapters.push(soundcloudAdapter);
    if (spotifyAdapter.isConnected()) adapters.push(spotifyAdapter);
    if (tidalAdapter.isConnected()) adapters.push(tidalAdapter);

    return adapters;
}
