import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import { API_BASE_URL } from './config';
import {
  currentServices,
  getLastSearchDiagnosticsSnapshot,
  type SearchHudProvider,
  type SearchProviderDiagnostic,
} from './api';
import type { ConnectedServices, ServiceConnection } from '../types';

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

// ─── Full Diagnostic Bundle ───────────────────────────────────
// Paste-able support bundle combining app runtime, connected-service
// state (no secrets), last captured search diagnostic snapshot, and
// OAuth redirect URIs. Surfaced via ProfileScreen > CONFIG BUS > COPY
// DIAGNOSTICS. Safe to share: contains no access tokens, refresh tokens,
// or other secret material — only connection flags, expiry durations,
// usernames (which are user-visible elsewhere), diagnostic codes, and
// error messages (truncated to 200 chars).

const PROVIDER_LABELS: Array<[keyof ConnectedServices, string]> = [
  ['spotify', 'Spotify'],
  ['soundcloud', 'SoundCloud'],
  ['tidal', 'Tidal'],
  ['appleMusic', 'Apple Music'],
  ['lastfm', 'Last.fm'],
  ['youtube', 'YouTube'],
];

const SEARCH_PROVIDER_KEYS: SearchHudProvider[] = ['spotify', 'soundcloud', 'tidal', 'appleMusic'];

function formatExpiryDuration(expiresAt: number): string {
  const msUntilExpiry = expiresAt - Date.now();
  if (msUntilExpiry <= 0) return 'token EXPIRED';
  const secs = Math.round(msUntilExpiry / 1000);
  if (secs < 60) return `expires in ${secs}s`;
  if (secs < 3600) return `expires in ${Math.round(secs / 60)}m`;
  if (secs < 86400) return `expires in ${Math.round(secs / 3600)}h`;
  return `expires in ${Math.round(secs / 86400)}d`;
}

function formatServiceLine(label: string, service: ServiceConnection | undefined): string {
  const labelCol = label.padEnd(12);
  if (!service) return `${labelCol} —`;
  if (!service.connected) return `${labelCol} ✗ unpatched`;

  const parts: string[] = ['✓ patched'];
  if (typeof service.expiresAt === 'number') {
    parts.push(formatExpiryDuration(service.expiresAt));
  } else if (service.accessToken) {
    parts.push('token present (no expiry)');
  }
  if (service.username) parts.push(`@${service.username}`);

  return `${labelCol} ${parts.join(', ')}`;
}

function formatSearchProviderDiagnosticLine(
  key: SearchHudProvider,
  diagnostic: SearchProviderDiagnostic,
): string {
  const base = `  ${key.padEnd(12)} ${diagnostic.state.toUpperCase().padEnd(10)} ${diagnostic.code}`;
  const details: string[] = [];
  if (diagnostic.resultCount > 0) details.push(`${diagnostic.resultCount} tracks`);
  if (diagnostic.httpStatus !== null) details.push(`HTTP ${diagnostic.httpStatus}`);
  if (diagnostic.upstreamStatus !== null) details.push(`upstream ${diagnostic.upstreamStatus}`);
  if (diagnostic.message) {
    const truncated = diagnostic.message.length > 200
      ? `${diagnostic.message.slice(0, 200)}…`
      : diagnostic.message;
    details.push(`"${truncated}"`);
  }
  return details.length > 0 ? `${base} — ${details.join(', ')}` : base;
}

export function formatFullDiagnosticsText(): string {
  const auth = getAuthDiagnostics();
  const appVersion = Constants.expoConfig?.version ?? 'unknown';
  const sdkVersion = Constants.expoConfig?.sdkVersion ?? 'unknown';
  const lines: string[] = [];

  lines.push('=== FREQUEN-C DIAGNOSTIC BUNDLE ===');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('⚠ Contains runtime error details. Review before sharing publicly.');
  lines.push('');

  lines.push('--- APP RUNTIME ---');
  lines.push(`App version: ${appVersion}`);
  lines.push(`Expo SDK: ${sdkVersion}`);
  lines.push(`App ownership: ${auth.appOwnership}`);
  lines.push(`Expo Go: ${auth.isExpoGo ? 'yes' : 'no'}`);
  lines.push('');

  lines.push('--- CONNECTED SERVICES ---');
  if (!currentServices) {
    lines.push('(no services loaded — not signed in, or user state not hydrated)');
  } else {
    for (const [key, label] of PROVIDER_LABELS) {
      lines.push(formatServiceLine(label, currentServices[key]));
    }
  }
  lines.push('');

  lines.push('--- LAST SEARCH SNAPSHOT ---');
  const snapshot = getLastSearchDiagnosticsSnapshot();
  if (!snapshot) {
    lines.push('(no search has run yet this session)');
  } else {
    const capturedAgoSec = Math.round((Date.now() - snapshot.capturedAt) / 1000);
    lines.push(`Query: "${snapshot.diagnostics.query}"`);
    lines.push(`Captured: ${new Date(snapshot.capturedAt).toISOString()} (${capturedAgoSec}s ago)`);
    const requested = snapshot.diagnostics.requestedSources.join(', ') || '(none — open catalog only)';
    lines.push(`Requested sources: ${requested}`);
    lines.push('Provider states:');
    for (const key of SEARCH_PROVIDER_KEYS) {
      lines.push(formatSearchProviderDiagnosticLine(key, snapshot.diagnostics.providers[key]));
    }
    lines.push(`Direct matches: ${snapshot.diagnostics.directMatchCount}`);
    lines.push(`Open fallback: ${snapshot.diagnostics.openFallbackCount}`);
    lines.push(`Fallback used: ${snapshot.diagnostics.fallbackUsed ? 'yes' : 'no'}`);
  }
  lines.push('');

  lines.push('--- OAUTH REDIRECT URIs ---');
  lines.push(`Spotify: ${auth.spotifyRedirectUri}`);
  lines.push(`Tidal: ${auth.tidalRedirectUri}`);
  lines.push(`Last.fm: ${auth.lastfmRedirectUri}`);
  lines.push(`SoundCloud backend: ${auth.soundcloudRedirectUri}`);
  lines.push(`SoundCloud app return: ${auth.soundcloudSessionReturnUrl}`);
  lines.push(`Apple web callback: ${auth.appleWebCallbackUri}`);

  return lines.join('\n');
}
