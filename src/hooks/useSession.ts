/**
 * useSession Hook
 *
 * Encapsulates all session room logic:
 * - Fetches session data from API
 * - Manages socket connection lifecycle
 * - Handles real-time queue/session updates
 * - Provides action methods (addTrack, vote, react, share)
 *
 * This keeps SessionRoomScreen focused on UI.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Alert, Share } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import {
  connectSocket, joinSession, leaveSession, addToQueue,
  voteTrack, sendReaction, skipTrack, onSessionEvent,
} from '../services/socket';
import { tapMedium, tapLight, tapHeavy, notifySuccess } from '../utils/haptics';
import type { Session, QueueTrack, Track } from '../types';

interface UseSessionReturn {
  session: Session | null;
  queue: QueueTrack[];
  loading: boolean;
  error: string | null;
  currentTrack: QueueTrack | null;

  // Actions
  handleAddTrack: (track: Track) => void;
  handleVote: (trackId: string, direction: 1 | -1) => void;
  handleReaction: (trackId: string, type: 'fire' | 'vibe' | 'skip') => void;
  handleSkip: () => void;
  handleShare: () => void;
}

export function useSession(sessionId: string): UseSessionReturn {
  const { user } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // ─── Load session & connect socket ──────────────────────
  useEffect(() => {
    mountedRef.current = true;

    async function init() {
      try {
        const { session: s } = await sessionApi.get(sessionId);
        if (!mountedRef.current) return;
        setSession(s);
        // Map Track[] from API to QueueTrack[]
        const initialQueue: QueueTrack[] = (s.queue || []).map((t: Track) => ({
          ...t,
          addedById: t.addedBy?.userId || '',
          addedAt: s.createdAt,
        }));
        setQueue(initialQueue);

        await connectSocket();
        if (user) {
          joinSession(sessionId, user.id, user.username);
        }
      } catch (err: any) {
        if (mountedRef.current) {
          setError(err.message || 'Could not load session.');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    init();

    return () => {
      mountedRef.current = false;
      if (user) leaveSession(sessionId, user.id);
    };
  }, [sessionId, user]);

  // ─── Socket listeners ───────────────────────────────────
  useEffect(() => {
    const unsubs = [
      onSessionEvent('queue-updated', (newQueue) => {
        if (mountedRef.current) setQueue(newQueue);
      }),
      onSessionEvent('session-updated', (update) => {
        if (mountedRef.current) {
          setSession((prev) => prev ? { ...prev, ...update } : null);
        }
      }),
      // Mock-mode local events
      onSessionEvent('track-added', (track: QueueTrack) => {
        if (mountedRef.current) setQueue((prev) => [...prev, track]);
      }),
      onSessionEvent('vote-cast', (data) => {
        if (mountedRef.current) {
          setQueue((prev) =>
            prev.map((t) =>
              t.id === data.trackId
                ? { ...t, votes: (t.votes ?? 0) + data.direction }
                : t
            )
          );
        }
      }),
      onSessionEvent('reaction-local', (data) => {
        if (mountedRef.current) {
          setQueue((prev) =>
            prev.map((t) =>
              t.id === data.trackId
                ? {
                    ...t,
                    reactions: [
                      ...(t.reactions || []),
                      { userId: data.userId, type: data.type as 'fire' | 'vibe' | 'skip' },
                    ],
                  }
                : t
            )
          );
        }
      }),
      onSessionEvent('track-skipped', () => {
        if (mountedRef.current) setQueue((prev) => prev.slice(1));
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []);

  // ─── Actions ────────────────────────────────────────────

  const handleAddTrack = useCallback((track: Track) => {
    if (!user || !session) return;
    const queueTrack: QueueTrack = {
      ...track,
      addedBy: { userId: user.id, username: user.username },
      addedById: user.id,
      addedAt: new Date().toISOString(),
      votes: 0,
      voltageBoost: 0,
      reactions: [],
    };
    addToQueue(sessionId, queueTrack);
    notifySuccess();
  }, [user, session, sessionId]);

  const handleVote = useCallback((trackId: string, direction: 1 | -1) => {
    if (!user) return;
    tapMedium();
    voteTrack(sessionId, trackId, user.id, direction);
  }, [user, sessionId]);

  const handleReaction = useCallback((trackId: string, type: 'fire' | 'vibe' | 'skip') => {
    if (!user) return;
    tapLight();
    sendReaction(sessionId, trackId, user.id, type);
  }, [user, sessionId]);

  const handleSkip = useCallback(() => {
    if (!user || !session) return;
    // Only host can skip in spotlight mode
    if (session.roomMode === 'spotlight' && session.hostId !== user.id) {
      Alert.alert('Host Only', 'Only the host can skip tracks in Spotlight mode.');
      return;
    }
    tapHeavy();
    skipTrack(sessionId, user.id);
  }, [user, session, sessionId]);

  const handleShare = useCallback(() => {
    if (!session) return;
    Share.share({
      message: `Join my Frequen-C room "${session.name}"!\nCode: ${session.joinCode}`,
    });
  }, [session]);

  // ─── Derived state ──────────────────────────────────────
  const currentTrack: QueueTrack | null = session?.currentTrack
    ? {
        ...session.currentTrack,
        addedById: session.currentTrack.addedBy?.userId || '',
        addedAt: session.createdAt,
      }
    : queue[0] || null;

  return {
    session,
    queue,
    loading,
    error,
    currentTrack,
    handleAddTrack,
    handleVote,
    handleReaction,
    handleSkip,
    handleShare,
  };
}

export default useSession;
