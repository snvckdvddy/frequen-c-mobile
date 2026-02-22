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
// Run `ipconfig` on Windows and find your WiFi adapter's IPv4 Address.
// Both your phone and computer must be on the same WiFi network.
// Example: '192.168.1.42'
const LOCAL_IP = '192.168.1.254'; // Caleb's Ethernet adapter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Backend base URLs — Hardcoded to local IP for testing APKs
export const API_BASE_URL = `http://${LOCAL_IP}:5000/api`;

export const SOCKET_URL = `http://${LOCAL_IP}:5000`;
