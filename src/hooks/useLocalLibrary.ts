/**
 * useLocalLibrary
 * ─────────────────────────────────────────────────────────────
 * The device-audio list as screen state: loads the saved records, fills in ID3
 * titles and artists for files imported before tags were read, and exposes
 * import and remove. Used by the Library tab's Local segment and by the
 * in-room add-track sheet, so both show the same list from the same code and
 * an import in one reaches the other.
 */

import { useCallback, useEffect, useState } from 'react';
import { showToast } from '../components/ui';
import {
  backfillLocalTags,
  importLocalTracks,
  listLocalTracks,
  removeLocalTrack,
  subscribeToLocalLibrary,
  type LocalTrackRecord,
} from '../services/localLibrary';

export interface UseLocalLibraryOptions {
  /** Load the list. Pass false where the list is never shown (a guest in a room). Default true. */
  enabled?: boolean;
}

export interface UseLocalLibraryResult {
  tracks: LocalTrackRecord[];
  importing: boolean;
  /** Open the file picker and add what was chosen. */
  importTracks: () => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
}

export function useLocalLibrary({ enabled = true }: UseLocalLibraryOptions = {}): UseLocalLibraryResult {
  const [tracks, setTracks] = useState<LocalTrackRecord[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // The Library tab stays mounted while the room sheet opens over it, so an
    // import or removal made in one has to reach the other.
    const unsubscribe = subscribeToLocalLibrary((list) => {
      if (active) setTracks(list);
    });
    // Show the saved list right away, then fill in ID3 titles and artists for
    // files imported before tags were read (each file is checked only once).
    void listLocalTracks()
      .then((list) => {
        if (active) setTracks(list);
        return backfillLocalTags();
      })
      .then((list) => {
        if (active) setTracks(list);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled]);

  const importTracks = useCallback(async () => {
    setImporting(true);
    try {
      const next = await importLocalTracks();
      setTracks(next);
    } catch {
      showToast('Import failed. Try a different file.', 'error', '!');
    } finally {
      setImporting(false);
    }
  }, []);

  const removeTrack = useCallback(async (id: string) => {
    setTracks(await removeLocalTrack(id));
  }, []);

  return { tracks, importing, importTracks, removeTrack };
}
