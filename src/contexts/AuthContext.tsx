/**
 * Auth Context
 *
 * Manages authentication state globally.
 * On mount, checks for stored token and auto-authenticates.
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from 'react';
import {
  authApi,
  ApiError,
  storeToken,
  clearToken,
  getStoredToken,
  setCurrentServices,
  type DisconnectableProvider,
} from '../services/api';
import { config } from '../config';
import { AppState, Linking, type AppStateStatus } from 'react-native';
import type { User, AuthState } from '../types';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, ResponseType } from 'expo-auth-session';
import { getAuthDiagnostics, consumeAppleWebAuthState } from '../services/authDiagnostics';
import { showToast } from '../components/ui';
import { useBiometric } from '../hooks/useBiometric';
import type { BiometricState } from '../hooks/useBiometric';

WebBrowser.maybeCompleteAuthSession();
const BYPASS_AUTH = (process.env.EXPO_PUBLIC_BYPASS_AUTH || 'false') === 'true';

// Spotify Discovery
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const tidalDiscovery = {
  authorizationEndpoint: 'https://login.tidal.com/authorize',
  tokenEndpoint: 'https://auth.tidal.com/v1/oauth2/token',
};

// ─── State ──────────────────────────────────────────────────

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_ERROR'; payload: string };

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'SET_ERROR':
      return { ...state, isLoading: false };
    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithApple: (identityToken: string, user?: string, fullName?: string, email?: string) => Promise<{ isNewUser: boolean }>;
  loginWithGoogle: (idToken: string) => Promise<{ isNewUser: boolean }>;
  setPassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  connectSpotify: () => Promise<void>;
  connectSoundcloud: () => Promise<void>;
  connectTidal: () => Promise<void>;
  connectLastfm: () => Promise<void>;
  disconnectService: (provider: DisconnectableProvider) => Promise<void>;
  /** Biometric state + controls exposed so UI can show toggles / offer opt-in. */
  biometric: BiometricState & {
    enableBiometric: (token: string) => Promise<boolean>;
    disableBiometric: () => Promise<void>;
    markOffered: () => Promise<void>;
  };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const providerLabel: Record<DisconnectableProvider, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  tidal: 'Tidal',
  lastfm: 'Last.fm',
};

function summarizeConnectedServices(user: User | null) {
  return {
    spotify: {
      connected: !!user?.connectedServices?.spotify?.connected,
      username: user?.connectedServices?.spotify?.username,
    },
    soundcloud: {
      connected: !!user?.connectedServices?.soundcloud?.connected,
      username: user?.connectedServices?.soundcloud?.username,
    },
    tidal: {
      connected: !!user?.connectedServices?.tidal?.connected,
      username: user?.connectedServices?.tidal?.username,
    },
    lastfm: {
      connected: !!user?.connectedServices?.lastfm?.connected,
      username: user?.connectedServices?.lastfm?.username,
    },
  };
}

function friendlyAuthError(service: 'Spotify' | 'SoundCloud' | 'Tidal' | 'Last.fm', detail?: string) {
  const lower = (detail || '').toLowerCase();
  if (lower.includes('redirect') || lower.includes('callback') || lower.includes('mismatch')) {
    return `${service} failed: redirect URL mismatch. Check app + provider callback settings.`;
  }
  if (lower.includes('client') || lower.includes('id') || lower.includes('secret')) {
    return `${service} failed: provider credentials are not configured correctly.`;
  }
  return `${service} patch failed. Check provider settings and try again.`;
}

function compactProviderDetail(detail?: string) {
  if (!detail) return undefined;
  const compact = detail.replace(/\s+/g, ' ').trim();
  if (!compact) return undefined;
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function friendlyProviderError(service: 'Spotify' | 'SoundCloud' | 'Tidal' | 'Last.fm', detail?: string) {
  const normalized = compactProviderDetail(detail);
  const lower = (normalized || '').toLowerCase();
  if (lower.includes('access_denied') || lower.includes('canceled') || lower.includes('cancel')) {
    return `${service} patch canceled`;
  }
  if (lower.includes('redirect') || lower.includes('callback') || lower.includes('mismatch')) {
    return `${service} failed: redirect URL mismatch. Check app + provider callback settings.`;
  }
  if (lower.includes('invalid_grant') || lower.includes('code_verifier')) {
    return `${service} failed: the authorization code or PKCE verifier was rejected. Start the patch flow again.`;
  }
  if (lower.includes('client') || lower.includes('id') || lower.includes('secret')) {
    return `${service} failed: provider credentials are not configured correctly.`;
  }
  if (lower.includes('state')) {
    return `${service} failed: auth state expired. Start the patch flow again.`;
  }
  if (normalized) {
    return `${service} failed: ${normalized}`;
  }
  return `${service} patch failed. Check provider settings and try again.`;
}

function getUrlQueryParam(url: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = url.match(new RegExp(`[?&]${escaped}=([^&#]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function extractProviderErrorDetail(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | undefined;
    if (body) {
      if (typeof body.details === 'string') {
        return body.details;
      }
      if (body.details && typeof body.details === 'object') {
        try {
          return JSON.stringify(body.details);
        } catch {
          // ignore
        }
      }
      if (typeof body.reason === 'string') {
        return body.reason;
      }
      if (Array.isArray(body.missing) && body.missing.length > 0) {
        return `Missing backend config: ${body.missing.join(', ')}`;
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
}

type PendingAuthProvider = 'spotify' | 'soundcloud' | 'tidal' | 'lastfm';

// ─── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const bio = useBiometric();
  const authDiagnostics = getAuthDiagnostics();
  const bootstrappedRef = useRef(false);
  const lastHandledSoundcloudUrlRef = useRef<string | null>(null);
  const lastHandledAuthUrlRef = useRef<string | null>(null);
  const pendingAuthProviderRef = useRef<PendingAuthProvider | null>(null);

  // Spotify Auth Request Setup
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: config.SPOTIFY_CLIENT_ID,
      scopes: ['user-read-email', 'user-read-private', 'playlist-read-private'],
      usePKCE: true,
      redirectUri: authDiagnostics.spotifyRedirectUri,
    },
    discovery
  );

  // Tidal Auth Request Setup
  const [tidalRequest, tidalResponse, promptTidalAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: config.TIDAL_CLIENT_ID,
      scopes: ['user.read', 'collection.read', 'search.read', 'playback', 'entitlements.read'],
      usePKCE: true,
      redirectUri: authDiagnostics.tidalRedirectUri,
    },
    tidalDiscovery
  );

  // Sync external adapter dependency tree with active user connectedServices
  useEffect(() => {
    setCurrentServices(state.user?.connectedServices);
    const isDevRuntime = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
    if (isDevRuntime) {
      console.log(`[SearchTruth][auth] ${JSON.stringify({
        userId: state.user?.id || null,
        connectedServices: summarizeConnectedServices(state.user),
      })}`);
    }
  }, [state.user?.connectedServices]);

  // Catch the Spotify Auth Response
  useEffect(() => {
    if (response?.type === 'success' && state.user && state.token) {
      const { code } = response.params;
      const codeVerifier = request?.codeVerifier;
      const redirectUri = request?.redirectUri;

      if (!codeVerifier || !redirectUri) {
        console.error('Missing codeVerifier or redirectUri for PKCE exchange');
        return;
      }

      // Send authorization code to backend for token exchange
      authApi.connectSpotify(code, codeVerifier, redirectUri).then((data) => {
        dispatch({
          type: 'SET_USER',
          payload: {
            user: {
              ...state.user!,
              connectedServices: {
                ...state.user!.connectedServices,
                spotify: {
                  connected: true,
                  username: data.user?.connectedServices?.spotify?.username || 'connected'
                }
              }
            },
            token: state.token!,
          }
        });
        showToast('Spotify patched', 'success');
      }).catch(err => {
        console.error('Failed to connect Spotify on backend:', err);
        showToast(friendlyAuthError('Spotify', (err as Error)?.message), 'error');
      });
    } else if (response?.type === 'error') {
      console.error('Spotify OAuth error:', response.error);
      showToast(friendlyAuthError('Spotify', response.error?.message), 'error');
    } else if (response?.type === 'dismiss') {
      console.log('Spotify auth dismissed by user');
    }
  }, [response]);

  // Catch the Tidal Auth Response
  useEffect(() => {
    if (tidalResponse?.type === 'success' && state.user && state.token) {
      const { code } = tidalResponse.params;
      const codeVerifier = tidalRequest?.codeVerifier;
      const redirectUri = tidalRequest?.redirectUri;

      if (!redirectUri) return;

      authApi.connectTidal(code, codeVerifier || '', redirectUri).then(async () => {
        const { user } = await authApi.me();
        dispatch({ type: 'SET_USER', payload: { user, token: state.token! } });
        showToast('Tidal patched', 'success');
      }).catch(err => {
        console.error('Failed to connect Tidal on backend:', err);
        showToast(friendlyAuthError('Tidal', (err as Error)?.message), 'error');
      });
    } else if (tidalResponse?.type === 'error') {
      showToast(friendlyAuthError('Tidal', tidalResponse.error?.message), 'error');
    }
  }, [tidalResponse]);

  // completeSpotifyAuth and completeTidalAuth removed — Spotify/Tidal auth
  // is now fully handled by promptAsync → useEffect([response/tidalResponse]).
  // The old functions were dead code after the fix in commit bf84f9e.

  const completeLastfmAuth = useCallback(async (url: string) => {
    const error = getUrlQueryParam(url, 'error');
    const errorDescription = getUrlQueryParam(url, 'error_description');
    if (error) {
      showToast(friendlyProviderError('Last.fm', errorDescription || error), 'error');
      return true;
    }

    const tokenParam = getUrlQueryParam(url, 'token');
    if (!tokenParam || !state.token) {
      return false;
    }

    try {
      await authApi.connectLastfm(tokenParam);
      const { user } = await authApi.me();
      dispatch({ type: 'SET_USER', payload: { user, token: state.token } });
      showToast('Last.fm patched', 'success');
    } catch (err) {
      console.error('Failed to connect Last.fm:', err);
      showToast(friendlyProviderError('Last.fm', (err as Error)?.message), 'error');
    }
    return true;
  }, [state.token]);

  const handleSoundcloudRedirect = useCallback(async (url: string) => {
    if (!url || lastHandledSoundcloudUrlRef.current === url) return false;

    const service = getUrlQueryParam(url, 'service');
    const status = getUrlQueryParam(url, 'status');
    if (service !== 'soundcloud' || (status !== 'success' && status !== 'error')) {
      return false;
    }

    lastHandledSoundcloudUrlRef.current = url;

    if (status === 'success' && state.token) {
      try {
        const { user } = await authApi.me();
        dispatch({ type: 'SET_USER', payload: { user, token: state.token } });
        showToast('SoundCloud patched', 'success');
      } catch (err) {
        console.error('Failed to refresh user after SoundCloud callback:', err);
        showToast('SoundCloud callback returned, but account refresh failed.', 'error');
      }
      return true;
    }

    showToast(friendlyAuthError('SoundCloud', url), 'error');
    return true;
  }, [state.token]);

  // ── Apple Web Auth Callback (Android) ────────────────────
  const handleAppleWebCallback = useCallback(async (url: string): Promise<boolean> => {
    if (!url.includes('apple-auth')) return false;
    const params = new URLSearchParams(url.split('?')[1] || '');
    const token = params.get('token');
    const error = params.get('error');
    const returnedState = params.get('state');

    if (error) {
      showToast(`Apple sign in failed: ${error}`, 'error');
      return true;
    }
    if (!token) return false;

    // CSRF: verify state matches what LoginScreen stored before opening the browser
    const expectedState = consumeAppleWebAuthState();
    if (!returnedState || returnedState !== expectedState) {
      showToast('Apple sign in failed: invalid state', 'error');
      return true;
    }

    try {
      await storeToken(token);
      const { user } = await authApi.me();
      dispatch({ type: 'SET_USER', payload: { user, token } });
      const isNewUser = params.get('isNewUser') === 'true';
      showToast(isNewUser ? 'Welcome to Frequen-C!' : 'Signed in with Apple', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to complete Apple sign in';
      showToast(message, 'error');
    }
    return true;
  }, []);

  const handleIncomingAuthUrl = useCallback(async (url: string) => {
    if (!url || lastHandledAuthUrlRef.current === url) return false;

    // Claim the URL immediately to prevent concurrent handlers from double-processing
    lastHandledAuthUrlRef.current = url;

    if (await handleAppleWebCallback(url)) {
      pendingAuthProviderRef.current = null;
      return true;
    }

    if (await handleSoundcloudRedirect(url)) {
      pendingAuthProviderRef.current = null;
      return true;
    }

    const pendingProvider = pendingAuthProviderRef.current;
    let handled = false;

    // Spotify/Tidal are handled by promptAsync → useEffect([response/tidalResponse]).
    // Skip them here to prevent double code exchange.
    if (pendingProvider === 'spotify' || pendingProvider === 'tidal') {
      return false;
    } else if (pendingProvider === 'lastfm') {
      handled = await completeLastfmAuth(url);
    } else {
      // No pending provider — try Last.fm as fallback
      // (Spotify/Tidal are handled by their useEffect watchers)
      handled = await completeLastfmAuth(url);
    }

    if (handled) {
      pendingAuthProviderRef.current = null;
    }

    return handled;
  }, [completeLastfmAuth, handleSoundcloudRedirect, handleAppleWebCallback]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingAuthUrl(url);
    });

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          void handleIncomingAuthUrl(url);
        }
      })
      .catch((err) => {
        console.warn('Failed to inspect initial auth URL:', err);
      });

    return () => sub.remove();
  }, [handleIncomingAuthUrl]);

  // Push notification registration is temporarily disabled for presentation-safe boots.
  // Do not re-enable this path until native Firebase credentials are configured.
  const uploadPushToken = useCallback(async () => {
    return;
  }, []);

  // Check for existing token on mount (biometric-aware)
  useEffect(() => {
    async function bootstrap() {
      if (BYPASS_AUTH) {
        const bypassUser: User = {
          id: 'user_bypass_local',
          username: 'testbot',
          email: 'testbot@freq.local',
          connectedServices: {},
          createdAt: new Date().toISOString(),
        };
        const bypassToken = 'bypass-testing-token';
        await storeToken(bypassToken);
        dispatch({ type: 'SET_USER', payload: { user: bypassUser, token: bypassToken } });
        return;
      }

      try {
        // Try biometric unlock first if the user opted in
        let token: string | null = null;
        if (bio.isEnabled && !bio.isLoading) {
          token = await bio.tryBiometricUnlock();
        }

        // Fall back to regular stored token
        if (!token) {
          token = await getStoredToken();
        }

        if (token) {
          const { user } = await authApi.me();
          await storeToken(token);
          dispatch({ type: 'SET_USER', payload: { user, token } });
          uploadPushToken();
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch {
        await clearToken();
        dispatch({ type: 'LOGOUT' });
      }
    }
    // Wait for biometric state to load before bootstrapping (run once only)
    if (!bio.isLoading && !bootstrappedRef.current) {
      bootstrappedRef.current = true;
      bootstrap();
    }
  }, [bio.isLoading]);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { token, user } = await authApi.login(email, password);
      await storeToken(token);
      dispatch({ type: 'SET_USER', payload: { user, token } });
      uploadPushToken();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Login failed' });
      throw error;
    }
  }, [uploadPushToken]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { token, user } = await authApi.register(username, email, password);
      await storeToken(token);
      dispatch({ type: 'SET_USER', payload: { user, token } });
      uploadPushToken();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Registration failed' });
      throw error;
    }
  }, [uploadPushToken]);

  const loginWithApple = useCallback(async (
    identityToken: string,
    user?: string,
    fullName?: string,
    email?: string,
  ): Promise<{ isNewUser: boolean }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { token, user: authedUser, isNewUser } = await authApi.apple(identityToken, user, fullName, email);
      await storeToken(token);
      dispatch({ type: 'SET_USER', payload: { user: authedUser, token } });
      uploadPushToken();
      return { isNewUser };
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Apple sign in failed' });
      throw error;
    }
  }, [uploadPushToken]);

  const loginWithGoogle = useCallback(async (idToken: string): Promise<{ isNewUser: boolean }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { token, user, isNewUser } = await authApi.google(idToken);
      await storeToken(token);
      dispatch({ type: 'SET_USER', payload: { user, token } });
      uploadPushToken();
      return { isNewUser };
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Google sign in failed' });
      throw error;
    }
  }, [uploadPushToken]);

  const setPassword = useCallback(async (password: string) => {
    await authApi.setPassword(password);
    // Re-fetch user so local state reflects the new password status
    if (state.token) {
      const { user } = await authApi.me();
      dispatch({ type: 'SET_USER', payload: { user, token: state.token } });
    }
  }, [state.token]);

  const logout = useCallback(async () => {
    // Wipe biometric-stored token on logout so it can't unlock a stale session
    if (bio.isEnabled) {
      await bio.disableBiometric();
    }
    await authApi.logout();
    dispatch({ type: 'LOGOUT' });
  }, [bio.isEnabled, bio.disableBiometric]);

  const deleteAccount = useCallback(async () => {
    if (bio.isEnabled) {
      await bio.disableBiometric();
    }
    await authApi.deleteAccount();
    dispatch({ type: 'LOGOUT' });
  }, [bio.isEnabled, bio.disableBiometric]);

  // ─── Auto Token Refresh ────────────────────────────────────
  // Decode JWT exp, schedule refresh 1 hour before expiry.
  // Also refresh when app returns to foreground if token is stale.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // ms
      const refreshAt = exp - 60 * 60 * 1000; // 1 hour before expiry
      const delay = refreshAt - Date.now();
      if (delay <= 0) {
        // Already within the refresh window — refresh immediately
        void performRefresh();
        return;
      }
      refreshTimerRef.current = setTimeout(performRefresh, delay);
    } catch {
      // Can't parse token — skip scheduling
    }
  }, []);

  const performRefresh = useCallback(async () => {
    try {
      const { token: newToken } = await authApi.refresh();
      const { user: freshUser } = await authApi.me();
      await storeToken(newToken);
      // Keep biometric store in sync so biometric unlock uses fresh JWT
      if (bio.isEnabled) {
        await bio.updateStoredToken(newToken);
      }
      dispatch({ type: 'SET_USER', payload: { user: freshUser, token: newToken } });
      scheduleRefresh(newToken);
    } catch {
      // Refresh failed — token may be expired, force logout
      await authApi.logout();
      dispatch({ type: 'LOGOUT' });
    }
  }, [scheduleRefresh, bio.isEnabled, bio.updateStoredToken]);

  // Schedule on login/register/bootstrap
  useEffect(() => {
    if (state.token && state.isAuthenticated) {
      scheduleRefresh(state.token);
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [state.token, state.isAuthenticated, scheduleRefresh]);

  // Refresh on foreground return if within 2 hours of expiry
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && state.token && state.isAuthenticated) {
        try {
          const payload = JSON.parse(atob(state.token.split('.')[1]));
          const exp = payload.exp * 1000;
          if (exp - Date.now() < 2 * 60 * 60 * 1000) {
            void performRefresh();
          }
        } catch { /* ignore */ }
      }
    });
    return () => sub.remove();
  }, [state.token, state.isAuthenticated, performRefresh]);

  const connectSpotify = useCallback(async () => {
    if (BYPASS_AUTH) {
      showToast('Disable auth bypass to patch Spotify.', 'info');
      return;
    }
    if (!config.SPOTIFY_CLIENT_ID) {
      showToast('Spotify client ID missing in mobile env.', 'error');
      return;
    }
    if (authDiagnostics.isExpoGo) {
      showToast(`Spotify in Expo Go may fail. Redirect: ${authDiagnostics.spotifyRedirectUri}`, 'info');
    }
    if (!request) {
      showToast('Spotify auth is still loading. Try again in a moment.', 'info');
      return;
    }
    try {
      pendingAuthProviderRef.current = 'spotify';
      const result = await promptAsync();
      if (result?.type === 'dismiss' || result?.type === 'cancel') {
        showToast('Spotify sign-in cancelled.', 'info');
        pendingAuthProviderRef.current = null;
      }
      // Success/error handled by the useEffect watching `response`
    } catch (error) {
      showToast(friendlyProviderError('Spotify', (error as Error)?.message), 'error');
      pendingAuthProviderRef.current = null;
    }
  }, [request, promptAsync, authDiagnostics]);

  const connectSoundcloud = useCallback(async () => {
    if (BYPASS_AUTH) {
      showToast('Disable auth bypass to patch SoundCloud.', 'info');
      return;
    }
    if (!state.user) return;
    const clientId = config.SOUNDCLOUD_CLIENT_ID;
    if (!clientId) {
      showToast('SoundCloud client ID missing in mobile env.', 'error');
      return;
    }
    const redirectUri = authDiagnostics.soundcloudRedirectUri;
    const sessionReturnUrl = authDiagnostics.soundcloudSessionReturnUrl;
    const stateParam = encodeURIComponent(
      JSON.stringify({
        userId: state.user.id,
        returnUrl: sessionReturnUrl,
      })
    );
    const authUrl = `https://api.soundcloud.com/connect?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${stateParam}`;

    try {
      pendingAuthProviderRef.current = 'soundcloud';
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'frequenc://');
      if (result.type === 'success' && result.url) {
        await handleIncomingAuthUrl(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        showToast('SoundCloud sign-in cancelled.', 'info');
        pendingAuthProviderRef.current = null;
      }
    } catch (error) {
      showToast(friendlyAuthError('SoundCloud', (error as Error)?.message), 'error');
      pendingAuthProviderRef.current = null;
    }
  }, [state.user, authDiagnostics, handleIncomingAuthUrl]);

  const connectTidal = useCallback(async () => {
    if (BYPASS_AUTH) {
      showToast('Disable auth bypass to patch Tidal.', 'info');
      return;
    }
    if (!config.TIDAL_CLIENT_ID) {
      showToast('Tidal client ID missing in mobile env.', 'error');
      return;
    }
    if (authDiagnostics.isExpoGo) {
      showToast(`Tidal in Expo Go may fail. Redirect: ${authDiagnostics.tidalRedirectUri}`, 'info');
    }
    if (!tidalRequest) {
      showToast('Tidal auth is still loading. Try again in a moment.', 'info');
      return;
    }
    try {
      pendingAuthProviderRef.current = 'tidal';
      const result = await promptTidalAsync();
      if (result?.type === 'dismiss' || result?.type === 'cancel') {
        showToast('Tidal sign-in cancelled.', 'info');
        pendingAuthProviderRef.current = null;
      }
      // Success/error handled by the useEffect watching `tidalResponse`
    } catch (error) {
      showToast(friendlyProviderError('Tidal', (error as Error)?.message), 'error');
      pendingAuthProviderRef.current = null;
    }
  }, [tidalRequest, promptTidalAsync, authDiagnostics]);

  const connectLastfm = useCallback(async () => {
    if (BYPASS_AUTH) {
      showToast('Disable auth bypass to patch Last.fm.', 'info');
      return;
    }
    if (!state.user) return;
    const apiKey = config.LASTFM_API_KEY;
    if (!apiKey) {
      showToast('Last.fm API key missing in mobile env.', 'error');
      return;
    }
    const redirectUri = authDiagnostics.lastfmRedirectUri;
    const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${encodeURIComponent(redirectUri)}`;

    try {
      pendingAuthProviderRef.current = 'lastfm';
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'frequenc://');
      if (result.type === 'success' && result.url) {
        await handleIncomingAuthUrl(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        showToast('Last.fm sign-in cancelled.', 'info');
        pendingAuthProviderRef.current = null;
      }
    } catch (error) {
      showToast(friendlyProviderError('Last.fm', (error as Error)?.message), 'error');
      pendingAuthProviderRef.current = null;
    }
  }, [state.user, authDiagnostics, handleIncomingAuthUrl]);

  const disconnectService = useCallback(async (provider: DisconnectableProvider) => {
    if (!state.user || !state.token) return;
    try {
      await authApi.disconnectService(provider);

      const nextConnectedServices = {
        ...state.user.connectedServices,
        [provider]: { connected: false },
      };

      dispatch({
        type: 'SET_USER',
        payload: {
          user: {
            ...state.user,
            connectedServices: nextConnectedServices,
          },
          token: state.token,
        },
      });

      showToast(`${providerLabel[provider]} unpatched`, 'success');
    } catch (error) {
      showToast(`Failed to unpatch ${providerLabel[provider]}. Try again.`, 'error');
      throw error;
    }
  }, [state.user, state.token]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      register,
      loginWithApple,
      loginWithGoogle,
      setPassword,
      logout,
      deleteAccount,
      connectSpotify,
      connectSoundcloud,
      connectTidal,
      connectLastfm,
      disconnectService,
      biometric: {
        isAvailable: bio.isAvailable,
        isEnabled: bio.isEnabled,
        hasBeenOffered: bio.hasBeenOffered,
        isLoading: bio.isLoading,
        enableBiometric: bio.enableBiometric,
        disableBiometric: bio.disableBiometric,
        markOffered: bio.markOffered,
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
