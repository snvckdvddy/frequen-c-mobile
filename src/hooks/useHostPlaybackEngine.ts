/**
 * useHostPlaybackEngine — host-only audio playback wiring
 * ─────────────────────────────────────────────────────────────
 * Mounted by GlobalSessionRoomProvider (NOT SessionRoomScreen): audio
 * follows the session, not the screen. The host can minimize the room
 * or browse other tabs without interrupting the party. It lived in the
 * screen until 2026-07-25, when its unmount cleanup was found to be
 * the "music stops when the host goes Home" bug.
 *
 * Encapsulates the effects that connect the queue to the playback
 * engine:
 *
 *   1. Subscribe to onProgress → update playback state + broadcast
 *   2. Load tracks when queue[0] changes (host only)
 *   3. Advance queue when track ends (host only)
 *   4. Stop the engine when this device stops being host
 *      (session ended/left — isHost flips false)
 *
 * Only the host device plays audio. Non-host users receive playback
 * state via socket events. All effects guard on `isHost`.
 */

import { useEffect, useRef } from 'react';
import {
  loadTrack, onProgress, onTrackEnd, stop as stopPlayback,
  type PlaybackState,
} from '../services/playbackEngine';
import { trackEnded, emitPlaybackState } from '../services/socket';
import api from '../services/api';
import type { QueueTrack } from '../types';

interface HostPlaybackParams {
  isHost: boolean;
  queue: QueueTrack[];
  sessionId: string;
  setPlayback: React.Dispatch<React.SetStateAction<PlaybackState>>;
  advanceQueue: () => void;
  lastfmConnected: boolean;
}

export function useHostPlaybackEngine({
  isHost,
  queue,
  sessionId,
  setPlayback,
  advanceQueue,
  lastfmConnected,
}: HostPlaybackParams): void {

  // ─── Progress subscription ─────────────────────────────
  // Host updates local state AND broadcasts to non-host users (~1s throttle)
  const lastEmitRef = useRef(0);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    if (!isHost) return;
    const unsub = onProgress((s) => {
      setPlayback(s);
      const now = Date.now();
      if (now - lastEmitRef.current >= 1000) {
        lastEmitRef.current = now;
        emitPlaybackState(
          sessionIdRef.current,
          s.isPlaying ? 'playing' : 'paused',
          s.elapsed,
        );
      }
    });
    return unsub;
  }, [setPlayback, isHost]);

  // Stop audio when this device stops being the host — isHost flips
  // false when the session ends or is left. Provider-mounted, so this
  // cleanup no longer fires on screen navigation.
  useEffect(() => {
    if (!isHost) return;
    return () => { stopPlayback(); };
  }, [isHost]);

  // ─── Load track when queue[0] changes ──────────────────
  const currentTrackRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost) return;

    const nowPlaying = queue[0] || null;
    if (nowPlaying && nowPlaying.id !== currentTrackRef.current) {
      currentTrackRef.current = nowPlaying.id;
      loadTrack(nowPlaying.id, nowPlaying.duration || 30, nowPlaying.previewUrl, nowPlaying.sourceId, nowPlaying.source);
      if (lastfmConnected) {
        api.integrations.updateNowPlaying(
          nowPlaying.title,
          nowPlaying.artist,
          nowPlaying.duration,
        ).catch(() => {});
      }
    } else if (!nowPlaying && currentTrackRef.current) {
      currentTrackRef.current = null;
      stopPlayback();
    }
  }, [queue, isHost, lastfmConnected]);

  // ─── Track end → advance queue + notify backend ────────
  useEffect(() => {
    if (!isHost) return;
    const unsub = onTrackEnd(() => {
      advanceQueue();
      trackEnded(sessionId);
    });
    return unsub;
  }, [advanceQueue, sessionId, isHost]);
}
