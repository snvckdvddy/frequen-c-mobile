/**
 * FavoritesContext — App-wide favorites provider.
 *
 * Wraps useFavorites hook in a context so every screen/component
 * shares the same in-memory state + AsyncStorage persistence.
 */

import React, { createContext, useContext } from 'react';
import { useFavorites } from '../hooks/useFavorites';
import type { Track, FavoriteTrack } from '../types';

interface FavoritesContextValue {
  favorites: FavoriteTrack[];
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (track: Track) => void;
  addFavorite: (track: Track) => void;
  removeFavorite: (trackId: string) => void;
  isLoaded: boolean;
}

const FavoritesCtx = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const value = useFavorites();
  return <FavoritesCtx.Provider value={value}>{children}</FavoritesCtx.Provider>;
}

export function useFavoritesContext(): FavoritesContextValue {
  const ctx = useContext(FavoritesCtx);
  if (!ctx) {
    throw new Error('useFavoritesContext must be used within FavoritesProvider');
  }
  return ctx;
}

export default FavoritesProvider;
