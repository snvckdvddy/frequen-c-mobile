/**
 * Session recovery for cold start and token refresh.
 *
 * Decision logic with no React or native imports, so AuthContext stays a thin
 * wiring layer and the rules can be unit tested. One rule applies everywhere:
 * only the server saying the session is over (isSessionEndingError: 401, or 404
 * for a deleted account) ends it. Timeouts, network failures, 5xx, and 429 keep
 * it and retry.
 *
 * Cold start, after the first me() call fails:
 *   401 or 404                   -> rejected: wipe credentials, show login.
 *   token's exp already passed   -> rejected, same as above. The server cannot
 *                                   answer, but the local clock can: a token past
 *                                   its exp is dead and would only get a 401 later.
 *   transient, cached user       -> resume-cached: signed in on the cached user;
 *                                   the caller keeps verifying in the background.
 *                                   A cached user whose id differs from the token's
 *                                   userId is ignored, as if there were no cache.
 *   transient, no cached user    -> retry with backoff while the splash stays up
 *                                   (about 30s), then gave-up: show login but leave
 *                                   the stored token alone so the next launch retries.
 *
 * Token refresh (resolveRefresh): a result that lands after the session ended
 * (logout, rejection, unmount) is discarded, so it can neither sign the user
 * back in nor wipe a newer session.
 */

import type { User } from '../types';
import { isSessionEndingError } from './authErrors';
import { cachedUserMatchesToken, decodeTokenClaims, isTokenExpired } from './authToken';

// ─── Schedules ──────────────────────────────────────────────

/** Background verification of a cached-user session: 5s, 15s, 45s, then UNVERIFIED_RECHECK_INTERVAL_MS. */
export const BACKGROUND_RETRY_DELAYS_MS: readonly number[] = [5_000, 15_000, 45_000];

/** One immediate attempt: the app returned to the foreground, or the slow recheck fired, while the session is still unverified. */
export const FOREGROUND_RETRY_DELAYS_MS: readonly number[] = [0];

/** Once the quick checks are used up, an unverified session is checked again this often while the app is in the foreground. */
export const UNVERIFIED_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Cold start with no cached user: backoff while the loading screen stays up. */
export const BLOCKING_RETRY_DELAYS_MS: readonly number[] = [2_000, 4_000, 8_000, 16_000];

/** Wall-clock cap for the blocking phase, measured from the first me() attempt. */
export const BLOCKING_BUDGET_MS = 30_000;

/** A token refresh that failed transiently is tried again after this long. */
export const REFRESH_RETRY_DELAY_MS = 5 * 60 * 1000;

// ─── Plans ──────────────────────────────────────────────────

export type BootstrapFailurePlan =
  | { kind: 'reject' }
  | { kind: 'resume-cached'; user: User }
  | { kind: 'retry-blocking' };

/**
 * What to do after the first cold-start me() call failed. `token` is the stored
 * JWT and `nowMs` the current time in epoch ms; both feed the local checks that
 * stand in for the server while it is not answering.
 */
export function planBootstrapFailure(
  err: unknown,
  cachedUser: User | null,
  token: string,
  nowMs: number,
): BootstrapFailurePlan {
  if (isSessionEndingError(err)) return { kind: 'reject' };

  // An undecodable token, or one with no exp, leaves claims empty and changes nothing here.
  const claims = decodeTokenClaims(token);
  if (isTokenExpired(claims, nowMs)) return { kind: 'reject' };

  // A cache that belongs to another account is as good as no cache.
  if (cachedUser && cachedUserMatchesToken(cachedUser.id, claims)) {
    return { kind: 'resume-cached', user: cachedUser };
  }
  return { kind: 'retry-blocking' };
}

export type RefreshFailurePlan =
  | { kind: 'sign-out' }
  | { kind: 'retry-later'; delayMs: number };

/** What to do after refresh() or me() failed during a token refresh. */
export function planRefreshFailure(err: unknown): RefreshFailurePlan {
  if (isSessionEndingError(err)) return { kind: 'sign-out' };
  return { kind: 'retry-later', delayMs: REFRESH_RETRY_DELAY_MS };
}

// ─── Retry loop ─────────────────────────────────────────────

export interface RetryHooks {
  /** Wait for `ms`. Must resolve early (not reject) when the work is cancelled. */
  sleep: (ms: number) => Promise<void>;
  /** True once the caller no longer wants a result (logout, unmount). */
  isCancelled: () => boolean;
  /** Clock, injectable for tests. Defaults to Date.now. */
  now?: () => number;
}

export interface RetryOptions<T> extends RetryHooks {
  attempt: () => Promise<T>;
  /** Wait before each retry, in order. The loop ends when these run out. */
  delaysMs: readonly number[];
  /** Stop instead of starting a wait that would end past this many ms after startedAt. */
  budgetMs?: number;
  /** When the budget clock started. Defaults to the moment retryTransient is called. */
  startedAt?: number;
}

export type RetryOutcome<T> =
  | { kind: 'success'; value: T }
  /** The server answered 401 or 404: the session is over. */
  | { kind: 'rejected'; error: unknown }
  /** Every wait was used and the attempts kept failing transiently. `error` is the last one, if any attempt ran. */
  | { kind: 'exhausted'; error: unknown }
  | { kind: 'cancelled' };

/**
 * Call `attempt` after each wait until it succeeds, is rejected (401 or 404,
 * see isSessionEndingError), runs out of waits or budget, or is cancelled. A
 * result that arrives after cancellation is discarded. `attempt` is meant to be
 * the me() call: a 404 from any other endpoint would not mean the session ended.
 */
export async function retryTransient<T>(opts: RetryOptions<T>): Promise<RetryOutcome<T>> {
  const now = opts.now ?? Date.now;
  const startedAt = opts.startedAt ?? now();
  let lastError: unknown;

  for (const delayMs of opts.delaysMs) {
    if (opts.budgetMs !== undefined && now() - startedAt + delayMs > opts.budgetMs) break;

    await opts.sleep(delayMs);
    if (opts.isCancelled()) return { kind: 'cancelled' };

    try {
      const value = await opts.attempt();
      return opts.isCancelled() ? { kind: 'cancelled' } : { kind: 'success', value };
    } catch (err) {
      if (opts.isCancelled()) return { kind: 'cancelled' };
      if (isSessionEndingError(err)) return { kind: 'rejected', error: err };
      lastError = err;
    }
  }

  return { kind: 'exhausted', error: lastError };
}

/**
 * Owns the cancellation for a group of retry loops. begin() hands each loop a
 * predicate that flips after cancel(); sleep() is a timer that cancel() cuts
 * short, so a cancelled loop wakes up and exits instead of waiting out its
 * delay. The same scope can be reused after cancel().
 */
export class RetryScope {
  private generation = 0;
  private readonly sleepers = new Map<ReturnType<typeof setTimeout>, () => void>();

  begin(): () => boolean {
    const generation = this.generation;
    return () => generation !== this.generation;
  }

  readonly sleep = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.sleepers.delete(timer);
        resolve();
      }, ms);
      this.sleepers.set(timer, resolve);
    });

  cancel(): void {
    this.generation += 1;
    this.sleepers.forEach((wake, timer) => {
      clearTimeout(timer);
      wake();
    });
    this.sleepers.clear();
  }
}

// ─── Cold start ─────────────────────────────────────────────

export type BootstrapResolution =
  /** me() worked, on the first call or during the blocking retries. */
  | { kind: 'verified'; user: User }
  /** The server answered 401 or 404, or the token is past its exp. Wipe credentials. */
  | { kind: 'rejected' }
  /** Backend unreachable but a cached user for this token's account exists: sign in on it and verify in the background. */
  | { kind: 'resume-cached'; user: User }
  /** Still unreachable after the blocking budget and nothing usable cached. Do not touch the stored token. */
  | { kind: 'gave-up' }
  | { kind: 'cancelled' };

export interface BootstrapOptions extends RetryHooks {
  /** The stored JWT this cold start is running with. */
  token: string;
  fetchMe: () => Promise<{ user: User }>;
  readCachedUser: () => Promise<User | null>;
}

/** Decide how a cold start ends once a stored token has been found. */
export async function resolveBootstrap(opts: BootstrapOptions): Promise<BootstrapResolution> {
  const now = opts.now ?? Date.now;
  const startedAt = now();

  let firstError: unknown;
  try {
    const { user } = await opts.fetchMe();
    return opts.isCancelled() ? { kind: 'cancelled' } : { kind: 'verified', user };
  } catch (err) {
    firstError = err;
  }
  if (opts.isCancelled()) return { kind: 'cancelled' };

  const plan = planBootstrapFailure(firstError, await opts.readCachedUser(), opts.token, now());
  if (plan.kind === 'reject') return { kind: 'rejected' };
  if (plan.kind === 'resume-cached') return { kind: 'resume-cached', user: plan.user };

  const outcome = await retryTransient({
    attempt: opts.fetchMe,
    delaysMs: BLOCKING_RETRY_DELAYS_MS,
    budgetMs: BLOCKING_BUDGET_MS,
    startedAt,
    sleep: opts.sleep,
    isCancelled: opts.isCancelled,
    now: opts.now,
  });

  switch (outcome.kind) {
    case 'success':
      return { kind: 'verified', user: outcome.value.user };
    case 'rejected':
      return { kind: 'rejected' };
    case 'exhausted':
      return { kind: 'gave-up' };
    case 'cancelled':
      return { kind: 'cancelled' };
  }
}

// ─── Token refresh ──────────────────────────────────────────

export type RefreshResolution =
  /** refresh() and me() both worked and the session that asked is still the live one. Store the token and user. */
  | { kind: 'refreshed'; token: string; user: User }
  /** The session ended (logout, rejection, unmount) while the requests were in flight. Discard the result. */
  | { kind: 'cancelled' }
  | RefreshFailurePlan;

export interface RefreshOptions {
  refresh: () => Promise<{ token: string }>;
  fetchMe: () => Promise<{ user: User }>;
  /**
   * True once the session that started this refresh is over. Checked after the
   * requests settle, on success and on failure, so a stale result can neither
   * sign a logged-out user back in nor wipe the session that replaced it.
   */
  isCancelled: () => boolean;
}

/** Run a token refresh and decide what the caller should do with the outcome. */
export async function resolveRefresh(opts: RefreshOptions): Promise<RefreshResolution> {
  if (opts.isCancelled()) return { kind: 'cancelled' };
  try {
    const { token } = await opts.refresh();
    if (opts.isCancelled()) return { kind: 'cancelled' };
    const { user } = await opts.fetchMe();
    return opts.isCancelled() ? { kind: 'cancelled' } : { kind: 'refreshed', token, user };
  } catch (err) {
    return opts.isCancelled() ? { kind: 'cancelled' } : planRefreshFailure(err);
  }
}
