import { useEffect, useState, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { useActiveSession } from "../contexts/ActiveSessionContext";
import { useCV } from "../hooks/useCV";
import { tapMedium, tapLight, tapHeavy } from "../utils/haptics";
import type { ToastMessage } from "../components/ListenerPresence";
import type {
  Session,
  QueueTrack,
  Track,
  RoomMode,
  Listener,
  RoomBehaviors,
} from "../types";
import { DEFAULT_BEHAVIORS, BEHAVIOR_PRESETS } from "../types";
import api, { sessionApi } from "../services/api";
import {
  connectSocket,
  joinSession,
  leaveSession,
  onSessionEvent,
} from "../services/socket";
import { addTrackToQueue, applyVote } from "../services/queueEngine";
import {
  stop as stopPlayback,
  togglePlayPause,
  type PlaybackState,
} from "../services/playbackEngine";
import { notifyTrackChanged } from "../services/notifications";
import { USE_MOCKS } from "../services/config";

export function useSessionRoom(sessionId: string) {
  const { user } = useAuth();
  const { setActiveSession, clearActiveSession } = useActiveSession();
  const cv = useCV();

  const [session, setSession] = useState<Session | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [suggestedQueue, setSuggestedQueue] = useState<QueueTrack[]>([]);
  const [playedHistory, setPlayedHistory] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false,
    currentTrackId: null,
    elapsed: 0,
    duration: 0,
    progress: 0,
    isLoading: false,
    error: null,
  });

  // Master Bounce (session receipt)
  const [bounceVisible, setBounceVisible] = useState(false);

  // Skip-vote state (voteRequired rooms)
  const [skipVoteState, setSkipVoteState] = useState<{
    votes: number;
    threshold: number;
    participants: number;
    voters: string[];
  } | null>(null);

  // Phase Cancel shield state
  const [phaseCancelShield, setPhaseCancelShield] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  // Guards against double-removal (skip + auto-advance race)
  const isAdvancingRef = useRef(false);
  const MAX_PLAYED_HISTORY = 50;

  const advanceQueue = useCallback(() => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    setQueue((prev) => {
      if (prev.length === 0) {
        isAdvancingRef.current = false;
        return prev;
      }
      const finished = prev[0];
      if (finished) {
        setPlayedHistory((hist) =>
          [finished, ...hist].slice(0, MAX_PLAYED_HISTORY),
        );
        if (
          finished.duration > 30 &&
          !!user?.connectedServices?.lastfm?.connected
        ) {
          api.integrations
            .scrobble(
              finished.title,
              finished.artist,
              Math.floor(Date.now() / 1000) - Math.floor(finished.duration),
            )
            .catch(() => {});
        }
      }
      const next = prev.slice(1);
      if (next.length > 0) {
        notifyTrackChanged(next[0].title, next[0].artist, sessionId).catch(
          () => {},
        );
      }
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 300);
      return next;
    });
  }, [sessionId, user]);

  // In mock/testing mode, persist local queue state
  useEffect(() => {
    if (!USE_MOCKS || !sessionId || !session) return;
    sessionApi
      .syncLocalSession(sessionId, {
        queue,
        currentTrack: queue[0],
        listeners,
      })
      .catch(() => {});
  }, [queue, listeners, sessionId, session]);

  // ─── Load session & connect socket ──────────────────────
  const socketUnsubsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { session: s } = await sessionApi.get(sessionId);
        if (!mounted) return;
        setSession(s);
        setActiveSession({
          sessionId: s.id,
          sessionName: s.name,
          roomMode: s.roomMode,
          behaviors: s.behaviors || {
            ...DEFAULT_BEHAVIORS,
            ...BEHAVIOR_PRESETS[s.roomMode],
          },
          hostId: s.hostId,
        });
        const baseListeners: Listener[] = s.listeners || [];
        const selfInList = baseListeners.some(
          (l: Listener) => l.userId === user?.id,
        );
        setListeners(
          selfInList || !user
            ? baseListeners
            : [{ userId: user.id, username: user.username }, ...baseListeners],
        );
        const initialQueue: QueueTrack[] = (s.queue || []).map((t: Track) => ({
          ...t,
          addedById: t.addedBy?.userId || "",
          addedAt: s.createdAt,
        }));
        setQueue(initialQueue);

        await connectSocket();
        if (!mounted) return;

        let lastCurrentTrack: QueueTrack | null = s.currentTrack
          ? ({
              ...s.currentTrack,
              addedBy: {
                userId: (s.currentTrack as any).addedBy?.id || "",
                username: (s.currentTrack as any).addedBy?.username || "",
              },
              addedById: (s.currentTrack as any).addedBy?.id || "",
              addedAt: s.createdAt,
              votes: 0,
              voltageBoost: 0,
              reactions: [],
            } as QueueTrack)
          : null;
        let lastQueue: QueueTrack[] = initialQueue;

        socketUnsubsRef.current = [
          onSessionEvent("queue:updated", (newQueue) => {
            if (!mounted) return;
            lastQueue = newQueue;
            setQueue(
              lastCurrentTrack ? [lastCurrentTrack, ...newQueue] : newQueue,
            );
          }),
          onSessionEvent("session:current_track_updated", (currentTrack) => {
            if (!mounted) return;
            lastCurrentTrack = currentTrack;
            setQueue(currentTrack ? [currentTrack, ...lastQueue] : lastQueue);
          }),
          onSessionEvent("session:playback_state_updated", (data) => {
            if (!mounted) return;
            setPlayback((prev) => ({ ...prev, isPlaying: data.isPlaying }));
          }),
          onSessionEvent("session-updated", (update) => {
            if (mounted)
              setSession((prev) => (prev ? { ...prev, ...update } : null));
          }),
          onSessionEvent("room-state", (state) => {
            if (!mounted) return;
            if (state.roomMode || state.hostId || state.behaviors) {
              setSession((prev) =>
                prev
                  ? {
                      ...prev,
                      ...(state.roomMode
                        ? { roomMode: state.roomMode as RoomMode }
                        : {}),
                      ...(state.behaviors
                        ? { behaviors: state.behaviors }
                        : {}),
                      ...(state.hostId ? { hostId: state.hostId } : {}),
                    }
                  : prev,
              );
            }
            if (state.queue) setQueue(state.queue);
            if (state.suggestedQueue) setSuggestedQueue(state.suggestedQueue);
            if (state.participants) setListeners(state.participants);
            if (
              state.currentTrack &&
              (!state.queue || state.queue.length === 0)
            ) {
              setQueue([
                {
                  ...state.currentTrack,
                  addedById:
                    (state.currentTrack as any).addedById || state.hostId || "",
                  addedAt:
                    (state.currentTrack as any).addedAt ||
                    new Date().toISOString(),
                } as QueueTrack,
              ]);
            }
            if (state.playback && state.playback.state !== "stopped") {
              const serverPos = state.playback.position || 0;
              const serverTimestamp = state.playback.timestamp || Date.now();
              const drift = (Date.now() - serverTimestamp) / 1000;
              const correctedPos =
                state.playback.state === "playing"
                  ? serverPos + drift
                  : serverPos;
              setPlayback((prev) => ({
                ...prev,
                isPlaying: state.playback.state === "playing",
                elapsed: Math.max(0, correctedPos),
              }));
            }
          }),
          onSessionEvent("track-pending", (data) => {
            if (!mounted || !data?.track) return;
            setSuggestedQueue((prev) => {
              if (prev.some((t) => t.id === data.track.id)) return prev;
              return [...prev, { ...data.track, status: "pending" as const }];
            });
          }),
          onSessionEvent("track-changed", (track) => {
            if (!mounted) return;
            setSkipVoteState(null);
            setPhaseCancelShield(null);
            if (track) {
              setQueue((prev) => {
                if (prev[0]?.id === track.id) return prev;
                const filtered = prev.filter((t) => t.id !== track.id);
                return [
                  track as QueueTrack,
                  ...filtered.slice(filtered[0] ? 1 : 0),
                ];
              });
            }
          }),
          onSessionEvent("playback:stateChange", (data) => {
            if (!mounted) return;
            const isPlaying = data.state === "playing";
            setPlayback((prev) => ({
              ...prev,
              isPlaying,
              elapsed: data.position || prev.elapsed,
            }));
            if (isPlaying !== playback.isPlaying) {
              togglePlayPause();
            }
          }),
          onSessionEvent("playback:seeked", (data) => {
            if (!mounted) return;
            setPlayback((prev) => ({
              ...prev,
              elapsed: data.position || 0,
            }));
          }),
          onSessionEvent("reaction-received", (data) => {
            if (!mounted) return;
            setQueue((prev) =>
              prev.map((t) => {
                if (t.id !== data.trackId) return t;
                const existing = t.reactions || [];
                const hasReaction = existing.some(
                  (r) => r.userId === data.userId && r.type === data.type,
                );
                return {
                  ...t,
                  reactions: hasReaction
                    ? existing.filter(
                        (r) =>
                          !(r.userId === data.userId && r.type === data.type),
                      )
                    : [
                        ...existing,
                        {
                          userId: data.userId,
                          type: data.type as "fire" | "vibe" | "skip",
                        },
                      ],
                };
              }),
            );
          }),
        ];

        if (user) {
          joinSession(sessionId, user.id, user.username);
        }
      } catch (err: any) {
        Alert.alert("Error", err.message || "Could not load session.");
        // If an Error occurs, caller should handle navigation
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
      socketUnsubsRef.current.forEach((fn) => fn());
      socketUnsubsRef.current = [];
      if (user) leaveSession(sessionId, user.id);
      clearActiveSession();
    };
  }, [sessionId]);

  // ─── Mock socket listeners (behavior-aware via queueEngine) ──
  useEffect(() => {
    const behaviors: RoomBehaviors = session?.behaviors || DEFAULT_BEHAVIORS;
    const hostId = session?.hostId || "";

    const unsubs = [
      onSessionEvent("track-added", (track: QueueTrack) => {
        setQueue((prevQ) => {
          const result = addTrackToQueue(
            prevQ,
            suggestedQueue,
            track,
            behaviors,
            hostId,
          );
          if (result.destination === "suggested") {
            setSuggestedQueue(result.suggestedQueue);
            return prevQ;
          }
          return result.queue;
        });
      }),
      onSessionEvent("vote-cast", (data) => {
        setQueue((prev) =>
          applyVote(
            prev,
            data.trackId,
            data.userId,
            (data.direction || 1) as 1 | -1,
            behaviors,
          ),
        );
      }),
      onSessionEvent("track-skipped", (data) => {
        setSkipVoteState(null);
        if (data?.userId !== user?.id) {
          advanceQueue();
        }
      }),
      onSessionEvent("skip-vote-update", (data) => {
        setSkipVoteState({
          votes: data.votes,
          threshold: data.threshold,
          participants: data.participants,
          voters: data.voters || [],
        });
      }),
      onSessionEvent("track-approved", (data) => {
        setSuggestedQueue((prev) => prev.filter((t) => t.id !== data.trackId));
        if (data.track) {
          setQueue((prev) => [...prev, { ...data.track, status: "approved" }]);
        }
      }),
      onSessionEvent("track-rejected", (data) => {
        setSuggestedQueue((prev) => prev.filter((t) => t.id !== data.trackId));
      }),
      onSessionEvent("mode-changed", (data) => {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                roomMode: data.roomMode as RoomMode,
                ...(data.behaviors ? { behaviors: data.behaviors } : {}),
              }
            : prev,
        );
        if (data.behaviors && !data.behaviors.requiresApproval) {
          setSuggestedQueue([]);
        }
        const toast: ToastMessage = {
          id: `mode_${Date.now()}`,
          text: `Preset → ${data.roomMode}`,
          type: "mode",
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== toast.id)),
          3000,
        );
        tapMedium();
      }),
      onSessionEvent("behaviors-updated", (data) => {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                behaviors: data.behaviors,
              }
            : prev,
        );
        if (!data.behaviors.requiresApproval) {
          setSuggestedQueue((prev) => {
            if (prev.length === 0) return prev;
            const approved = prev.map((t) => ({
              ...t,
              status: "approved" as const,
            }));
            setQueue((q) => [...q, ...approved]);
            return [];
          });
        }
        tapLight();
      }),
      onSessionEvent("pending-updated", (pendingQueue) => {
        setSuggestedQueue(pendingQueue);
      }),
      onSessionEvent("session-ended", () => {
        stopPlayback();
        clearActiveSession();
        setBounceVisible(true);
      }),
      onSessionEvent("cv:balance", (data) => {
        if (data.userId === user?.id) cv.syncBalance(data.balance);
      }),
      onSessionEvent("cv:earn", (data) => {
        if (data.userId === user?.id) cv.earn(data.amount, data.reason);
      }),
      onSessionEvent("phantom-power-activated", (data) => {
        const toast: ToastMessage = {
          id: `phantompower_${Date.now()}`,
          text: `⚡ ${data.username} used Phantom Power on "${data.trackTitle}" (+${data.voteBoost} votes)`,
          type: "system",
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== toast.id)),
          4000,
        );
        tapLight();
      }),
      onSessionEvent("overdrive-activated", (data) => {
        const toast: ToastMessage = {
          id: `overdrive_${Date.now()}`,
          text: `🔥 ${data.username} pushed "${data.trackTitle}" into OVERDRIVE`,
          type: "system",
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== toast.id)),
          4000,
        );
        tapHeavy();
      }),
      onSessionEvent("phase-cancel-active", (data) => {
        setPhaseCancelShield({ userId: data.userId, username: data.username });
        const toast: ToastMessage = {
          id: `phasecancel_${Date.now()}`,
          text: `🛡️ ${data.username} deployed a Phase Cancel Shield down!`,
          type: "system",
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(
          () => setToasts((prev) => prev.filter((t) => t.id !== toast.id)),
          4000,
        );
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [
    user,
    session?.behaviors,
    session?.hostId,
    sessionId,
    suggestedQueue,
    cv,
  ]); // Needs cv for earn/sync updates

  // Return the public interface of the hook
  return {
    session,
    setSession,
    queue,
    setQueue,
    suggestedQueue,
    setSuggestedQueue,
    playedHistory,
    setPlayedHistory,
    loading,
    setLoading,
    listeners,
    setListeners,
    toasts,
    setToasts,
    playback,
    setPlayback,
    bounceVisible,
    setBounceVisible,
    skipVoteState,
    setSkipVoteState,
    phaseCancelShield,
    setPhaseCancelShield,
    advanceQueue,
  };
}
