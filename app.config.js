const IS_PRODUCTION = process.env.APP_ENV === 'production';
const IS_PREVIEW = process.env.APP_ENV === 'preview';

// Allow cleartext only for local development builds.
// Preview and production builds should use HTTPS-hosted backends.
const allowCleartextTraffic = !IS_PRODUCTION && !IS_PREVIEW;

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []).filter((plugin) => {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      return name !== 'expo-build-properties';
    }),
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: allowCleartextTraffic,
        },
      },
    ],
  ],
});
