/**
 * Auth error classification.
 *
 * A session is only dead when the server says so. A timeout or network
 * failure (ApiError status 0), a 5xx during a Railway cold start, a 429, or
 * any error that is not an ApiError says nothing about the credentials, so
 * callers keep the session and retry instead of signing the user out.
 */

import { ApiError } from './fetchClient';

/**
 * True only when the backend explicitly rejected the credentials (HTTP 401:
 * missing, invalid, or expired token). Everything else is transient.
 */
export function isAuthRejection(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/**
 * The message in the body of the 404 the backend sends from /auth/me and
 * /auth/refresh when the token's user no longer exists (see authRoutes.ts in
 * Frequen-C-Backend: res.status(404).json({ message: 'User not found' })).
 */
const USER_NOT_FOUND_MESSAGE = 'User not found';

/** True when `body` is the parsed JSON the backend sends for a missing user: { message: 'User not found' }. */
function isUserNotFoundBody(body: unknown): body is { message: typeof USER_NOT_FOUND_MESSAGE } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    body.message === USER_NOT_FOUND_MESSAGE
  );
}

/**
 * True when the answer to me() or refresh() means the session is over: a 401
 * (the token is dead), or a 404 whose body is the backend's own
 * { message: 'User not found' } (the account is gone, and no token can bring
 * it back).
 *
 * Any other 404 is transient. Railway's edge answers 404 ('Application not
 * found') when the service is misrouted or down; that says nothing about the
 * account, and ending the session on it would sign every user out during an
 * outage. A 404 with no body, or with any other message, is treated the same way.
 *
 * Only use this on the results of those two calls. A 404 from any other
 * endpoint says nothing about the session.
 */
export function isSessionEndingError(err: unknown): boolean {
  if (isAuthRejection(err)) return true;
  return err instanceof ApiError && err.status === 404 && isUserNotFoundBody(err.body);
}
