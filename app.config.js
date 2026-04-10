// app.config.js — Dynamic Expo config
// Merges app.json with environment-aware overrides.
// EAS Build injects APP_ENV at build time via eas.json env blocks.

const { withAndroidManifest } = require('@expo/config-plugins');

const IS_PRODUCTION = process.env.APP_ENV === 'production';
const IS_PREVIEW    = process.env.APP_ENV === 'preview';

// Allow cleartext (HTTP) only in development builds.
// Preview and production builds require HTTPS.
const allowCleartextTraffic = !IS_PRODUCTION && !IS_PREVIEW;

module.exports = ({ config }) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins || []).filter(
        (p) => {
          const name = Array.isArray(p) ? p[0] : p;
          return name !== 'expo-build-properties';
        }
      ),
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: allowCleartextTraffic,
          },
        },
      ],
    ],
  };
};
