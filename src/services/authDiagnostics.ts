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
  appleWebCallbackUri: string;
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
    appleWebCallbackUri: `${API_BASE_URL}/auth/apple/web-callback`,
  };
}

// ─── Apple Web Auth CSRF State ────────────────────────────
// LoginScreen stores state before opening browser; AuthContext verifies it on callback.
let _pendingAppleWebState: string | null = null;
export function setAppleWebAuthState(state: string | null) { _pendingAppleWebState = state; }
export function consumeAppleWebAuthState(): string | null {
  const s = _pendingAppleWebState;
  _pendingAppleWebState = null;
  return s;
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
    `Apple web callback: ${diagnostics.appleWebCallbackUri}`,
  ].join('\n');
}
