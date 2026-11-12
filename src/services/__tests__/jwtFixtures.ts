/**
 * Test helper: JWT-shaped strings for the auth tests.
 *
 * The app only reads the payload (authToken.ts) and never checks the signature,
 * so the signature segment is a placeholder. Segments are base64url like the real
 * thing (no padding, - and _ in place of + and /), built with btoa so it runs in
 * Node and Hermes alike. Payloads must be Latin-1, which is all these tests use.
 *
 * This file is not a test (jest only picks up *.test.ts).
 */

export function base64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A token whose payload is exactly `payload`. */
export function makeToken(payload: Record<string, unknown>): string {
  return [
    base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
    base64Url(JSON.stringify(payload)),
    'signature',
  ].join('.');
}
