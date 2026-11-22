/**
 * useFavorites Hook
 *
 * Manages a local favorites library in AsyncStorage.
 * Optimistic UI — heart fills instantly, persistence is async.
 * Cap: 500 tracks (backend takes over later).
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Track, FavoriteTrack } from '../types';

const STORAGE_KEY = 'frequenc_favorites';
const MAX_FAVORITES = 500;

// Mounted useFavorites hooks (the app has one, inside FavoritesProvider) that
// need to drop their in-memory list when the favorites are erased.
const clearedListeners = new Set<() => void>();

/** Run `listener` whenever clearStoredFavorites() is called. Returns the unsubscribe function. */
export function subscribeToFavoritesCleared(listener: () => void): () => void {
  clearedListeners.add(listener);
  return () => {
    clearedListeners.delete(listener);
  };
}

/**
 * Erase every saved favorite: the AsyncStorage copy and the list held by any
 * mounted hook. Used when the account is deleted. The provider stays mounted
 * across sign-out, so without the in-memory reset the next person to sign in
 * on this phone would still see the list and write it back to storage.
 * Never throws; a storage failure only leaves the stored copy behind.
 */
export async function clearStoredFavorites(): Promise<void> {
  clearedListeners.forEach((listener) => listener());
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best effort, same as the writes below.
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTrack[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Empty the in-memory list when the favorites are erased (account deletion)
  useEffect(() => subscribeToFavoritesCleared(() => setFavorites([])), []);

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setFavorites(JSON.parse(raw));
          } catch {
            // Corrupted data — reset
            setFavorites([]);
          }
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  // Persist to storage whenever favorites change (skip initial load).
  // An empty list removes the key, so a cleared list leaves nothing behind.
  useEffect(() => {
    if (!isLoaded) return;
    const write = favorites.length > 0
      ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
      : AsyncStorage.removeItem(STORAGE_KEY);
    write.catch(() => {
      // Silent fail — worst case user loses favorites on next load
    });
  }, [favorites, isLoaded]);

  const addFavorite = useCallback((track: Track) => {
    setFavorites((prev) => {
      // Already exists? Don't duplicate
      if (prev.some((f) => f.track.id === track.id)) return prev;
      // Cap at MAX_FAVORITES (drop oldest)
      const next = [{ track, savedAt: new Date().toISOString() }, ...prev];
      return next.slice(0, MAX_FAVORITES);
    });
  }, []);

  const removeFavorite = useCallback((trackId: string) => {
    setFavorites((prev) => prev.filter((f) => f.track.id !== trackId));
  }, []);

  const isFavorite = useCallback(
    (trackId: string) => favorites.some((f) => f.track.id === trackId),
    [favorites]
  );

  const toggleFavorite = useCallback(
    (track: Track) => {
      if (isFavorite(track.id)) {
        removeFavorite(track.id);
      } else {
        addFavorite(track);
      }
    },
    [isFavorite, removeFavorite, addFavorite]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite, isLoaded };
}

export default useFavorites;
