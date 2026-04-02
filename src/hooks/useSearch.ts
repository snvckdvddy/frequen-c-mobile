/**
 * useSearch Hook
 *
 * Debounced search against the backend Spotify search endpoint.
 * 500ms debounce to match the web app behavior.
 */

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import {
  getIdleSearchDiagnostics,
  getIdleSearchProviderStates,
  searchApi,
  type SearchDiagnostics,
  type SearchProviderState,
} from '../services/api';
import type { Track } from '../types';

export type SearchHudSource = 'spotify' | 'soundcloud';

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  sources: Record<SearchHudSource, boolean>;
  setSources: Dispatch<SetStateAction<Record<SearchHudSource, boolean>>>;
  results: Track[];
  fallbackUsed: boolean;
  providerStates: Record<SearchHudSource, SearchProviderState>;
  diagnostics: SearchDiagnostics | null;
  isSearching: boolean;
  error: string | null;
  clearSearch: () => void;
}

export function useSearch(debounceMs = 500): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [sources, setSources] = useState<Record<SearchHudSource, boolean>>({
    spotify: true,
    soundcloud: true,
  });
  const [results, setResults] = useState<Track[]>([]);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [providerStates, setProviderStates] = useState<Record<SearchHudSource, SearchProviderState>>(getIdleSearchProviderStates);
  const [diagnostics, setDiagnostics] = useState<SearchDiagnostics | null>(getIdleSearchDiagnostics);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Reset if empty query
    if (!query.trim()) {
      requestIdRef.current += 1;
      setResults([]);
      setFallbackUsed(false);
      setProviderStates(getIdleSearchProviderStates());
      setDiagnostics(getIdleSearchDiagnostics());
      setIsSearching(false);
      setError(null);
      return;
    }

    const activeSources = (Object.entries(sources) as Array<[SearchHudSource, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([source]) => source);

    if (activeSources.length === 0) {
      requestIdRef.current += 1;
      setResults([]);
      setFallbackUsed(false);
      setProviderStates(getIdleSearchProviderStates());
      setDiagnostics(getIdleSearchDiagnostics());
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      try {
        const trimmedQuery = query.trim();
        const {
          tracks,
          fallbackUsed: didFallback,
          providerStates: nextProviderStates,
          diagnostics: nextDiagnostics,
        } = await searchApi.tracks(trimmedQuery, activeSources);
        if (requestId !== requestIdRef.current) return;

        setResults(tracks);
        setFallbackUsed(didFallback);
        setProviderStates(nextProviderStates || { spotify: 'off', soundcloud: 'off' });
        setDiagnostics(nextDiagnostics);
        setIsSearching(false);

        const isDevRuntime = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
        if (isDevRuntime) {
          console.log(`[SearchTruth][useSearch] ${JSON.stringify({
            query: trimmedQuery,
            providerStates: nextProviderStates,
            resultCount: tracks.length,
            fallbackUsed: didFallback,
            diagnostics: nextDiagnostics,
          })}`);
        }

        const needsAvailabilityEnrichment = tracks.some(
          (track) =>
            track.resultOrigin === 'open' &&
            !track.availableSources?.some((source) => source === 'spotify' || source === 'soundcloud'),
        );

        if (!needsAvailabilityEnrichment) {
          return;
        }

        const enrichedTracks = await searchApi.enrichTrackAvailability(trimmedQuery, tracks, activeSources);
        if (requestId !== requestIdRef.current) return;

        const changed = enrichedTracks.some((track, index) => {
          const previous = tracks[index];
          const previousSources = previous?.availableSources || [];
          const nextSources = track.availableSources || [];
          if (previous?.id !== track.id) return true;
          if (previousSources.length !== nextSources.length) return true;
          return previousSources.some((source, sourceIndex) => source !== nextSources[sourceIndex]);
        });

        if (changed) {
          setResults(enrichedTracks);
        }
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
        setFallbackUsed(false);
        setProviderStates(getIdleSearchProviderStates());
        setDiagnostics(getIdleSearchDiagnostics());
      } finally {
        if (requestId === requestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, sources]);

  const clearSearch = useCallback(() => {
    requestIdRef.current += 1;
    setQuery('');
    setResults([]);
    setFallbackUsed(false);
    setProviderStates(getIdleSearchProviderStates());
    setDiagnostics(getIdleSearchDiagnostics());
    setError(null);
  }, []);

  return { query, setQuery, sources, setSources, results, fallbackUsed, providerStates, diagnostics, isSearching, error, clearSearch };
}

export default useSearch;
