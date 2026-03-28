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

  // ─── Google Sign In ─────────────────────────────────────
  GOOGLE_WEB_CLIENT_ID: readEnv(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) || '',
  GOOGLE_IOS_CLIENT_ID: readEnv(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) || '',

  // ─── Legacy compatibility only ────────────────────────────
  // Use src/services/config.ts for active backend routing.
  LOCAL_IP: readEnv(process.env.EXPO_PUBLIC_LOCAL_IP) || '127.0.0.1',
  API_PORT: readEnv(process.env.EXPO_PUBLIC_API_PORT) || '5000',

  get API_BASE_URL() {
    return `http://${this.LOCAL_IP}:${this.API_PORT}/api`;
  },
} as const;
