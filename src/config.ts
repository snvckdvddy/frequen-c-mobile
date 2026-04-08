/**
 * Frequen-C — Centralized App Configuration
 *
 * Reads from EXPO_PUBLIC_* env vars.
 * Public client IDs are safe to commit, but they should still come from env so
 * provider setup stays explicit and does not silently drift from dashboard config.
 * Secrets (client_secret) live server-side only.
 */

const readEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const config = {
  // ─── Spotify ───────────────────────────────────────────────
  SPOTIFY_CLIENT_ID: readEnv(process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID) || '',

  // ─── Last.fm ───────────────────────────────────────────────
  LASTFM_API_KEY: readEnv(process.env.EXPO_PUBLIC_LASTFM_API_KEY) || '',

  // ─── Tidal ────────────────────────────────────────────────
  TIDAL_CLIENT_ID: readEnv(process.env.EXPO_PUBLIC_TIDAL_CLIENT_ID) || '',

  // ─── SoundCloud ───────────────────────────────────────────
  SOUNDCLOUD_CLIENT_ID: readEnv(process.env.EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID) || '',

  // ─── Apple Sign In (web flow for Android) ─────────────────
  APPLE_SERVICE_ID: readEnv(process.env.EXPO_PUBLIC_APPLE_SERVICE_ID) || '',

  // ─── Google Sign In ─────────────────────────────────────
  GOOGLE_WEB_CLIENT_ID: readEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) || '',
  GOOGLE_IOS_CLIENT_ID: readEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) || '',
} as const;

// ─── Backend routing note ────────────────────────────────
// For the backend base URL (API_BASE_URL / SOCKET_URL), import from
// 'src/services/config.ts' which correctly reads EXPO_PUBLIC_API_BASE_URL
// with Railway production fallback. Do NOT add a URL getter to `config`
// above — that was removed because it hardcoded a 127.0.0.1 default and
// silently broke Apple Music Connect in production builds.
