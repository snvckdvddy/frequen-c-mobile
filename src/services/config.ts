/**
 * App Configuration
 *
 * Central place for environment-specific settings.
 * Flip USE_MOCKS to false once the backend is running.
 */

// ━━━ TOGGLE THIS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// true  → fake responses, no backend needed
// false → real API calls to the Node/Express server
export const USE_MOCKS = false;
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━ SET YOUR LOCAL IP HERE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Override via EXPO_PUBLIC_LOCAL_IP env var, or edit the fallback below.
// Run `ipconfig` on Windows and find your WiFi adapter's IPv4 Address.
// Both your phone and computer must be on the same WiFi network.
const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || '192.168.1.3'; // Dev fallback — update to your LAN IP if connection fails
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || '5000';
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Backend base URLs
export const API_BASE_URL = `https://freq-backend-tunnel.loca.lt/api`;

export const SOCKET_URL = `https://freq-backend-tunnel.loca.lt`;
