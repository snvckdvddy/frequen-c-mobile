/**
 * Environment Variable Helpers
 *
 * Shared utilities for reading EXPO_PUBLIC_* env vars with consistent
 * trim-and-empty-string semantics. Keep this tiny and dependency-free —
 * it's imported from both src/config.ts (legacy OAuth client IDs) and
 * src/services/config.ts (active backend routing).
 */

/**
 * Trims a raw env var value and returns `undefined` if it's empty or missing.
 * Use this to let `||` fallbacks work naturally: `readEnv(process.env.X) || 'default'`.
 */
export const readEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};
