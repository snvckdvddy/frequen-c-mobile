/**
 * Auth Context
 *
 * Manages authentication state globally.
 * On mount, checks for stored token and auto-authenticates.
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { authApi, storeToken, clearToken, getStoredToken, setCurrentServices } from '../services/api';
import type { User, AuthState } from '../types';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest, ResponseType } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

// Spotify Discovery
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
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
  connectSpotify: () => Promise<void>;
  connectSoundcloud: () => Promise<void>;
  connectTidal: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ───────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Spotify Auth Request Setup
  const [request, response, promptAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || 'dummy_client_id',
      scopes: ['user-read-email', 'user-read-private', 'playlist-read-private', 'streaming'],
      usePKCE: true,
      redirectUri: makeRedirectUri({
        scheme: 'frequenc'
      }),
    },
    discovery
  );

  // Tidal Auth Request Setup
  const [tidalRequest, tidalResponse, promptTidalAsync] = useAuthRequest(
    {
      responseType: ResponseType.Code,
      clientId: 'zvU13xkVZYA7JNR2',
      usePKCE: true,
      redirectUri: makeRedirectUri({ scheme: 'frequenc' }),
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
      }).catch(err => {
        console.error('Failed to connect Spotify on backend:', err);
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
      }).catch(err => {
        console.error('Failed to connect Tidal on backend:', err);
      });
    }
  }, [tidalResponse]);

  // Check for existing token on mount
  useEffect(() => {
    async function bootstrap() {
      try {
        const token = await getStoredToken();
        if (token) {
          const { user } = await authApi.me();
          dispatch({ type: 'SET_USER', payload: { user, token } });
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
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      throw error;
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { token, user } = await authApi.register(username, email, password);
      await storeToken(token);
      dispatch({ type: 'SET_USER', payload: { user, token } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const connectSpotify = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  const connectSoundcloud = useCallback(async () => {
    if (!state.user) return;
    const clientId = 'A6P1OlzNLYo7LrMcTA2TaGWVzM6RHgbw';
    const redirectUri = 'http://localhost:5000/api/auth/soundcloud/callback';
    const stateParam = state.user.id;
    const authUrl = `https://api.soundcloud.com/connect?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${stateParam}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, makeRedirectUri({ scheme: 'frequenc' }));
    if (result.type === 'success') {
      const { user } = await authApi.me();
      dispatch({ type: 'SET_USER', payload: { user, token: state.token! } });
    }
  }, [state.user, state.token]);

  const connectTidal = useCallback(async () => {
    await promptTidalAsync();
  }, [promptTidalAsync]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, connectSpotify, connectSoundcloud, connectTidal }}>
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
