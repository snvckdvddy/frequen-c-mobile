/**
 * useRecentSearches Hook
 *
 * Stores last 10 search queries in AsyncStorage.
 * Tap to re-search. Swipe-to-delete on the UI side.
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RecentSearch, SearchSegment } from '../types';

const STORAGE_KEY = 'frequenc_recent_searches';
const MAX_RECENT = 10;

export function useRecentSearches() {
  const [searches, setSearches] = useState<RecentSearch[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setSearches(JSON.parse(raw));
          } catch {
            setSearches([]);
          }
        }
        setIsLoaded(true);
      })
      .catch(() => setIsLoaded(true));
  }, []);

  // Persist on change
  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(searches)).catch(() => {});
  }, [searches, isLoaded]);

  const addSearch = useCallback((query: string, segment: SearchSegment = 'tracks') => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearches((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter(
        (s) => s.query.toLowerCase() !== trimmed.toLowerCase()
      );
      // Prepend new search
      const next: RecentSearch[] = [
        { query: trimmed, timestamp: new Date().toISOString(), segment },
        ...filtered,
      ];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const removeSearch = useCallback((query: string) => {
    setSearches((prev) => prev.filter((s) => s.query !== query));
  }, []);

  const clearAll = useCallback(() => {
    setSearches([]);
  }, []);

  return { searches, addSearch, removeSearch, clearAll, isLoaded };
}

export default useRecentSearches;
