import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { API_BASE_URL } from './config';

export interface AuthDiagnostics {
  appOwnership: string;
  isExpoGo: boolean;
  spotifyRedirectUri: string;
  tidalRedirectUri: string;
  lastfmRedirectUri: string;
  soundcloudRedirectUri: string;
  soundcloudSessionReturnUrl: string;
}

export function getAuthDiagnostics(): AuthDiagnostics {
  const appOwnership = Constants.appOwnership || 'standalone';
  const isExpoGo = appOwnership === 'expo';

  return {
    appOwnership,
    isExpoGo,
    // Locked native callbacks for strict provider allowlists.
    // Do not revert Spotify/Tidal to bare "frequenc://" without updating dashboards and docs.
    spotifyRedirectUri: makeRedirectUri({ native: 'frequenc://spotify-auth', scheme: 'frequenc', path: 'spotify-auth' }),
    tidalRedirectUri: makeRedirectUri({ native: 'frequenc://tidal-auth', scheme: 'frequenc', path: 'tidal-auth' }),
    lastfmRedirectUri: makeRedirectUri({ scheme: 'frequenc' }),
    soundcloudRedirectUri: `${API_BASE_URL}/auth/soundcloud/callback`,
    soundcloudSessionReturnUrl: makeRedirectUri(),
  };
}

export function formatAuthDiagnosticsText(): string {
  const diagnostics = getAuthDiagnostics();
  return [
    `App ownership: ${diagnostics.appOwnership}`,
    `Expo Go: ${diagnostics.isExpoGo ? 'yes' : 'no'}`,
    `Spotify redirect: ${diagnostics.spotifyRedirectUri}`,
    `Tidal redirect: ${diagnostics.tidalRedirectUri}`,
    `Last.fm redirect: ${diagnostics.lastfmRedirectUri}`,
    `SoundCloud backend callback: ${diagnostics.soundcloudRedirectUri}`,
    `SoundCloud app return: ${diagnostics.soundcloudSessionReturnUrl}`,
  ].join('\n');
}
