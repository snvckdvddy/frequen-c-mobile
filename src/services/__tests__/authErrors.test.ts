/**
 * isAuthRejection: an explicit 401 from the backend (the token is dead).
 * isSessionEndingError: a 401, or a 404 whose body is the backend's own
 * { message: 'User not found' } (the account is gone), from me() or refresh().
 * Nothing else ends a session. Any other 404, such as the 'Application not
 * found' Railway's edge sends when the service is misrouted or down, is
 * transient.
 *
 * fetchClient imports ./config (expo-device, react-native), which can't load
 * in the Node test env, so config is stubbed the same way the other service
 * tests do it.
 */

jest.mock('../config', () => ({
  API_BASE_URL: 'http://localhost:5000/api',
}));

import { ApiError } from '../fetchClient';
import { isAuthRejection, isSessionEndingError } from '../authErrors';

describe('isAuthRejection', () => {
  it('is true for a 401 from the backend', () => {
    expect(isAuthRejection(new ApiError(401, 'Invalid or expired token'))).toBe(true);
  });

  it('is true for a 401 carrying a response body', () => {
    expect(isAuthRejection(new ApiError(401, 'Authentication required', { message: 'Authentication required' }))).toBe(true);
  });

  it('is false for status 0 (request timeout or network error)', () => {
    expect(isAuthRejection(new ApiError(0, 'Request timed out to https://example.test/api'))).toBe(false);
    expect(isAuthRejection(new ApiError(0, 'Network error reaching https://example.test/api'))).toBe(false);
  });

  it.each([500, 502, 503, 504])('is false for %i (backend cold start or outage)', (status) => {
    expect(isAuthRejection(new ApiError(status, 'Server error'))).toBe(false);
  });

  it('is false for 429 (rate limited)', () => {
    expect(isAuthRejection(new ApiError(429, 'Too many requests'))).toBe(false);
  });

  it.each([400, 403, 404, 408])('is false for other client errors (%i)', (status) => {
    expect(isAuthRejection(new ApiError(status, 'Client error'))).toBe(false);
  });

  it('is false for errors that are not an ApiError', () => {
    expect(isAuthRejection(new Error('boom'))).toBe(false);
    expect(isAuthRejection(new TypeError('Network request failed'))).toBe(false);
  });

  it('is false for look-alikes that only carry a 401 status', () => {
    expect(isAuthRejection(Object.assign(new Error('Unauthorized'), { status: 401 }))).toBe(false);
    expect(isAuthRejection({ status: 401 })).toBe(false);
  });

  it('is false for non-error values', () => {
    expect(isAuthRejection(undefined)).toBe(false);
    expect(isAuthRejection(null)).toBe(false);
    expect(isAuthRejection('401')).toBe(false);
    expect(isAuthRejection(401)).toBe(false);
  });
});

/** Bodies that are not the backend's { message: 'User not found' }. A 404 carrying any of them must not end the session. */
const notTheUserNotFoundBody: [string, unknown][] = [
  ['no body at all', undefined],
  ['the Railway edge message (Application not found)', { message: 'Application not found' }],
  ['the fallback fetchClient builds for a non-JSON response', { message: 'Unknown error' }],
  ['null', null],
  ['a string', 'User not found'],
  ['a number', 404],
  ['an array', ['User not found']],
  ['an object with no message', {}],
  ['the text under another key', { error: 'User not found' }],
  ['a non-string message', { message: 404 }],
  ['an array message', { message: ['User not found'] }],
  ['a nested message', { message: { text: 'User not found' } }],
];

/** Close to the backend's message, but not it. */
const nearMissMessages: [string, string][] = [
  ['a different case', 'user not found'],
  ['title case', 'User Not Found'],
  ['a trailing period', 'User not found.'],
  ['leading whitespace', ' User not found'],
  ['trailing whitespace', 'User not found '],
  ['a longer message', 'User not found in this workspace'],
  ['an empty message', ''],
];

describe('isSessionEndingError', () => {
  it('is true for a 401 from the backend', () => {
    expect(isSessionEndingError(new ApiError(401, 'Invalid or expired token'))).toBe(true);
  });

  it('is true for a 401 whatever the body says: the status alone is enough', () => {
    expect(isSessionEndingError(new ApiError(401, 'Authentication required', { message: 'Authentication required' }))).toBe(true);
    expect(isSessionEndingError(new ApiError(401, 'Application not found', { message: 'Application not found' }))).toBe(true);
  });

  describe('a 404', () => {
    it('is true when the body is the one the backend sends for a deleted account', () => {
      expect(isSessionEndingError(new ApiError(404, 'User not found', { message: 'User not found' }))).toBe(true);
    });

    it('is true when the body carries other fields next to the matching message', () => {
      expect(isSessionEndingError(new ApiError(404, 'User not found', { message: 'User not found', code: 'USER_GONE' }))).toBe(true);
    });

    it('is false for the Railway edge 404: the service is misrouted or down, the account is fine', () => {
      expect(isSessionEndingError(new ApiError(404, 'Application not found', { message: 'Application not found' }))).toBe(false);
    });

    it('is false when there is no body, even if the error message says "User not found"', () => {
      expect(isSessionEndingError(new ApiError(404, 'Not Found'))).toBe(false);
      expect(isSessionEndingError(new ApiError(404, 'User not found'))).toBe(false);
    });

    it('is false when only the error message says "User not found" and the body says something else', () => {
      expect(isSessionEndingError(new ApiError(404, 'User not found', { message: 'Application not found' }))).toBe(false);
    });

    it.each(notTheUserNotFoundBody)('is false when the body is not the user-not-found body: %s', (_label, body) => {
      expect(isSessionEndingError(new ApiError(404, 'Not Found', body))).toBe(false);
    });

    it.each(nearMissMessages)('is false when the body message is not an exact match: %s', (_label, message) => {
      expect(isSessionEndingError(new ApiError(404, message, { message }))).toBe(false);
    });
  });

  it.each([400, 403, 408, 409, 410, 429, 500, 502, 503])(
    'is false for a %i even with the user-not-found body: only a 404 says the account is gone',
    (status) => {
      expect(isSessionEndingError(new ApiError(status, 'User not found', { message: 'User not found' }))).toBe(false);
    },
  );

  it('stays narrower than "any client error": isAuthRejection still means 401 only', () => {
    expect(isAuthRejection(new ApiError(404, 'User not found', { message: 'User not found' }))).toBe(false);
    expect(isAuthRejection(new ApiError(401, 'Invalid or expired token'))).toBe(true);
  });

  it('is false for status 0 (request timeout or network error)', () => {
    expect(isSessionEndingError(new ApiError(0, 'Request timed out to https://example.test/api'))).toBe(false);
    expect(isSessionEndingError(new ApiError(0, 'Network error reaching https://example.test/api'))).toBe(false);
  });

  it.each([500, 502, 503, 504])('is false for %i (backend cold start or outage)', (status) => {
    expect(isSessionEndingError(new ApiError(status, 'Server error'))).toBe(false);
  });

  it('is false for 429 (rate limited)', () => {
    expect(isSessionEndingError(new ApiError(429, 'Too many requests'))).toBe(false);
  });

  it.each([400, 403, 408, 409, 410])('is false for other client errors (%i)', (status) => {
    expect(isSessionEndingError(new ApiError(status, 'Client error'))).toBe(false);
  });

  it('is false for errors that are not an ApiError', () => {
    expect(isSessionEndingError(new Error('boom'))).toBe(false);
    expect(isSessionEndingError(new TypeError('Network request failed'))).toBe(false);
  });

  it('is false for look-alikes that only carry a 401 or 404 status', () => {
    expect(isSessionEndingError(Object.assign(new Error('Unauthorized'), { status: 401 }))).toBe(false);
    expect(isSessionEndingError(Object.assign(new Error('Not found'), { status: 404 }))).toBe(false);
    expect(isSessionEndingError({ status: 404 })).toBe(false);
  });

  it('is false for a look-alike that is not an ApiError, even with the user-not-found body', () => {
    expect(isSessionEndingError({ status: 404, body: { message: 'User not found' } })).toBe(false);
    expect(
      isSessionEndingError(Object.assign(new Error('User not found'), { status: 404, body: { message: 'User not found' } })),
    ).toBe(false);
  });

  it('is false for non-error values', () => {
    expect(isSessionEndingError(undefined)).toBe(false);
    expect(isSessionEndingError(null)).toBe(false);
    expect(isSessionEndingError('404')).toBe(false);
    expect(isSessionEndingError(404)).toBe(false);
  });
});
