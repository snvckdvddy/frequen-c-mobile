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

// Backend base URLs — __DEV__ is set by Metro bundler
export const API_BASE_URL = __DEV__
  ? `http://${LOCAL_IP}:5000/api`   // Physical device → host machine over WiFi
  : 'https://api.frequen-c.app/api';

export const SOCKET_URL = __DEV__
  ? `http://${LOCAL_IP}:5000`       // Physical device → host machine over WiFi
  : 'https://api.frequen-c.app';
