/**
 * Local JWT claim reading.
 *
 * The backend signs { userId, username } with a 7 day expiry (Frequen-C-Backend
 * src/auth.ts) and the library adds iat and exp. The app cannot verify the
 * signature, only the server can, so nothing read here proves a token is good.
 * It is used the other way around: to refuse local state that cannot be right
 * (a token whose exp has passed, a cached profile that belongs to someone else)
 * when the server is not answering.
 *
 * No React or native imports. atob exists in Hermes and in Node 16+.
 */

export interface TokenClaims {
  /** The exp claim: seconds since the epoch. */
  exp?: number;
  /** The userId claim: the id of the account the token was issued to. */
  userId?: string;
}

/**
 * Read the payload of a JWT without verifying it. Returns null when the token
 * cannot be decoded at all (not three segments, bad base64, bad JSON, or a
 * payload that is not an object). Claims that are missing or the wrong type
 * come back undefined.
 *
 * JWT segments are base64url (- and _ instead of + and /, no padding), which
 * atob rejects as-is, so the alphabet and padding are normalized first.
 */
export function decodeTokenClaims(token: string): TokenClaims | null {
  const segments = token.split('.');
  if (segments.length !== 3 || !segments[1]) return null;

  try {
    const base64 = segments[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload: unknown = JSON.parse(atob(padded));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

    const { exp, userId } = payload as Record<string, unknown>;
    return {
      exp: typeof exp === 'number' && Number.isFinite(exp) ? exp : undefined,
      userId: typeof userId === 'string' && userId.length > 0 ? userId : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * True only when the claims carry an exp that is at or before nowMs. Claims
 * that could not be decoded, or that have no exp, are not expired: nothing
 * says otherwise, so the caller keeps its current behavior.
 */
export function isTokenExpired(claims: TokenClaims | null, nowMs: number): boolean {
  if (!claims || claims.exp === undefined) return false;
  return claims.exp * 1000 <= nowMs;
}

/**
 * False only when the token positively names a different account than the
 * cached user. A token with no readable userId cannot contradict the cache, so
 * it does not disqualify it.
 */
export function cachedUserMatchesToken(cachedUserId: string, claims: TokenClaims | null): boolean {
  if (!claims || claims.userId === undefined) return true;
  return claims.userId === cachedUserId;
}
