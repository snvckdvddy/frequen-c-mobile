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

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteTrack[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

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

  // Persist to storage whenever favorites change (skip initial load)
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites)).catch(() => {
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
