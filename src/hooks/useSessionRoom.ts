import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useActiveSession } from "../contexts/ActiveSessionContext";
import { useCV } from "../hooks/useCV";
import { tapMedium, tapLight, tapHeavy } from "../utils/haptics";
import { showToast } from "../components/ui";
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
  type PlaybackState,
} from "../services/playbackEngine";
import { notifyTrackChanged } from "../services/notifications";
import { USE_MOCKS } from "../services/config";

const DEFAULT_PLAYBACK_STATE: PlaybackState = {
  isPlaying: false,
  currentTrackId: null,
  elapsed: 0,
  duration: 0,
  progress: 0,
  isLoading: false,
  error: null,
};

function normalizeCurrentTrack(
  track: Track | QueueTrack | null | undefined,
  fallbackAddedAt: string,
  fallbackAddedById = "",
): QueueTrack | null {
  if (!track) return null;

  // Track and QueueTrack share shape at runtime (server sends both as plain objects).
  // Cast once to access QueueTrack-only fields safely with fallback defaults.
  const qt = track as QueueTrack;

  const rawAddedBy = qt.addedBy;
  const addedById =
    qt.addedById ||
    rawAddedBy?.userId ||
    fallbackAddedById;

  const addedBy = rawAddedBy
    ? {
        userId: rawAddedBy.userId || addedById,
        username: rawAddedBy.username || "",
      }
    : undefined;

  return {
    ...qt,
    ...(addedBy ? { addedBy } : {}),
    addedById,
    addedAt: qt.addedAt || fallbackAddedAt,
    votes: qt.votes ?? 0,
    voltageBoost: qt.voltageBoost ?? 0,
    reactions: qt.reactions ?? [],
  };
}

function buildLiveQueue(
  currentTrack: QueueTrack | null,
  serverQueue: QueueTrack[],
): QueueTrack[] {
  if (!currentTrack) return serverQueue;
  return [
    currentTrack,
    ...serverQueue.filter((track) => track.id !== currentTrack.id),
  ];
}

export function useSessionRoom(sessionId: string) {
  const { user } = useAuth();
  const { setActiveSession, clearActiveSession } = useActiveSession();
  const cv = useCV();

  const [session, setSession] = useState<Session | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [suggestedQueue, setSuggestedQueue] = useState<QueueTrack[]>([]);
  const [playedHistory, setPlayedHistory] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [playback, setPlayback] = useState<PlaybackState>(DEFAULT_PLAYBACK_STATE);
  const [reloadNonce, setReloadNonce] = useState(0);

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

  // Ref so the behaviors effect's track-added handler always reads the latest
  // suggestedQueue without needing it as a dependency (avoids listener churn).
  const suggestedQueueRef = useRef<QueueTrack[]>([]);
  suggestedQueueRef.current = suggestedQueue;

  // Ref for reading current queue state outside of React state cycle
  // (used in advanceQueue to determine next-up title for toast).
  const queueRef = useRef<QueueTrack[]>([]);
  queueRef.current = queue;
  const MAX_PLAYED_HISTORY = 50;

  const advanceQueue = useCallback(() => {
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    // Read the current queue snapshot BEFORE the state update so we can
    // show a "preview ended" toast without side effects inside the updater.
    const currentQ = queueRef.current;
    const finishedTitle = currentQ[0]?.title ?? null;
    const nextTrack = currentQ[1] ?? null;

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

    // Show in-app toast so users know a preview ended and the queue advanced.
    // This explains why "new adds" seem to displace older queued tracks —
    // the 30-second iTunes preview already played and consumed the prior track.
    if (finishedTitle) {
      const toastText = nextTrack
        ? `⏭ Preview ended · Next: ${nextTrack.title}`
        : `⏭ Preview ended · Queue is empty`;
      const toastId = `advance_${Date.now()}`;
      setToasts((prev) => [
        ...prev,
        { id: toastId, text: toastText, type: 'system' as const },
      ]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== toastId)),
        3500,
      );
    }
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
    if (!sessionId) {
      setSession(null);
      setQueue([]);
      setSuggestedQueue([]);
      setPlayedHistory([]);
      setListeners([]);
      setToasts([]);
      setError(null);
      setBounceVisible(false);
      setSkipVoteState(null);
      setPhaseCancelShield(null);
      setPlayback(DEFAULT_PLAYBACK_STATE);
      setLoading(false);
      return;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let mounted = true;

    async function init() {
      try {
        setError(null);
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
        const sessionCreatedAt = s.createdAt;
        const sessionHostId = s.hostId;

        // Build lastCurrentTrack BEFORE setQueue so it can sit at queue[0].
        // queue[0] === now-playing is the invariant MiniPlayer and QueueTrackCard
        // (isNowPlaying={index===0}) both depend on.
        let lastCurrentTrack: QueueTrack | null = normalizeCurrentTrack(
          s.currentTrack,
          sessionCreatedAt,
          sessionHostId,
        );
        let lastQueue: QueueTrack[] = initialQueue;
        setQueue(buildLiveQueue(lastCurrentTrack, initialQueue));

        const sock = await connectSocket();
        if (!mounted) return;

        // Surface socket connection issues — socket?.emit() silently no-ops
        // if socket is null, so a failed connection means queue ops do nothing.
        if (!sock && !USE_MOCKS) {
          console.warn('[useSessionRoom] Socket connection returned null — queue operations will not work');
          showToast('Live connection failed. Queue updates may not work.', 'warning', '!');
        }

        socketUnsubsRef.current = [
          onSessionEvent("queue-updated", (newQueue) => {
            if (!mounted) return;
            lastQueue = newQueue.filter(
              (track) => track.id !== lastCurrentTrack?.id,
            );
            setQueue(buildLiveQueue(lastCurrentTrack, lastQueue));
          }),
          onSessionEvent("track-changed", (currentTrack) => {
            if (!mounted) return;
            setSkipVoteState(null);
            setPhaseCancelShield(null);
            lastCurrentTrack = normalizeCurrentTrack(
              currentTrack,
              sessionCreatedAt,
              sessionHostId,
            );
            setQueue(buildLiveQueue(lastCurrentTrack, lastQueue));
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
            // Always rebuild queue with currentTrack at [0].
            // The old code only set currentTrack when queue was empty — this
            // meant queue[0] was never the now-playing track when both existed,
            // breaking MiniPlayer visibility and the QueueTrackCard isNowPlaying flag.
            const serverQueue: QueueTrack[] = state.queue || [];
            const serverCurrentTrack = normalizeCurrentTrack(
              state.currentTrack,
              sessionCreatedAt,
              state.hostId || sessionHostId,
            );
            // Keep closure vars in sync so subsequent queue-updated events
            // reconstruct correctly with the right lastCurrentTrack.
            lastCurrentTrack = serverCurrentTrack;
            lastQueue = serverQueue.filter(
              (track) => track.id !== serverCurrentTrack?.id,
            );
            setQueue(buildLiveQueue(serverCurrentTrack, lastQueue));
            if (state.suggestedQueue) setSuggestedQueue(state.suggestedQueue);
            if (state.participants) setListeners(state.participants);
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
          onSessionEvent("playback:stateChange", (data) => {
            if (!mounted) return;
            const isPlaying = data.state === "playing";
            setPlayback((prev) => ({
              ...prev,
              isPlaying,
              elapsed: data.position || prev.elapsed,
            }));
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
          // The backend has emitted participant-joined/-left since day
          // one, but nothing here subscribed — hosts never saw guests
          // arrive in real time (2026-07-25 two-device finding). The
          // joining device still gets the full roster via room-state;
          // these keep everyone ELSE's roster live.
          onSessionEvent("participant-joined", (participant) => {
            if (!mounted || !participant?.userId) return;
            setListeners((prev) =>
              prev.some((l) => l.userId === participant.userId)
                ? prev
                : [...prev, participant],
            );
          }),
          onSessionEvent("participant-left", (data) => {
            if (!mounted || !data?.userId) return;
            setListeners((prev) =>
              prev.filter((l) => l.userId !== data.userId),
            );
          }),
          // The server emits 'error' from 33 rejection paths (not the
          // host, insufficient CV, session ended, toggle disabled...)
          // and until 2026-07-25 nothing listened — every rejected
          // action was a silently dead button.
          onSessionEvent("error", (data) => {
            if (!mounted || !data?.message) return;
            showToast(data.message, "error", "!");
          }),
        ];

        if (user) {
          joinSession(sessionId, user.id, user.username);
        }
      } catch (err: unknown) {
        const message = (err instanceof Error ? err.message : null) || "Could not load session.";
        if (!mounted) return;
        setError(message);
        const isTransientInfraError =
          /request timed out|connection error: timeout|\[socket\]/i.test(message);
        if (!isTransientInfraError) {
          showToast(message, "error", "!");
        }
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
  }, [sessionId, reloadNonce]);

  // ─── Mock socket listeners (behavior-aware via queueEngine) ──
  useEffect(() => {
    if (!sessionId) return;
    const behaviors: RoomBehaviors = session?.behaviors || DEFAULT_BEHAVIORS;
    const hostId = session?.hostId || "";

    const unsubs = [
      onSessionEvent("track-added", (track: QueueTrack) => {
        if (!USE_MOCKS) return;
        setQueue((prevQ) => {
          // Dedup guard — queue-updated may have already applied this track
          // (backend emits both events; whichever arrives first wins)
          if (prevQ.some((t) => t.id === track.id)) return prevQ;
          const result = addTrackToQueue(
            prevQ,
            suggestedQueueRef.current,
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
        if (!USE_MOCKS) return;
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
        if (USE_MOCKS && data?.userId !== user?.id) {
          advanceQueue();
        }
      }),
      onSessionEvent("track-removed", (data) => {
        if (!USE_MOCKS) return;
        setQueue((prev) => prev.filter((t) => t.id !== data.trackId));
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
        if (!USE_MOCKS) return;
        setSuggestedQueue((prev) => prev.filter((t) => t.id !== data.trackId));
        if (data.track) {
          setQueue((prev) => [...prev, { ...data.track, status: "approved" }]);
        }
      }),
      onSessionEvent("track-rejected", (data) => {
        if (!USE_MOCKS) return;
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
        if (USE_MOCKS && !data.behaviors.requiresApproval) {
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
    cv,
    // suggestedQueue intentionally omitted — accessed via suggestedQueueRef.current
    // to prevent full listener teardown/rebuild on every approval-queue change.
  ]); // Needs cv for earn/sync updates

  // Guests receive isPlaying + elapsed over the socket at ~1Hz, but no
  // duration — only the host's engine knows it. Derive duration from
  // the now-playing track (buildLiveQueue pins it at queue[0]) and
  // recompute progress so guest playheads sweep instead of sticking at
  // 0 (2026-07-25 two-device finding). Host values pass through
  // untouched whenever the engine already supplied a duration.
  const playbackDuration = playback.duration || queue[0]?.duration || 0;
  const derivedPlayback: PlaybackState = {
    ...playback,
    duration: playbackDuration,
    progress: playbackDuration > 0
      ? Math.min(1, playback.elapsed / playbackDuration)
      : playback.progress,
  };

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
    error,
    setError,
    listeners,
    setListeners,
    toasts,
    setToasts,
    playback: derivedPlayback,
    setPlayback,
    bounceVisible,
    setBounceVisible,
    skipVoteState,
    setSkipVoteState,
    phaseCancelShield,
    setPhaseCancelShield,
    retrySession: () => {
      setLoading(true);
      setError(null);
      setReloadNonce((prev) => prev + 1);
    },
    advanceQueue,
  };
}
