/**
 * Structured logger for Frequen-C Mobile
 * ─────────────────────────────────────────────────────────────
 * Thin wrapper over console that adds:
 *   • Log levels (debug / info / warn / error)
 *   • Tagged prefix for quick grep-ability
 *   • Production stripping: debug() is a no-op in production builds
 *
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.debug('socket', 'Reconnecting', { attempt: 3 });
 *   logger.warn('playback', 'Track had no preview URL');
 */

const IS_DEV = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function format(level: LogLevel, tag: string, message: string): string {
  return `[${level.toUpperCase()}][${tag}] ${message}`;
}

export const logger = {
  /** Development-only. Stripped in production builds. */
  debug(tag: string, message: string, ...data: unknown[]): void {
    if (!IS_DEV) return;
    console.log(format('debug', tag, message), ...data);
  },

  info(tag: string, message: string, ...data: unknown[]): void {
    console.log(format('info', tag, message), ...data);
  },

  warn(tag: string, message: string, ...data: unknown[]): void {
    console.warn(format('warn', tag, message), ...data);
  },

  error(tag: string, message: string, ...data: unknown[]): void {
    console.error(format('error', tag, message), ...data);
  },
};
