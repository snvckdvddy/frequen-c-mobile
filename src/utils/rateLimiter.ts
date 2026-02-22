/**
 * Rate Limiter — Client-side throttle for socket emissions.
 *
 * Prevents spam by enforcing minimum intervals between actions.
 * Each action type has its own cooldown timer.
 *
 * Usage:
 *   const limiter = createRateLimiter();
 *   if (limiter.canDo('chat')) { sendMessage(...); }
 */

interface RateLimiterConfig {
  /** Minimum ms between actions of each type */
  [actionType: string]: number;
}

const DEFAULT_LIMITS: RateLimiterConfig = {
  chat: 500,          // 1 message per 500ms
  reaction: 300,      // 1 reaction per 300ms
  vote: 1000,         // 1 vote per second
  addTrack: 2000,     // 1 track add per 2s
  skip: 1500,         // 1 skip per 1.5s (replaces existing cooldown)
  cvSpend: 3000,      // 1 CV spend per 3s
  duelVote: 5000,     // 1 duel vote per 5s (should only vote once anyway)
  forecast: 5000,     // 1 forecast per 5s
};

interface RateLimiter {
  /** Check if action is allowed AND consume it (resets cooldown). Returns true if allowed. */
  canDo: (action: string) => boolean;
  /** Check if action is allowed WITHOUT consuming it. */
  peek: (action: string) => boolean;
  /** Reset a specific action's cooldown. */
  reset: (action: string) => void;
  /** Reset all cooldowns. */
  resetAll: () => void;
}

export function createRateLimiter(overrides: Partial<RateLimiterConfig> = {}): RateLimiter {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  const lastActionTime: Map<string, number> = new Map();

  function peek(action: string): boolean {
    const limit = limits[action] ?? 500; // Default 500ms if unknown
    const last = lastActionTime.get(action) ?? 0;
    return Date.now() - last >= limit;
  }

  function canDo(action: string): boolean {
    if (!peek(action)) return false;
    lastActionTime.set(action, Date.now());
    return true;
  }

  function reset(action: string) {
    lastActionTime.delete(action);
  }

  function resetAll() {
    lastActionTime.clear();
  }

  return { canDo, peek, reset, resetAll };
}

// ─── Singleton for app-wide rate limiting ─────────────────────
let _globalLimiter: RateLimiter | null = null;

export function getGlobalLimiter(): RateLimiter {
  if (!_globalLimiter) {
    _globalLimiter = createRateLimiter();
  }
  return _globalLimiter;
}

// ─── Chat Input Validation ────────────────────────────────────

export const CHAT_MAX_LENGTH = 500;

/** Sanitize and validate a chat message. Returns null if invalid. */
export function validateChatMessage(text: string): string | null {
  // Trim whitespace
  const trimmed = text.trim();

  // Reject empty
  if (!trimmed) return null;

  // Enforce max length
  if (trimmed.length > CHAT_MAX_LENGTH) return null;

  // Strip any HTML tags (basic XSS prevention — server should also validate)
  const sanitized = trimmed.replace(/<[^>]*>/g, '');

  // Reject if sanitization emptied the string
  if (!sanitized.trim()) return null;

  return sanitized;
}
