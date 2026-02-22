/**
 * Frequen-C — Centralized App Configuration
 *
 * Reads from EXPO_PUBLIC_* env vars with hardcoded fallbacks.
 * Client IDs are public by design — safe to commit.
 * Secrets (client_secret) live server-side only.
 */

export const config = {
  // ─── Spotify ───────────────────────────────────────────────
  SPOTIFY_CLIENT_ID:
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ||
    '221b46468ba146ab82fb85a09a0ba6c9',

  // ─── Last.fm ───────────────────────────────────────────────
  LASTFM_API_KEY:
    process.env.EXPO_PUBLIC_LASTFM_API_KEY ||
    '4cdc4d6459ac72ee723a9d9792d2884c',

  // ─── Backend ───────────────────────────────────────────────
  LOCAL_IP: process.env.EXPO_PUBLIC_LOCAL_IP || '192.168.1.254',
  API_PORT: '5000',

  get API_BASE_URL() {
    return `http://${this.LOCAL_IP}:${this.API_PORT}/api`;
  },
} as const;
