/**
 * Stub adapters for track sources that don't have full playback support yet.
 *
 * These prevent runtime crashes when a track with an unsupported source
 * (appleMusic, youtube, itunes) enters the queue. Instead of crashing on
 * a missing adapter, they return empty results and log a clear message.
 */

import { MusicServiceAdapter } from './types';
import { Track, TrackSource } from '../../types';

type StubSource = 'appleMusic' | 'youtube' | 'itunes';

function createStubAdapter(name: StubSource): MusicServiceAdapter {
    let connected = false;

    return {
        serviceName: name as TrackSource,

        search(_query: string): Promise<Track[]> {
            console.log(`[${name}Adapter] Search not implemented yet`);
            return Promise.resolve([]);
        },

        getStreamUrl(_trackId: string): Promise<string> {
            console.log(`[${name}Adapter] Playback not supported yet — no stream URL available`);
            return Promise.resolve('');
        },

        isConnected(): boolean {
            return connected;
        },

        setConnected(status: boolean) {
            connected = status;
        },
    };
}

/**
 * Apple Music stub — will be replaced with a real adapter when
 * Apple Music integration is implemented via MusicKit JS / App Remote.
 */
export const appleMusicAdapter = createStubAdapter('appleMusic');

/** YouTube stub — no playback integration planned yet. */
export const youtubeAdapter = createStubAdapter('youtube');

/** iTunes stub — iTunes preview URLs are handled directly in playbackEngine. */
export const itunesAdapter = createStubAdapter('itunes');
