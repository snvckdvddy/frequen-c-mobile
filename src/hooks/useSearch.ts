/**
 * useSearch Hook
 *
 * Debounced search against the backend Spotify search endpoint.
 * 500ms debounce to match the web app behavior.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchApi } from '../services/api';
import type { Track } from '../types';

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: Track[];
  isSearching: boolean;
  error: string | null;
  clearSearch: () => void;
}

export function useSearch(debounceMs = 500): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Reset if empty query
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      try {
        const { tracks } = await searchApi.tracks(query.trim());
        setResults(tracks);
      } catch (err: any) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs]);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
  }, []);

  return { query, setQuery, results, isSearching, error, clearSearch };
}

export default useSearch;
