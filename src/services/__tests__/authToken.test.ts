/**
 * Local JWT claim reading: what the app trusts from a token it cannot verify.
 *
 * Tokens are built by jwtFixtures.makeToken, which encodes the payload as
 * base64url like the backend's jsonwebtoken does.
 */

import { cachedUserMatchesToken, decodeTokenClaims, isTokenExpired } from '../authToken';
import { base64Url, makeToken } from './jwtFixtures';

describe('decodeTokenClaims', () => {
  it('reads exp and userId from a token shaped like the backend signs them', () => {
    const token = makeToken({ userId: 'usr_1', username: 'caleb', iat: 1_790_000_000, exp: 1_790_604_800 });

    expect(decodeTokenClaims(token)).toEqual({ exp: 1_790_604_800, userId: 'usr_1' });
  });

  it('ignores claims it does not use', () => {
    const claims = decodeTokenClaims(makeToken({ userId: 'usr_1', exp: 5, role: 'admin', extra: { a: 1 } }));

    expect(claims).toEqual({ exp: 5, userId: 'usr_1' });
  });

  describe('base64url payloads', () => {
    // Runs of ? and > put 63 and 62 in the base64 alphabet, which base64url writes
    // as _ and -. atob rejects those as-is, so the decoder has to translate them.
    const payload = { userId: 'usr_1', exp: 1_790_604_800, note: '???>>>???>>>' };
    const token = makeToken(payload);
    const segment = token.split('.')[1];

    it('the fixture really uses the url-safe alphabet', () => {
      expect(segment).toMatch(/[-_]/);
      expect(() => atob(segment)).toThrow();
    });

    it('reads a payload that uses - and _', () => {
      expect(decodeTokenClaims(token)).toEqual({ exp: 1_790_604_800, userId: 'usr_1' });
    });

    // The fixture strips base64 padding. Payloads one character longer each time
    // walk the unpadded length through every case: nothing to pad, one =, two =.
    const userIds = [0, 1, 2, 3, 4, 5].map((extra) => `usr_${'x'.repeat(extra)}`);

    it('the fixtures cover every padding case', () => {
      const remainders = new Set(userIds.map((userId) => makeToken({ userId, exp: 1 }).split('.')[1].length % 4));

      expect(remainders).toEqual(new Set([0, 2, 3]));
    });

    it.each(userIds)('reads an unpadded payload for userId %s', (userId) => {
      expect(decodeTokenClaims(makeToken({ userId, exp: 1 }))).toEqual({ exp: 1, userId });
    });
  });

  describe('returns null when the token cannot be decoded', () => {
    const header = base64Url(JSON.stringify({ alg: 'HS256' }));

    it.each([
      ['an empty string', ''],
      ['no dots', 'mock_jwt_1700000000000'],
      ['two segments', `${header}.${base64Url('{}')}`],
      ['four segments', `${header}.${base64Url('{}')}.sig.extra`],
      ['an empty payload segment', `${header}..sig`],
      ['a payload that is not base64', `${header}.!!!.sig`],
      ['a payload that is not JSON', `${header}.${base64Url('not json')}.sig`],
      ['a payload that is JSON null', `${header}.${base64Url('null')}.sig`],
      ['a payload that is a JSON string', `${header}.${base64Url('"usr_1"')}.sig`],
      ['a payload that is a JSON number', `${header}.${base64Url('42')}.sig`],
      ['a payload that is a JSON array', `${header}.${base64Url('[1,2]')}.sig`],
    ])('%s', (_label, token) => {
      expect(decodeTokenClaims(token)).toBeNull();
    });
  });

  describe('drops claims of the wrong type', () => {
    it('exp that is not a number', () => {
      expect(decodeTokenClaims(makeToken({ userId: 'usr_1', exp: '1790604800' }))).toEqual({
        exp: undefined,
        userId: 'usr_1',
      });
    });

    it('exp that is not finite', () => {
      // JSON has no Infinity; 1e999 parses to it.
      const token = `${base64Url('{}')}.${base64Url('{"userId":"usr_1","exp":1e999}')}.sig`;
      expect(decodeTokenClaims(token)).toEqual({ exp: undefined, userId: 'usr_1' });
    });

    it('userId that is not a string', () => {
      expect(decodeTokenClaims(makeToken({ userId: 7, exp: 5 }))).toEqual({ exp: 5, userId: undefined });
    });

    it('userId that is empty', () => {
      expect(decodeTokenClaims(makeToken({ userId: '', exp: 5 }))).toEqual({ exp: 5, userId: undefined });
    });

    it('a payload with neither claim', () => {
      expect(decodeTokenClaims(makeToken({ username: 'caleb' }))).toEqual({ exp: undefined, userId: undefined });
    });
  });
});

describe('isTokenExpired', () => {
  const nowMs = Date.UTC(2026, 10, 11, 12, 0, 0);
  const nowS = nowMs / 1000;

  it('is true when exp is in the past', () => {
    expect(isTokenExpired({ exp: nowS - 1 }, nowMs)).toBe(true);
    expect(isTokenExpired({ exp: nowS - 86_400 }, nowMs)).toBe(true);
  });

  it('is true when exp is exactly now (a token is valid only before its exp)', () => {
    expect(isTokenExpired({ exp: nowS }, nowMs)).toBe(true);
  });

  it('is false when exp is still ahead', () => {
    expect(isTokenExpired({ exp: nowS + 1 }, nowMs)).toBe(false);
    expect(isTokenExpired({ exp: nowS + 7 * 86_400 }, nowMs)).toBe(false);
  });

  it('compares seconds against milliseconds correctly', () => {
    // 10 minutes from now written in seconds; read as ms it would look like 1970.
    expect(isTokenExpired({ exp: nowS + 600 }, nowMs)).toBe(false);
  });

  it('is false when the token could not be decoded', () => {
    expect(isTokenExpired(null, nowMs)).toBe(false);
  });

  it('is false when the token has no exp claim', () => {
    expect(isTokenExpired({ userId: 'usr_1' }, nowMs)).toBe(false);
    expect(isTokenExpired({}, nowMs)).toBe(false);
  });
});

describe('cachedUserMatchesToken', () => {
  it('is true when the token names the cached user', () => {
    expect(cachedUserMatchesToken('usr_1', { userId: 'usr_1', exp: 5 })).toBe(true);
  });

  it('is false when the token names a different account', () => {
    expect(cachedUserMatchesToken('usr_1', { userId: 'usr_2', exp: 5 })).toBe(false);
  });

  it('compares ids exactly', () => {
    expect(cachedUserMatchesToken('usr_1', { userId: 'USR_1' })).toBe(false);
    expect(cachedUserMatchesToken('usr_1', { userId: 'usr_1 ' })).toBe(false);
  });

  it('is true when the token carries no userId: nothing contradicts the cache', () => {
    expect(cachedUserMatchesToken('usr_1', { exp: 5 })).toBe(true);
    expect(cachedUserMatchesToken('usr_1', {})).toBe(true);
  });

  it('is true when the token could not be decoded', () => {
    expect(cachedUserMatchesToken('usr_1', null)).toBe(true);
  });
});
