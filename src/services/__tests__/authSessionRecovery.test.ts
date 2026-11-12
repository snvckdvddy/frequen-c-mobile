/**
 * Session recovery tests: the cold-start and token-refresh decisions that
 * AuthContext wires up.
 *
 * The rules under test: only the server saying the session is over (401, or a
 * 404 whose body is the backend's 'User not found', meaning a deleted account)
 * ends it. Timeouts, network errors, 5xx, 429, and any other 404 (such as the
 * 'Application not found' Railway's edge sends during an outage) keep it and
 * retry. While the server is not answering, a token past its exp is also
 * dead, and a cached profile for a different account is not trusted. A refresh
 * result that lands after the session ended is discarded. Everything runs
 * through injected sleep, clock, and cancel hooks, so no real timers are involved
 * except in the RetryScope block, which uses jest fake timers.
 *
 * fetchClient imports ./config (expo-device, react-native), which can't load in
 * the Node test env, so config is stubbed like the other service tests do.
 */

jest.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:5000/api',
}));

import type { User } from '../../types';
import { ApiError } from '../fetchClient';
import {
  BACKGROUND_RETRY_DELAYS_MS,
  BLOCKING_BUDGET_MS,
  BLOCKING_RETRY_DELAYS_MS,
  FOREGROUND_RETRY_DELAYS_MS,
  REFRESH_RETRY_DELAY_MS,
  RetryScope,
  UNVERIFIED_RECHECK_INTERVAL_MS,
  planBootstrapFailure,
  planRefreshFailure,
  resolveBootstrap,
  resolveRefresh,
  retryTransient,
} from '../authSessionRecovery';
import { makeToken } from './jwtFixtures';

// ─── Fixtures ───────────────────────────────────────────────

const cachedUser: User = {
  id: 'usr_1',
  username: 'cached',
  email: 'caleb@example.test',
  connectedServices: {},
  createdAt: '2026-01-01T00:00:00.000Z',
};
const freshUser: User = { ...cachedUser, username: 'fresh' };

const unauthorized = () => new ApiError(401, 'Invalid or expired token');
// The 404 the backend sends from /auth/me and /auth/refresh for a deleted account.
const accountGone = () => new ApiError(404, 'User not found', { message: 'User not found' });
// Railway's edge answers 404 when the service is misrouted or down. It says nothing about the account.
const edgeNotFound = () => new ApiError(404, 'Application not found', { message: 'Application not found' });
// A 404 with no body to check.
const bodilessNotFound = () => new ApiError(404, 'Not Found');
const timedOut = () => new ApiError(0, 'Request timed out to https://example.test/api');
const coldStart = () => new ApiError(503, 'Service Unavailable');

// A fixed "now" for the token tests. Tokens are built relative to it, and the
// harness clock can be started there so resolveBootstrap sees the same time.
const NOW_MS = Date.UTC(2026, 10, 11, 12, 0, 0);
const NOW_S = NOW_MS / 1000;

const tokenFor = (userId: string, expSeconds: number) =>
  makeToken({ userId, username: 'cached', iat: NOW_S - 86_400, exp: expSeconds });

/** Issued to the cached user, valid for another hour (relative to NOW_MS). */
const validToken = tokenFor(cachedUser.id, NOW_S + 3_600);
/**
 * Issued to the cached user, expires in 2100. For tests that run on jest's fake
 * timers: those start from the real current time, so a token that is only valid
 * relative to NOW_MS would read as expired there.
 */
const neverExpiresToken = tokenFor(cachedUser.id, Date.UTC(2100, 0, 1) / 1000);
/** Issued to the cached user, expired one second ago. */
const expiredToken = tokenFor(cachedUser.id, NOW_S - 1);
/** Valid, but issued to somebody else. */
const otherAccountToken = tokenFor('usr_other', NOW_S + 3_600);

const transientErrors: [string, unknown][] = [
  ['timeout (status 0)', timedOut()],
  ['network error (status 0)', new ApiError(0, 'Network error reaching https://example.test/api')],
  ['500', new ApiError(500, 'Internal server error')],
  ['503 cold start', coldStart()],
  ['429', new ApiError(429, 'Too many requests')],
  ['404 from the Railway edge (Application not found)', edgeNotFound()],
  ['404 with no body', bodilessNotFound()],
  ['non-ApiError', new Error('boom')],
];

/**
 * A clock plus sleep/cancel hooks the test controls. sleep() advances the clock
 * by the wait. The clock starts at 0 unless a start time is given (the token
 * tests start it at NOW_MS so exp claims can be compared against it).
 */
function makeHarness(startMs = 0) {
  let clock = startMs;
  let cancelled = false;
  const sleeps: number[] = [];
  return {
    sleeps,
    advance: (ms: number) => {
      clock += ms;
    },
    cancel: () => {
      cancelled = true;
    },
    hooks: {
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
      isCancelled: () => cancelled,
      now: () => clock,
    },
  };
}

type Step<T> = { ok: T } | { fail: unknown };

/** An async function that plays back the given results in order, repeating the last one. */
function script<T>(...steps: Step<T>[]) {
  const calls = { count: 0 };
  const fn = async (): Promise<T> => {
    const step = steps[Math.min(calls.count, steps.length - 1)];
    calls.count += 1;
    if ('fail' in step) throw step.fail;
    return step.ok;
  };
  return { fn, calls };
}

// ─── Schedules ──────────────────────────────────────────────

describe('retry schedules', () => {
  it('verifies a cached-user session at 5s, 15s, 45s', () => {
    expect([...BACKGROUND_RETRY_DELAYS_MS]).toEqual([5_000, 15_000, 45_000]);
  });

  it('verifies on app foreground with one immediate attempt', () => {
    expect([...FOREGROUND_RETRY_DELAYS_MS]).toEqual([0]);
  });

  it('keeps rechecking an unverified session every 5 minutes once the quick checks run out', () => {
    expect(UNVERIFIED_RECHECK_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(UNVERIFIED_RECHECK_INTERVAL_MS).toBeGreaterThan(Math.max(...BACKGROUND_RETRY_DELAYS_MS));
  });

  it('keeps the blocking cold-start retries inside the 30s budget', () => {
    const totalWait = BLOCKING_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
    expect(BLOCKING_BUDGET_MS).toBe(30_000);
    expect(totalWait).toBeLessThanOrEqual(BLOCKING_BUDGET_MS);
  });

  it('retries a failed token refresh in 5 minutes', () => {
    expect(REFRESH_RETRY_DELAY_MS).toBe(5 * 60 * 1000);
  });
});

// ─── Plans ──────────────────────────────────────────────────

describe('planBootstrapFailure', () => {
  const plan = (err: unknown, cached: User | null, token: string = validToken) =>
    planBootstrapFailure(err, cached, token, NOW_MS);

  it('rejects on a 401 when there is a cached user', () => {
    expect(plan(unauthorized(), cachedUser)).toEqual({ kind: 'reject' });
  });

  it('rejects on a 401 when there is no cached user', () => {
    expect(plan(unauthorized(), null)).toEqual({ kind: 'reject' });
  });

  it('rejects on a 404 with the user-not-found body (the account was deleted), with or without a cached user', () => {
    expect(plan(accountGone(), cachedUser)).toEqual({ kind: 'reject' });
    expect(plan(accountGone(), null)).toEqual({ kind: 'reject' });
  });

  it.each(transientErrors)('resumes from the cached user on a transient failure: %s', (_label, err) => {
    expect(plan(err, cachedUser)).toEqual({ kind: 'resume-cached', user: cachedUser });
  });

  it.each(transientErrors)('keeps retrying while loading when there is no cached user: %s', (_label, err) => {
    expect(plan(err, null)).toEqual({ kind: 'retry-blocking' });
  });

  describe('a token already past its exp', () => {
    it.each(transientErrors)('rejects instead of resuming the cached user: %s', (_label, err) => {
      expect(plan(err, cachedUser, expiredToken)).toEqual({ kind: 'reject' });
    });

    it.each(transientErrors)('rejects instead of retrying while loading: %s', (_label, err) => {
      expect(plan(err, null, expiredToken)).toEqual({ kind: 'reject' });
    });

    it('counts exp equal to now as expired', () => {
      const token = tokenFor(cachedUser.id, NOW_S);
      expect(plan(timedOut(), cachedUser, token)).toEqual({ kind: 'reject' });
    });

    it('still resumes when the token expires one second from now', () => {
      const token = tokenFor(cachedUser.id, NOW_S + 1);
      expect(plan(timedOut(), cachedUser, token)).toEqual({ kind: 'resume-cached', user: cachedUser });
    });

    it('rejects when the token is expired even though it names a different account', () => {
      const token = tokenFor('usr_other', NOW_S - 1);
      expect(plan(timedOut(), cachedUser, token)).toEqual({ kind: 'reject' });
    });
  });

  describe('a token that cannot be read keeps the current behavior', () => {
    const unreadable: [string, string][] = [
      ['an empty string', ''],
      ['not a JWT at all', 'mock_jwt_1700000000000'],
      ['two segments', 'header.payload'],
      ['a payload that is not base64', 'header.!!!.signature'],
      ['a payload that is not JSON', `header.${btoa('not json')}.signature`],
      ['a payload with no exp or userId', makeToken({ username: 'cached' })],
    ];

    it.each(unreadable)('resumes from the cached user: %s', (_label, token) => {
      expect(plan(timedOut(), cachedUser, token)).toEqual({ kind: 'resume-cached', user: cachedUser });
    });

    it.each(unreadable)('keeps retrying while loading with no cached user: %s', (_label, token) => {
      expect(plan(timedOut(), null, token)).toEqual({ kind: 'retry-blocking' });
    });
  });

  describe('cache identity', () => {
    it('ignores a cached user that belongs to a different account than the token', () => {
      expect(plan(timedOut(), cachedUser, otherAccountToken)).toEqual({ kind: 'retry-blocking' });
    });

    it.each(transientErrors)('treats a mismatched cache as no cache on any transient failure: %s', (_label, err) => {
      expect(plan(err, cachedUser, otherAccountToken)).toEqual({ kind: 'retry-blocking' });
    });

    it('uses the cached user when it belongs to the token account', () => {
      expect(plan(timedOut(), cachedUser, validToken)).toEqual({ kind: 'resume-cached', user: cachedUser });
    });

    it('a token with a userId but no exp still gets its cache checked', () => {
      const noExp = makeToken({ userId: 'usr_other', username: 'x' });
      expect(plan(timedOut(), cachedUser, noExp)).toEqual({ kind: 'retry-blocking' });
    });

    it('cannot contradict the cache when the token carries no userId', () => {
      const noUserId = makeToken({ username: 'cached', exp: NOW_S + 3_600 });
      expect(plan(timedOut(), cachedUser, noUserId)).toEqual({ kind: 'resume-cached', user: cachedUser });
    });

    it('a 401 is still a rejection whatever the cache says', () => {
      expect(plan(unauthorized(), cachedUser, otherAccountToken)).toEqual({ kind: 'reject' });
    });
  });
});

describe('planRefreshFailure', () => {
  it('signs out on a 401', () => {
    expect(planRefreshFailure(unauthorized())).toEqual({ kind: 'sign-out' });
  });

  it('signs out on a 404 with the user-not-found body (the account was deleted)', () => {
    expect(planRefreshFailure(accountGone())).toEqual({ kind: 'sign-out' });
  });

  it.each(transientErrors)('keeps the session and retries in 5 minutes on a transient failure: %s', (_label, err) => {
    expect(planRefreshFailure(err)).toEqual({ kind: 'retry-later', delayMs: REFRESH_RETRY_DELAY_MS });
  });
});

// ─── Retry loop ─────────────────────────────────────────────

describe('retryTransient on the background schedule', () => {
  it('succeeds on the first retry after the first wait', async () => {
    const h = makeHarness();
    const attempt = script<string>({ ok: 'user' });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: BACKGROUND_RETRY_DELAYS_MS });

    expect(outcome).toEqual({ kind: 'success', value: 'user' });
    expect(h.sleeps).toEqual([5_000]);
    expect(attempt.calls.count).toBe(1);
  });

  it('keeps retrying transient failures and picks up when the backend comes back', async () => {
    const h = makeHarness();
    const attempt = script<string>({ fail: timedOut() }, { fail: coldStart() }, { ok: 'user' });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: BACKGROUND_RETRY_DELAYS_MS });

    expect(outcome).toEqual({ kind: 'success', value: 'user' });
    expect(h.sleeps).toEqual([5_000, 15_000, 45_000]);
    expect(attempt.calls.count).toBe(3);
  });

  it('a later 401 is a rejection and stops the loop', async () => {
    const h = makeHarness();
    const attempt = script<string>({ fail: timedOut() }, { fail: unauthorized() }, { ok: 'never reached' });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: BACKGROUND_RETRY_DELAYS_MS });

    expect(outcome.kind).toBe('rejected');
    expect(h.sleeps).toEqual([5_000, 15_000]);
    expect(attempt.calls.count).toBe(2);
  });

  it('a later 404 with the user-not-found body (the account was deleted) is a rejection too and stops the loop', async () => {
    const h = makeHarness();
    const gone = accountGone();
    const attempt = script<string>({ fail: timedOut() }, { fail: gone }, { ok: 'never reached' });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: BACKGROUND_RETRY_DELAYS_MS });

    expect(outcome).toEqual({ kind: 'rejected', error: gone });
    expect(h.sleeps).toEqual([5_000, 15_000]);
    expect(attempt.calls.count).toBe(2);
  });

  it('a later 404 from the Railway edge is transient: the loop keeps retrying and picks up when the backend is back', async () => {
    const h = makeHarness();
    const attempt = script<string>({ fail: timedOut() }, { fail: edgeNotFound() }, { ok: 'user' });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: BACKGROUND_RETRY_DELAYS_MS });

    expect(outcome).toEqual({ kind: 'success', value: 'user' });
    expect(h.sleeps).toEqual([5_000, 15_000, 45_000]);
    expect(attempt.calls.count).toBe(3);
  });

  it('a 404 from the Railway edge on every attempt exhausts the waits and leaves the session alone', async () => {
    const h = makeHarness();
    const lastError = edgeNotFound();
    const attempt = script<string>({ fail: lastError });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: BACKGROUND_RETRY_DELAYS_MS });

    expect(outcome).toEqual({ kind: 'exhausted', error: lastError });
    expect(h.sleeps).toEqual([5_000, 15_000, 45_000]);
    expect(attempt.calls.count).toBe(3);
  });

  it('uses every wait, then gives up and leaves the session alone', async () => {
    const h = makeHarness();
    const lastError = new ApiError(502, 'Bad Gateway');
    const attempt = script<string>({ fail: timedOut() }, { fail: coldStart() }, { fail: lastError });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: BACKGROUND_RETRY_DELAYS_MS });

    expect(outcome).toEqual({ kind: 'exhausted', error: lastError });
    expect(h.sleeps).toEqual([5_000, 15_000, 45_000]);
    expect(attempt.calls.count).toBe(3);
  });

  it('a foreground check is one immediate attempt', async () => {
    const h = makeHarness();
    const attempt = script<string>({ fail: timedOut() });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: FOREGROUND_RETRY_DELAYS_MS });

    expect(outcome.kind).toBe('exhausted');
    expect(h.sleeps).toEqual([0]);
    expect(attempt.calls.count).toBe(1);
  });

  it('makes no attempt when there are no waits', async () => {
    const h = makeHarness();
    const attempt = script<string>({ ok: 'user' });

    const outcome = await retryTransient({ ...h.hooks, attempt: attempt.fn, delaysMs: [] });

    expect(outcome).toEqual({ kind: 'exhausted', error: undefined });
    expect(attempt.calls.count).toBe(0);
  });
});

describe('retryTransient cancellation and budget', () => {
  it('stops when cancelled during a wait, without another attempt', async () => {
    const h = makeHarness();
    const attempt = script<string>({ ok: 'user' });
    const sleepThenCancel = async (ms: number) => {
      h.sleeps.push(ms);
      h.cancel();
    };

    const outcome = await retryTransient({
      ...h.hooks,
      sleep: sleepThenCancel,
      attempt: attempt.fn,
      delaysMs: BACKGROUND_RETRY_DELAYS_MS,
    });

    expect(outcome).toEqual({ kind: 'cancelled' });
    expect(attempt.calls.count).toBe(0);
  });

  it('discards a success that lands after cancellation', async () => {
    const h = makeHarness();

    const outcome = await retryTransient({
      ...h.hooks,
      attempt: async () => {
        h.cancel();
        return 'late';
      },
      delaysMs: BACKGROUND_RETRY_DELAYS_MS,
    });

    expect(outcome).toEqual({ kind: 'cancelled' });
  });

  it('does not report a 401 that lands after cancellation (a logged-out user is not wiped twice)', async () => {
    const h = makeHarness();

    const outcome = await retryTransient({
      ...h.hooks,
      attempt: async () => {
        h.cancel();
        throw unauthorized();
      },
      delaysMs: BACKGROUND_RETRY_DELAYS_MS,
    });

    expect(outcome).toEqual({ kind: 'cancelled' });
  });

  it('refuses to start a wait that would end past the budget', async () => {
    const h = makeHarness();
    // The first me() call timed out after 10s, then each retry times out after 10s too.
    h.advance(10_000);
    const attempt = async () => {
      h.advance(10_000);
      throw timedOut();
    };

    const outcome = await retryTransient({
      ...h.hooks,
      attempt,
      delaysMs: BLOCKING_RETRY_DELAYS_MS,
      budgetMs: BLOCKING_BUDGET_MS,
      startedAt: 0,
    });

    // 10s + 2s wait + 10s attempt = 22s; 22s + 4s wait fits; 36s + 8s does not.
    expect(outcome.kind).toBe('exhausted');
    expect(h.sleeps).toEqual([2_000, 4_000]);
  });
});

// ─── Cold start ─────────────────────────────────────────────

describe('resolveBootstrap', () => {
  function run(
    h: ReturnType<typeof makeHarness>,
    fetchMe: () => Promise<{ user: User }>,
    cached: User | null,
    token: string = validToken,
  ) {
    const readCachedUser = jest.fn(async () => cached);
    const resolution = resolveBootstrap({ ...h.hooks, token, fetchMe, readCachedUser });
    return { resolution, readCachedUser };
  }

  it('is verified when me() works the first time, with no waiting', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ ok: { user: freshUser } });

    const { resolution } = run(h, me.fn, cachedUser);

    await expect(resolution).resolves.toEqual({ kind: 'verified', user: freshUser });
    expect(h.sleeps).toEqual([]);
    expect(me.calls.count).toBe(1);
  });

  it('rejects on a 401 and never retries, even with a cached user', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: unauthorized() });

    const { resolution } = run(h, me.fn, cachedUser);

    await expect(resolution).resolves.toEqual({ kind: 'rejected' });
    expect(h.sleeps).toEqual([]);
    expect(me.calls.count).toBe(1);
  });

  it('rejects on a 404 with the user-not-found body (the account was deleted) and never retries, even with a cached user', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: accountGone() });

    const { resolution } = run(h, me.fn, cachedUser);

    await expect(resolution).resolves.toEqual({ kind: 'rejected' });
    expect(h.sleeps).toEqual([]);
    expect(me.calls.count).toBe(1);
  });

  it.each(transientErrors)(
    'resumes from the cached user on a transient failure, without blocking on retries: %s',
    async (_label, err) => {
      const h = makeHarness();
      const me = script<{ user: User }>({ fail: err });

      const { resolution } = run(h, me.fn, cachedUser);

      await expect(resolution).resolves.toEqual({ kind: 'resume-cached', user: cachedUser });
      expect(h.sleeps).toEqual([]);
      expect(me.calls.count).toBe(1);
    },
  );

  it('without a cached user, retries while loading and verifies once the backend answers', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: timedOut() }, { fail: coldStart() }, { ok: { user: freshUser } });

    const { resolution } = run(h, me.fn, null);

    await expect(resolution).resolves.toEqual({ kind: 'verified', user: freshUser });
    expect(h.sleeps).toEqual([2_000, 4_000]);
    expect(me.calls.count).toBe(3);
  });

  it('without a cached user, a 401 during the retries is a rejection', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: coldStart() }, { fail: unauthorized() });

    const { resolution } = run(h, me.fn, null);

    await expect(resolution).resolves.toEqual({ kind: 'rejected' });
    expect(me.calls.count).toBe(2);
  });

  it('without a cached user, a 404 with the user-not-found body during the retries is a rejection', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: coldStart() }, { fail: accountGone() });

    const { resolution } = run(h, me.fn, null);

    await expect(resolution).resolves.toEqual({ kind: 'rejected' });
    expect(me.calls.count).toBe(2);
  });

  it('without a cached user, a Railway-edge 404 (first call and retries) is transient: keeps retrying until the backend is back', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: edgeNotFound() }, { fail: edgeNotFound() }, { ok: { user: freshUser } });

    const { resolution } = run(h, me.fn, null);

    await expect(resolution).resolves.toEqual({ kind: 'verified', user: freshUser });
    expect(h.sleeps).toEqual([2_000, 4_000]);
    expect(me.calls.count).toBe(3);
  });

  it('without a cached user, gives up without rejecting when the Railway edge keeps answering 404', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: edgeNotFound() });

    const { resolution } = run(h, me.fn, null);

    await expect(resolution).resolves.toEqual({ kind: 'gave-up' });
    expect(h.sleeps).toEqual([2_000, 4_000, 8_000, 16_000]);
    expect(me.calls.count).toBe(5);
  });

  it('without a cached user, gives up after the full schedule when failures are instant', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: new ApiError(0, 'Network error') });

    const { resolution } = run(h, me.fn, null);

    await expect(resolution).resolves.toEqual({ kind: 'gave-up' });
    expect(h.sleeps).toEqual([2_000, 4_000, 8_000, 16_000]);
    expect(me.calls.count).toBe(5);
    expect(h.hooks.now()).toBeLessThanOrEqual(BLOCKING_BUDGET_MS);
  });

  it('without a cached user, gives up at about 30s when every call times out after 10s', async () => {
    const h = makeHarness();
    const me = async (): Promise<{ user: User }> => {
      h.advance(10_000);
      throw timedOut();
    };

    const { resolution } = run(h, me, null);

    await expect(resolution).resolves.toEqual({ kind: 'gave-up' });
    expect(h.sleeps).toEqual([2_000, 4_000]);
    // The budget plus at most one more request timeout.
    expect(h.hooks.now()).toBeLessThanOrEqual(BLOCKING_BUDGET_MS + 10_000);
  });

  it('is cancelled, not verified, when cancelled during the first call', async () => {
    const h = makeHarness();
    const me = async (): Promise<{ user: User }> => {
      h.cancel();
      return { user: freshUser };
    };

    const { resolution } = run(h, me, cachedUser);

    await expect(resolution).resolves.toEqual({ kind: 'cancelled' });
  });

  it('is cancelled, with no more me() calls, when cancelled while waiting to retry', async () => {
    const h = makeHarness();
    const me = script<{ user: User }>({ fail: timedOut() });
    const sleepThenCancel = async (ms: number) => {
      h.sleeps.push(ms);
      h.cancel();
    };

    const resolution = resolveBootstrap({
      ...h.hooks,
      token: validToken,
      sleep: sleepThenCancel,
      fetchMe: me.fn,
      readCachedUser: async () => null,
    });

    await expect(resolution).resolves.toEqual({ kind: 'cancelled' });
    expect(me.calls.count).toBe(1);
  });

  describe('a token already past its exp', () => {
    it.each(transientErrors)(
      'is rejected, not resumed on the cached user, when me() fails transiently: %s',
      async (_label, err) => {
        const h = makeHarness(NOW_MS);
        const me = script<{ user: User }>({ fail: err });

        const { resolution } = run(h, me.fn, cachedUser, expiredToken);

        await expect(resolution).resolves.toEqual({ kind: 'rejected' });
        expect(h.sleeps).toEqual([]);
        expect(me.calls.count).toBe(1);
      },
    );

    it('is rejected at once, not after the blocking retries, when there is no cached user', async () => {
      const h = makeHarness(NOW_MS);
      const me = script<{ user: User }>({ fail: timedOut() });

      const { resolution } = run(h, me.fn, null, expiredToken);

      await expect(resolution).resolves.toEqual({ kind: 'rejected' });
      expect(h.sleeps).toEqual([]);
      expect(me.calls.count).toBe(1);
    });

    it('is judged by the clock at the time of the failure, not at the start of the call', async () => {
      // exp is 5s away when the call starts; the request then hangs for 10s before timing out.
      const h = makeHarness(NOW_MS);
      const nearlyExpired = tokenFor(cachedUser.id, NOW_S + 5);
      const me = async (): Promise<{ user: User }> => {
        h.advance(10_000);
        throw timedOut();
      };

      const { resolution } = run(h, me, cachedUser, nearlyExpired);

      await expect(resolution).resolves.toEqual({ kind: 'rejected' });
    });

    it('is still verified when the server answers: the server outranks the local clock', async () => {
      const h = makeHarness(NOW_MS);
      const me = script<{ user: User }>({ ok: { user: freshUser } });

      const { resolution } = run(h, me.fn, cachedUser, expiredToken);

      await expect(resolution).resolves.toEqual({ kind: 'verified', user: freshUser });
    });
  });

  describe('an undecodable token', () => {
    it('resumes from the cached user, as before', async () => {
      const h = makeHarness(NOW_MS);
      const me = script<{ user: User }>({ fail: timedOut() });

      const { resolution } = run(h, me.fn, cachedUser, 'not-a-jwt');

      await expect(resolution).resolves.toEqual({ kind: 'resume-cached', user: cachedUser });
    });

    it('retries while loading when there is no cached user, as before', async () => {
      const h = makeHarness(NOW_MS);
      const me = script<{ user: User }>({ fail: timedOut() }, { ok: { user: freshUser } });

      const { resolution } = run(h, me.fn, null, 'not-a-jwt');

      await expect(resolution).resolves.toEqual({ kind: 'verified', user: freshUser });
      expect(h.sleeps).toEqual([2_000]);
    });
  });

  describe('a cached user from a different account than the token', () => {
    it('is ignored: retries while loading instead of resuming on it', async () => {
      const h = makeHarness(NOW_MS);
      const me = script<{ user: User }>({ fail: timedOut() }, { fail: coldStart() }, { ok: { user: freshUser } });

      const { resolution } = run(h, me.fn, cachedUser, otherAccountToken);

      await expect(resolution).resolves.toEqual({ kind: 'verified', user: freshUser });
      expect(h.sleeps).toEqual([2_000, 4_000]);
      expect(me.calls.count).toBe(3);
    });

    it('gives up like the no-cache case when the backend never answers, without rejecting the token', async () => {
      const h = makeHarness(NOW_MS);
      const me = script<{ user: User }>({ fail: new ApiError(0, 'Network error') });

      const { resolution } = run(h, me.fn, cachedUser, otherAccountToken);

      await expect(resolution).resolves.toEqual({ kind: 'gave-up' });
      expect(h.sleeps).toEqual([2_000, 4_000, 8_000, 16_000]);
    });

    it('is not even used when the server answers: the fresh user wins', async () => {
      const h = makeHarness(NOW_MS);
      const me = script<{ user: User }>({ ok: { user: freshUser } });

      const { resolution } = run(h, me.fn, cachedUser, otherAccountToken);

      await expect(resolution).resolves.toEqual({ kind: 'verified', user: freshUser });
    });
  });
});

// ─── Token refresh ──────────────────────────────────────────

describe('resolveRefresh', () => {
  const newToken = tokenFor(cachedUser.id, NOW_S + 7 * 86_400);

  /** `isCancelled` defaults to a session that stays live for the whole refresh. */
  function run(
    refresh: () => Promise<{ token: string }>,
    fetchMe: () => Promise<{ user: User }>,
    isCancelled: () => boolean = () => false,
  ) {
    return resolveRefresh({ refresh, fetchMe, isCancelled });
  }

  it('returns the new token and the fresh user when both calls work', async () => {
    const refresh = script<{ token: string }>({ ok: { token: newToken } });
    const me = script<{ user: User }>({ ok: { user: freshUser } });

    const resolution = await run(refresh.fn, me.fn);

    expect(resolution).toEqual({ kind: 'refreshed', token: newToken, user: freshUser });
    expect(refresh.calls.count).toBe(1);
    expect(me.calls.count).toBe(1);
  });

  it('signs out on a 401 from refresh()', async () => {
    const refresh = script<{ token: string }>({ fail: unauthorized() });
    const me = script<{ user: User }>({ ok: { user: freshUser } });

    await expect(run(refresh.fn, me.fn)).resolves.toEqual({ kind: 'sign-out' });
    expect(me.calls.count).toBe(0);
  });

  it('signs out on a 404 with the user-not-found body from refresh() (the account was deleted)', async () => {
    const refresh = script<{ token: string }>({ fail: accountGone() });
    const me = script<{ user: User }>({ ok: { user: freshUser } });

    await expect(run(refresh.fn, me.fn)).resolves.toEqual({ kind: 'sign-out' });
  });

  it('signs out on a 401, or a 404 with the user-not-found body, from the me() that follows a good refresh()', async () => {
    const refresh = script<{ token: string }>({ ok: { token: newToken } });

    await expect(run(refresh.fn, script<{ user: User }>({ fail: unauthorized() }).fn)).resolves.toEqual({
      kind: 'sign-out',
    });
    await expect(run(refresh.fn, script<{ user: User }>({ fail: accountGone() }).fn)).resolves.toEqual({
      kind: 'sign-out',
    });
  });

  it.each(transientErrors)('keeps the session and retries in 5 minutes when refresh() fails transiently: %s', async (_label, err) => {
    const refresh = script<{ token: string }>({ fail: err });
    const me = script<{ user: User }>({ ok: { user: freshUser } });

    await expect(run(refresh.fn, me.fn)).resolves.toEqual({ kind: 'retry-later', delayMs: REFRESH_RETRY_DELAY_MS });
  });

  it.each(transientErrors)('keeps the session and retries in 5 minutes when me() fails transiently: %s', async (_label, err) => {
    const refresh = script<{ token: string }>({ ok: { token: newToken } });
    const me = script<{ user: User }>({ fail: err });

    await expect(run(refresh.fn, me.fn)).resolves.toEqual({ kind: 'retry-later', delayMs: REFRESH_RETRY_DELAY_MS });
  });

  describe('when the session ends while the requests are in flight', () => {
    it('discards a successful result: the user must not be signed back in after a logout', async () => {
      let ended = false;
      const refresh = async () => {
        ended = true; // logout lands while refresh() is in flight
        return { token: newToken };
      };
      const me = script<{ user: User }>({ ok: { user: freshUser } });

      const resolution = await run(refresh, me.fn, () => ended);

      expect(resolution).toEqual({ kind: 'cancelled' });
    });

    it('does not even call me() once the session has ended', async () => {
      let ended = false;
      const refresh = async () => {
        ended = true;
        return { token: newToken };
      };
      const me = script<{ user: User }>({ ok: { user: freshUser } });

      await run(refresh, me.fn, () => ended);

      expect(me.calls.count).toBe(0);
    });

    it('discards a successful result when the session ends during me()', async () => {
      let ended = false;
      const refresh = script<{ token: string }>({ ok: { token: newToken } });
      const me = async (): Promise<{ user: User }> => {
        ended = true;
        return { user: freshUser };
      };

      await expect(run(refresh.fn, me, () => ended)).resolves.toEqual({ kind: 'cancelled' });
    });

    it('discards a late 401 so it cannot wipe the session that replaced the old one', async () => {
      let ended = false;
      const refresh = async (): Promise<{ token: string }> => {
        ended = true;
        throw unauthorized();
      };

      await expect(run(refresh, script<{ user: User }>({ ok: { user: freshUser } }).fn, () => ended)).resolves.toEqual({
        kind: 'cancelled',
      });
    });

    it('discards a late transient failure so no retry timer is scheduled after the logout', async () => {
      let ended = false;
      const refresh = async (): Promise<{ token: string }> => {
        ended = true;
        throw timedOut();
      };

      await expect(run(refresh, script<{ user: User }>({ ok: { user: freshUser } }).fn, () => ended)).resolves.toEqual({
        kind: 'cancelled',
      });
    });

    it('a session that was already over before the call makes no requests at all', async () => {
      const refresh = script<{ token: string }>({ ok: { token: newToken } });
      const me = script<{ user: User }>({ ok: { user: freshUser } });

      await expect(run(refresh.fn, me.fn, () => true)).resolves.toEqual({ kind: 'cancelled' });
      expect(refresh.calls.count).toBe(0);
      expect(me.calls.count).toBe(0);
    });
  });

  it('works with a RetryScope generation as the cancel signal (what AuthContext passes)', async () => {
    const scope = new RetryScope();
    const isCancelled = scope.begin();
    const refresh = async () => {
      scope.cancel(); // logout, auth rejection, or unmount
      return { token: newToken };
    };

    const resolution = await run(refresh, script<{ user: User }>({ ok: { user: freshUser } }).fn, isCancelled);

    expect(resolution).toEqual({ kind: 'cancelled' });
  });
});

// ─── Cancellation scope ─────────────────────────────────────

describe('RetryScope', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sleep resolves once the delay has passed', async () => {
    const scope = new RetryScope();
    let woke = false;
    const sleeping = scope.sleep(5_000).then(() => {
      woke = true;
    });

    await jest.advanceTimersByTimeAsync(4_999);
    expect(woke).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await sleeping;
    expect(woke).toBe(true);
  });

  it('cancel wakes a pending sleep immediately and clears its timer', async () => {
    const scope = new RetryScope();
    const sleeping = scope.sleep(45_000);
    expect(jest.getTimerCount()).toBe(1);

    scope.cancel();

    await sleeping;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a predicate taken before cancel() flips; one taken after is live again', () => {
    const scope = new RetryScope();
    const before = scope.begin();
    expect(before()).toBe(false);

    scope.cancel();
    const after = scope.begin();

    expect(before()).toBe(true);
    expect(after()).toBe(false);
  });

  it('cancelling stops a running verification loop before its next attempt (logout or unmount)', async () => {
    const scope = new RetryScope();
    const attempt = jest.fn(async (): Promise<string> => {
      throw timedOut();
    });
    const loop = retryTransient({
      attempt,
      delaysMs: BACKGROUND_RETRY_DELAYS_MS,
      sleep: scope.sleep,
      isCancelled: scope.begin(),
    });

    await jest.advanceTimersByTimeAsync(5_000);
    expect(attempt).toHaveBeenCalledTimes(1);

    scope.cancel();

    await expect(loop).resolves.toEqual({ kind: 'cancelled' });
    await jest.advanceTimersByTimeAsync(120_000);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancelling stops the blocking cold-start loop while the splash is up (unmount)', async () => {
    const scope = new RetryScope();
    const fetchMe = jest.fn(async (): Promise<{ user: User }> => {
      throw coldStart();
    });
    const resolution = resolveBootstrap({
      token: neverExpiresToken,
      fetchMe,
      readCachedUser: async () => null,
      sleep: scope.sleep,
      isCancelled: scope.begin(),
    });

    await jest.advanceTimersByTimeAsync(2_000);
    expect(fetchMe).toHaveBeenCalledTimes(2);

    scope.cancel();

    await expect(resolution).resolves.toEqual({ kind: 'cancelled' });
    await jest.advanceTimersByTimeAsync(60_000);
    expect(fetchMe).toHaveBeenCalledTimes(2);
  });

  it('the scope can be reused after a cancel', async () => {
    const scope = new RetryScope();
    scope.cancel();
    const attempt = jest.fn(async () => 'user');

    const loop = retryTransient({
      attempt,
      delaysMs: [1_000],
      sleep: scope.sleep,
      isCancelled: scope.begin(),
    });
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(loop).resolves.toEqual({ kind: 'success', value: 'user' });
  });
});
