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
import { getAuthDiagnostics } from '../services/authDiagnostics';
import { registerForPushNotifications } from '../services/notifications';
import { showToast } from '../components/ui';

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
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  connectSpotify: () => Promise<void>;
  connectSoundcloud: () => Promise<void>;
  connectTidal: () => Promise<void>;
  connectLastfm: () => Promise<void>;
  disconnectService: (provider: DisconnectableProvider) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const providerLabel: Record<DisconnectableProvider, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  tidal: 'Tidal',
  lastfm: 'Last.fm',
};

function friendlyAuthError(service: 'SoundCloud' | 'Tidal', detail?: string) {
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
  const authDiagnostics = getAuthDiagnostics();
  const lastHandledSoundcloudUrlRef = useRef<string | null>(null);
  const lastHandledAuthUrlRef = useRef<string | null>(null);
  const pendingAuthProviderRef = useRef<PendingAuthProvider | null>(null);

  // Spotify Auth Request Setup
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: config.SPOTIFY_CLIENT_ID,
      scopes: ['user-read-email', 'user-read-private', 'playlist-read-private', 'streaming'],
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
      usePKCE: true,
      redirectUri: authDiagnostics.tidalRedirectUri,
    },
    { authorizationEndpoint: 'https://login.tidal.com/authorize', tokenEndpoint: 'https://auth.tidal.com/v1/oauth2/token' }
  );

  // Sync external adapter dependency tree with active user connectedServices
  useEffect(() => {
    setCurrentServices(state.user?.connectedServices);
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
        showToast('Spotify patch failed. Please check backend auth config.', 'error');
      });
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

  const completeSpotifyAuth = useCallback(async (url: string) => {
    const error = getUrlQueryParam(url, 'error');
    const errorDescription = getUrlQueryParam(url, 'error_description');
    if (error) {
      showToast(friendlyProviderError('Spotify', errorDescription || error), 'error');
      return true;
    }

    const code = getUrlQueryParam(url, 'code');
    const returnedState = getUrlQueryParam(url, 'state');
    if (!code) return false;
    if (!request?.state || returnedState !== request.state) {
      showToast(friendlyProviderError('Spotify', 'state mismatch'), 'error');
      return true;
    }
    if (!request.codeVerifier || !request.redirectUri || !state.token) {
      showToast('Spotify auth state expired. Start the patch flow again.', 'error');
      return true;
    }

    try {
      await authApi.connectSpotify(code, request.codeVerifier, request.redirectUri);
      const { user } = await authApi.me();
      dispatch({ type: 'SET_USER', payload: { user, token: state.token } });
      showToast('Spotify patched', 'success');
    } catch (err) {
      const detail = extractProviderErrorDetail(err);
      console.error('Failed to connect Spotify on backend:', detail || err);
      showToast(friendlyProviderError('Spotify', detail), 'error');
    }
    return true;
  }, [request, state.token]);

  const completeTidalAuth = useCallback(async (url: string) => {
    const error = getUrlQueryParam(url, 'error');
    const errorDescription = getUrlQueryParam(url, 'error_description');
    if (error) {
      showToast(friendlyProviderError('Tidal', errorDescription || error), 'error');
      return true;
    }

    const code = getUrlQueryParam(url, 'code');
    const returnedState = getUrlQueryParam(url, 'state');
    if (!code) return false;
    if (!tidalRequest?.state || returnedState !== tidalRequest.state) {
      showToast(friendlyProviderError('Tidal', 'state mismatch'), 'error');
      return true;
    }
    if (!tidalRequest.redirectUri || !state.token) {
      showToast('Tidal auth state expired. Start the patch flow again.', 'error');
      return true;
    }

    try {
      await authApi.connectTidal(code, tidalRequest.codeVerifier || '', tidalRequest.redirectUri);
      const { user } = await authApi.me();
      dispatch({ type: 'SET_USER', payload: { user, token: state.token } });
      showToast('Tidal patched', 'success');
    } catch (err) {
      const detail = extractProviderErrorDetail(err);
      console.error('Failed to connect Tidal on backend:', detail || err);
      showToast(friendlyProviderError('Tidal', detail), 'error');
    }
    return true;
  }, [tidalRequest, state.token]);

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

  const handleIncomingAuthUrl = useCallback(async (url: string) => {
    if (!url || lastHandledAuthUrlRef.current === url) return false;

    if (await handleSoundcloudRedirect(url)) {
      lastHandledAuthUrlRef.current = url;
      pendingAuthProviderRef.current = null;
      return true;
    }

    const pendingProvider = pendingAuthProviderRef.current;
    let handled = false;

    if (pendingProvider === 'spotify') {
      handled = await completeSpotifyAuth(url);
    } else if (pendingProvider === 'tidal') {
      handled = await completeTidalAuth(url);
    } else if (pendingProvider === 'lastfm') {
      handled = await completeLastfmAuth(url);
    } else {
      handled =
        (await completeSpotifyAuth(url)) ||
        (await completeTidalAuth(url)) ||
        (await completeLastfmAuth(url));
    }

    if (handled) {
      lastHandledAuthUrlRef.current = url;
      pendingAuthProviderRef.current = null;
    }

    return handled;
  }, [completeLastfmAuth, completeSpotifyAuth, completeTidalAuth, handleSoundcloudRedirect]);

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

  // Upload push token to backend after authentication
  const uploadPushToken = useCallback(async () => {
    try {
      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        await authApi.registerPushToken(pushToken);
        console.log('[Auth] Push token registered with backend');
      }
    } catch (err) {
      console.warn('[Auth] Failed to register push token:', err);
    }
  }, []);

  // Check for existing token on mount
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
        const token = await getStoredToken();
        if (token) {
          const { user } = await authApi.me();
          dispatch({ type: 'SET_USER', payload: { user, token } });
          // Register push token in the background
          uploadPushToken();
        } else {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch {
        await clearToken();
        dispatch({ type: 'LOGOUT' });
      }
    }
    bootstrap();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { token, user } = await authApi.login(email, password);
      await storeToken(token);
      dispatch({ type: 'SET_USER', payload: { user, token } });
      uploadPushToken();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
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
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      throw error;
    }
  }, [uploadPushToken]);

  const logout = useCallback(async () => {
    await authApi.logout();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount();
    dispatch({ type: 'LOGOUT' });
  }, []);

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
        performRefresh();
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
      await storeToken(newToken);
      dispatch({ type: 'SET_USER', payload: { user: state.user!, token: newToken } });
      scheduleRefresh(newToken);
    } catch {
      // Refresh failed — token may be expired, force logout
      await authApi.logout();
      dispatch({ type: 'LOGOUT' });
    }
  }, [state.user, scheduleRefresh]);

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
            performRefresh();
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
    // 🔧 DEBUG — copy this URI into Spotify Developer Dashboard → Redirect URIs
    console.log('[Auth] Spotify redirectUri:', request?.redirectUri);
    console.log('[Auth] Auth runtime:', authDiagnostics.appOwnership);
    try {
      pendingAuthProviderRef.current = 'spotify';
      const authUrl = request.url || await request.makeAuthUrlAsync(discovery);
      showToast('Complete Spotify sign-in in the browser. You can switch to Duo/Auth apps and return when finished.', 'info');
      await Linking.openURL(authUrl);
    } catch (error) {
      showToast(friendlyProviderError('Spotify', (error as Error)?.message), 'error');
      throw error;
    }
  }, [request, authDiagnostics]);

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
    // 🔧 DEBUG — register this exact URI in SoundCloud Developer App → Redirect URI
    console.log('[Auth] SoundCloud redirectUri:', redirectUri);
    const sessionReturnUrl = authDiagnostics.soundcloudSessionReturnUrl;
    console.log('[Auth] SoundCloud sessionReturnUrl:', sessionReturnUrl);
    const stateParam = encodeURIComponent(
      JSON.stringify({
        userId: state.user.id,
        returnUrl: sessionReturnUrl,
      })
    );
    const authUrl = `https://api.soundcloud.com/connect?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${stateParam}`;

    try {
      pendingAuthProviderRef.current = 'soundcloud';
      showToast('Complete SoundCloud sign-in in the browser. You can switch to Duo/Auth apps and return when finished.', 'info');
      await Linking.openURL(authUrl);
    } catch (error) {
      showToast(friendlyAuthError('SoundCloud', (error as Error)?.message), 'error');
    }
  }, [state.user, authDiagnostics]);

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
    // 🔧 DEBUG — copy this URI into Tidal Developer Portal → Redirect URIs
    console.log('[Auth] Tidal redirectUri:', tidalRequest?.redirectUri);
    console.log('[Auth] Auth runtime:', authDiagnostics.appOwnership);
    try {
      pendingAuthProviderRef.current = 'tidal';
      const authUrl = tidalRequest.url || await tidalRequest.makeAuthUrlAsync(tidalDiscovery);
      showToast('Complete Tidal sign-in in the browser. You can switch to Duo/Auth apps and return when finished.', 'info');
      await Linking.openURL(authUrl);
    } catch (error) {
      showToast(friendlyProviderError('Tidal', (error as Error)?.message), 'error');
      throw error;
    }
  }, [tidalRequest, authDiagnostics]);

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
    // 🔧 DEBUG — Last.fm callback URI (no portal registration needed, but good to verify)
    console.log('[Auth] Last.fm redirectUri:', redirectUri);
    const authUrl = `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=${encodeURIComponent(redirectUri)}`;

    try {
      pendingAuthProviderRef.current = 'lastfm';
      showToast('Complete Last.fm sign-in in the browser and return to the app when finished.', 'info');
      await Linking.openURL(authUrl);
    } catch (error) {
      showToast(friendlyProviderError('Last.fm', (error as Error)?.message), 'error');
    }
  }, [state.user, state.token, authDiagnostics]);

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
    <AuthContext.Provider value={{ ...state, login, register, logout, deleteAccount, connectSpotify, connectSoundcloud, connectTidal, connectLastfm, disconnectService }}>
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
