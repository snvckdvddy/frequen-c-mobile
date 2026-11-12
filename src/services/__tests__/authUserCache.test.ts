/**
 * Last-good-user cache tests.
 *
 * AsyncStorage is a native module, so it is replaced with an in-memory fake.
 * The jest.mock factory is hoisted, which is why the fake lives in `mock*`
 * consts declared before the module under test is imported.
 */

import type { User } from '../../types';

const mockStore = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn(async (key: string): Promise<string | null> => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    mockStore.set(key, value);
  }),
  removeItem: jest.fn(async (key: string): Promise<void> => {
    mockStore.delete(key);
  }),
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: mockStorage,
}));

import {
  clearCachedUser,
  parseCachedUser,
  readCachedUser,
  toCacheableUser,
  writeCachedUser,
} from '../authUserCache';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'usr_1',
    username: 'caleb',
    email: 'caleb@example.test',
    connectedServices: {
      spotify: { connected: true, username: 'caleb_sp' },
      soundcloud: { connected: false },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function onlyStoredValue(): string {
  const values = Array.from(mockStore.values());
  expect(values).toHaveLength(1);
  return values[0];
}

beforeEach(() => {
  mockStore.clear();
  mockStorage.getItem.mockClear();
  mockStorage.setItem.mockClear();
  mockStorage.removeItem.mockClear();
});

describe('authUserCache read and write', () => {
  it('returns null when nothing has been cached', async () => {
    expect(await readCachedUser()).toBeNull();
  });

  it('round-trips the last good user', async () => {
    const user = makeUser({ avatarUrl: 'https://cdn.example.test/a.png', voltageBalance: 42 });

    await writeCachedUser(user);

    expect(await readCachedUser()).toEqual(user);
  });

  it('keeps only the newest user when written twice', async () => {
    await writeCachedUser(makeUser({ id: 'usr_1', username: 'first' }));
    await writeCachedUser(makeUser({ id: 'usr_1', username: 'second' }));

    expect((await readCachedUser())?.username).toBe('second');
  });

  it('clearCachedUser removes the entry', async () => {
    await writeCachedUser(makeUser());

    await clearCachedUser();

    expect(await readCachedUser()).toBeNull();
    expect(mockStore.size).toBe(0);
  });

  it('clearing an empty cache is fine', async () => {
    await expect(clearCachedUser()).resolves.toBeUndefined();
  });
});

describe('authUserCache never persists provider tokens', () => {
  const withSecrets = makeUser({
    connectedServices: {
      spotify: {
        connected: true,
        username: 'caleb_sp',
        accessToken: 'spotify-access-secret',
        refreshToken: 'spotify-refresh-secret',
        expiresAt: 1_800_000_000,
      },
      tidal: { connected: true, accessToken: 'tidal-access-secret' },
    },
  });

  it('toCacheableUser drops access and refresh tokens but keeps the rest of each connection', () => {
    const safe = toCacheableUser(withSecrets);

    expect(safe.connectedServices.spotify).toEqual({
      connected: true,
      username: 'caleb_sp',
      expiresAt: 1_800_000_000,
    });
    expect(safe.connectedServices.tidal).toEqual({ connected: true });
  });

  it('does not mutate the user it was given', () => {
    toCacheableUser(withSecrets);

    expect(withSecrets.connectedServices.spotify?.accessToken).toBe('spotify-access-secret');
  });

  it('the stored string contains none of the secrets', async () => {
    await writeCachedUser(withSecrets);

    const stored = onlyStoredValue();
    expect(stored).not.toContain('secret');
    expect(stored).toContain('caleb_sp');
  });

  it('passes fields the type does not know about through untouched', async () => {
    const withPreferences = {
      ...makeUser(),
      preferences: { noiseGate: 'medium', isIncognito: false },
    } as User;

    await writeCachedUser(withPreferences);

    expect(await readCachedUser()).toEqual(withPreferences);
  });
});

describe('parseCachedUser', () => {
  it('returns null for empty input', () => {
    expect(parseCachedUser(null)).toBeNull();
    expect(parseCachedUser('')).toBeNull();
  });

  it('returns null for corrupt JSON', () => {
    expect(parseCachedUser('{"id":"usr_1","username":')).toBeNull();
  });

  it.each([
    ['an array', '[]'],
    ['a number', '42'],
    ['a string', '"usr_1"'],
    ['null', 'null'],
    ['an object without an id', '{"username":"caleb"}'],
    ['an object with an empty id', '{"id":"","username":"caleb"}'],
    ['an object with a non-string id', '{"id":7,"username":"caleb"}'],
    ['an object without a username', '{"id":"usr_1"}'],
  ])('returns null for %s', (_label, raw) => {
    expect(parseCachedUser(raw)).toBeNull();
  });

  it('fills in connectedServices when an older entry lacks it', () => {
    const parsed = parseCachedUser('{"id":"usr_1","username":"caleb","email":"c@example.test","createdAt":"2026-01-01"}');

    expect(parsed?.connectedServices).toEqual({});
    expect(parsed?.id).toBe('usr_1');
  });
});

describe('authUserCache failure handling', () => {
  it('readCachedUser resolves null when storage throws', async () => {
    mockStorage.getItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(readCachedUser()).resolves.toBeNull();
  });

  it('writeCachedUser swallows storage errors', async () => {
    mockStorage.setItem.mockRejectedValueOnce(new Error('disk full'));

    await expect(writeCachedUser(makeUser())).resolves.toBeUndefined();
  });

  it('clearCachedUser swallows storage errors', async () => {
    mockStorage.removeItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(clearCachedUser()).resolves.toBeUndefined();
  });
});
