/**
 * useLibraryBrowse
 * ─────────────────────────────────────────────────────────────
 * Encapsulates all state and data-fetching logic for browsing
 * a user's streaming service playlists. Used by both the
 * standalone LibraryScreen and the in-session SearchHudOverlay.
 *
 * Provides: service selection, playlist fetching, track fetching,
 * AsyncStorage caching (optional), and in-memory track cache.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ConnectedServices, TrackSource, Playlist, Track } from '../types';
import { getAllConnectedAdapters, getConnectedSources } from '../services/adapters/musicServiceAdapter';

// ─── Cache ──────────────────────────────────────────────────

const PLAYLIST_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CACHE_KEY_PREFIX = 'library_playlists_';

interface CachedPlaylists {
  playlists: Playlist[];
  timestamp: number;
}

async function getCachedPlaylists(service: TrackSource): Promise<Playlist[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEY_PREFIX}${service}`);
    if (!raw) return null;
    const cached: CachedPlaylists = JSON.parse(raw);
    if (Date.now() - cached.timestamp > PLAYLIST_CACHE_TTL_MS) return null;
    return cached.playlists;
  } catch {
    return null;
  }
}

async function setCachedPlaylists(service: TrackSource, playlists: Playlist[]): Promise<void> {
  try {
    const data: CachedPlaylists = { playlists, timestamp: Date.now() };
    await AsyncStorage.setItem(`${CACHE_KEY_PREFIX}${service}`, JSON.stringify(data));
  } catch {
    // Cache write failures are non-critical
  }
}

// ─── Hook Options ───────────────────────────────────────────

export interface UseLibraryBrowseOptions {
  connectedServices: ConnectedServices | undefined;
  /** Enable AsyncStorage playlist caching (default: true) */
  enableCache?: boolean;
  /** Auto-select first service when tab opens (default: true) */
  autoSelect?: boolean;
}

// ─── Hook Return ────────────────────────────────────────────

export interface UseLibraryBrowseResult {
  /** TrackSource keys for all connected services */
  connectedSources: TrackSource[];
  /** Currently selected service */
  selectedService: TrackSource | null;
  /** Select a service (resets playlist/track selection) */
  selectService: (service: TrackSource) => void;
  /** Playlists for the selected service */
  playlists: Playlist[];
  /** Whether playlists are loading */
  playlistsLoading: boolean;
  /** Currently selected playlist (drill-down into tracks) */
  selectedPlaylist: Playlist | null;
  /** Select a playlist (triggers track fetch) */
  selectPlaylist: (playlist: Playlist) => void;
  /** Go back from track list to playlist list */
  clearPlaylist: () => void;
  /** Tracks in the selected playlist */
  tracks: Track[];
  /** Whether tracks are loading */
  tracksLoading: boolean;
  /** Force-refresh playlists for the current service */
  refreshPlaylists: () => void;
}

// ─── Hook ───────────────────────────────────────────────────

export function useLibraryBrowse({
  connectedServices,
  enableCache = true,
  autoSelect = true,
}: UseLibraryBrowseOptions): UseLibraryBrowseResult {
  const [selectedService, setSelectedService] = useState<TrackSource | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  // In-memory cache for playlist tracks (cleared on unmount)
  const tracksCacheRef = useRef<Record<string, Track[]>>({});

  const connectedSources = useMemo(
    () => getConnectedSources(connectedServices),
    [connectedServices],
  );

  // Auto-select first connected service
  useEffect(() => {
    if (autoSelect && !selectedService && connectedSources.length > 0) {
      setSelectedService(connectedSources[0]);
    }
  }, [autoSelect, selectedService, connectedSources]);

  // ─── Fetch playlists ──────────────────────────────────────

  const fetchPlaylists = useCallback(async (service: TrackSource, forceRefresh = false) => {
    setPlaylistsLoading(true);
    setSelectedPlaylist(null);
    setTracks([]);

    // Check cache first (unless force-refreshing)
    if (enableCache && !forceRefresh) {
      const cached = await getCachedPlaylists(service);
      if (cached) {
        setPlaylists(cached);
        setPlaylistsLoading(false);
        return;
      }
    }

    const adapters = getAllConnectedAdapters(connectedServices);
    const adapter = adapters.find((a) => a.serviceName === service);
    if (!adapter?.getUserPlaylists) {
      setPlaylists([]);
      setPlaylistsLoading(false);
      return;
    }

    try {
      const result = await adapter.getUserPlaylists();
      setPlaylists(result);
      if (enableCache) {
        await setCachedPlaylists(service, result);
      }
    } catch {
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  }, [connectedServices, enableCache]);

  // Fetch when selected service changes
  useEffect(() => {
    if (selectedService) {
      fetchPlaylists(selectedService);
    }
  }, [selectedService, fetchPlaylists]);

  // ─── Fetch playlist tracks ────────────────────────────────

  const selectPlaylist = useCallback(async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);

    // Check in-memory cache
    if (tracksCacheRef.current[playlist.id]) {
      setTracks(tracksCacheRef.current[playlist.id]);
      return;
    }

    setTracksLoading(true);
    const adapters = getAllConnectedAdapters(connectedServices);
    const adapter = adapters.find((a) => a.serviceName === playlist.source);

    if (!adapter?.getPlaylistTracks) {
      setTracks([]);
      setTracksLoading(false);
      return;
    }

    try {
      const result = await adapter.getPlaylistTracks(playlist.id);
      setTracks(result);
      tracksCacheRef.current[playlist.id] = result;
    } catch {
      setTracks([]);
    } finally {
      setTracksLoading(false);
    }
  }, [connectedServices]);

  // ─── Actions ──────────────────────────────────────────────

  const selectService = useCallback((service: TrackSource) => {
    setSelectedService(service);
    setSelectedPlaylist(null);
    setTracks([]);
  }, []);

  const clearPlaylist = useCallback(() => {
    setSelectedPlaylist(null);
    setTracks([]);
  }, []);

  const refreshPlaylists = useCallback(() => {
    if (selectedService) {
      fetchPlaylists(selectedService, true);
    }
  }, [selectedService, fetchPlaylists]);

  return {
    connectedSources,
    selectedService,
    selectService,
    playlists,
    playlistsLoading,
    selectedPlaylist,
    selectPlaylist,
    clearPlaylist,
    tracks,
    tracksLoading,
    refreshPlaylists,
  };
}
