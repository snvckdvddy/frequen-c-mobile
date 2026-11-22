/**
 * Erasing the saved favorites (account deletion).
 *
 * AsyncStorage is a native module, so it is replaced with an in-memory fake.
 * The hook's own state and effects need a React renderer, which this project's
 * jest setup does not have; what is covered here is the contract AuthContext
 * relies on: the stored copy goes, every mounted hook is told to drop its
 * in-memory list, and a storage failure never reaches the caller.
 */

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

import { clearStoredFavorites, subscribeToFavoritesCleared } from '../useFavorites';

const FAVORITES_KEY = 'frequenc_favorites';

beforeEach(() => {
  mockStore.clear();
  mockStorage.getItem.mockClear();
  mockStorage.setItem.mockClear();
  mockStorage.removeItem.mockClear();
});

describe('clearStoredFavorites', () => {
  it('removes the stored favorites', async () => {
    mockStore.set(FAVORITES_KEY, JSON.stringify([{ track: { id: 't1' }, savedAt: '2026-11-01T00:00:00.000Z' }]));

    await clearStoredFavorites();

    expect(mockStore.has(FAVORITES_KEY)).toBe(false);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(FAVORITES_KEY);
  });

  it('leaves every other stored key alone', async () => {
    mockStore.set(FAVORITES_KEY, '[]');
    mockStore.set('frequenc_local_library_v1', '[{"id":"local_1"}]');
    mockStore.set('frequenc_recent_searches', '["lofi"]');

    await clearStoredFavorites();

    expect(Array.from(mockStore.keys()).sort()).toEqual(['frequenc_local_library_v1', 'frequenc_recent_searches']);
  });

  it('resolves when nothing was stored', async () => {
    await expect(clearStoredFavorites()).resolves.toBeUndefined();
  });

  it('tells every mounted hook to drop its in-memory list', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const stopFirst = subscribeToFavoritesCleared(first);
    const stopSecond = subscribeToFavoritesCleared(second);

    await clearStoredFavorites();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    stopFirst();
    stopSecond();
  });

  it('stops telling a hook once it has unsubscribed (unmounted)', async () => {
    const listener = jest.fn();
    const stop = subscribeToFavoritesCleared(listener);
    stop();

    await clearStoredFavorites();

    expect(listener).not.toHaveBeenCalled();
  });

  it('still clears the in-memory lists, and does not throw, when storage fails', async () => {
    const listener = jest.fn();
    const stop = subscribeToFavoritesCleared(listener);
    mockStorage.removeItem.mockRejectedValueOnce(new Error('disk full'));

    await expect(clearStoredFavorites()).resolves.toBeUndefined();

    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('can be called again after a hook re-subscribes', async () => {
    const listener = jest.fn();
    const stop = subscribeToFavoritesCleared(listener);
    await clearStoredFavorites();
    stop();
    const stopAgain = subscribeToFavoritesCleared(listener);
    await clearStoredFavorites();

    expect(listener).toHaveBeenCalledTimes(2);
    stopAgain();
  });
});
