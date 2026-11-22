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
  ChatMessage,
} from "../types";
import { DEFAULT_BEHAVIORS, BEHAVIOR_PRESETS } from "../types";
import api, { sessionApi } from "../services/api";
import {
  clearActiveJoin,
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
import { USE_MOCKS } from "../services/config";
import {
  SessionReceiptLedger,
  hasPlayedLongEnough,
  receiptBelongsTo,
  type SessionReceipt,
} from "../utils/sessionReceipt";
import {
  describeTrackSkipped,
  resetPlaybackForTrackChange,
  resolveSyncedElapsed,
  shouldAnnounceTrackEnd,
  shouldResetGuestClock,
  type AdvanceReason,
} from "../utils/sessionRoomEvents";

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
  // Full chat transcript for the session, captured whether or not the
  // chat panel is open. Seeded from room-state (the server sends the
  // last 50 messages, previously discarded) and appended on every
  // chat-message. ChatPanel seeds itself from this on open, and the
  // transport deck derives its unread badge from its length.
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  // Mirror for socket handlers whose effect deps would otherwise
  // capture a stale roster (used by skip attribution).
  const listenersRef = useRef<Listener[]>([]);
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);

  // Guests only get ~1Hz playback syncs from the host; tick elapsed
  // locally between them so the playhead sweeps instead of stalling
  // whenever wifi hiccups. Host devices get engine-driven progress.
  const isHostDevice = !!user?.id && session?.hostId === user.id;
  // Mirror for socket handlers and advanceQueue, whose closures outlive a
  // render (only the host's device has an engine to end a track or to
  // drive the clock).
  const isHostDeviceRef = useRef(isHostDevice);
  isHostDeviceRef.current = isHostDevice;
  useEffect(() => {
    if (USE_MOCKS || !sessionId || isHostDevice) return;
    const tick = setInterval(() => {
      setPlayback((prev) =>
        prev.isPlaying ? { ...prev, elapsed: prev.elapsed + 1 } : prev,
      );
    }, 1000);
    return () => clearInterval(tick);
  }, [sessionId, isHostDevice]);
  const [reloadNonce, setReloadNonce] = useState(0);

  // Master Bounce (session receipt). A frozen snapshot stamped with the id
  // of the session it belongs to, built when that session ends. This used
  // to be a bare boolean that survived into the next room the user joined,
  // so the old receipt flashed up over the new room. Visibility is derived:
  // a receipt only shows while the hook is on the session it belongs to.
  const [receipt, setReceipt] = useState<SessionReceipt | null>(null);
  const bounceVisible = receiptBelongsTo(receipt, sessionId);

  // Latest session for socket handlers whose effect deps would otherwise
  // capture a stale copy (the receipt is built from it when the room ends).
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  // Running record of this session for the receipt. One ledger per session
  // id: a room switch starts a clean one, a retry of the same room keeps it.
  const ledgerRef = useRef<SessionReceiptLedger | null>(null);
  if (!sessionId) {
    ledgerRef.current = null;
  } else if (ledgerRef.current?.sessionId !== sessionId) {
    ledgerRef.current = new SessionReceiptLedger(sessionId);
  }

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

  // `reason` says why the queue is moving. Natural ends come from the host's
  // engine (the no-argument default); a skip passes 'skip' so the skipper is
  // announced by name (see the track-skipped handler) instead of a "preview
  // ended" toast that was never true.
  const advanceQueue = useCallback((reason: AdvanceReason = 'ended') => {
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
      setTimeout(() => {
        isAdvancingRef.current = false;
      }, 300);
      return next;
    });

    // Show in-app toast so users know a preview ended and the queue advanced.
    // This explains why "new adds" seem to displace older queued tracks —
    // the 30-second iTunes preview already played and consumed the prior track.
    // Host only, and never for a skip: a guest has no engine to end anything,
    // and a skip is announced by who skipped.
    if (finishedTitle && shouldAnnounceTrackEnd(reason, isHostDeviceRef.current)) {
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
  }, [user]);


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

  // This hook lives in a provider that outlives every screen, and the
  // header back button never clears connectionId, so the room can change
  // from A straight to B with no empty id in between. Reset the per-session
  // state on EVERY session change, not only when the id goes empty;
  // otherwise room A's roster, history, chat and receipt leak into room B
  // (a guest's second join opened on the previous room's receipt). The
  // retry path re-runs the load effect below without changing sessionId,
  // so a retry keeps what it has.
  useEffect(() => {
    setSession(null);
    setQueue([]);
    setSuggestedQueue([]);
    setPlayedHistory([]);
    setListeners([]);
    setChatLog([]);
    setToasts([]);
    setError(null);
    setReceipt(null);
    setSkipVoteState(null);
    setPhaseCancelShield(null);
    setPlayback(DEFAULT_PLAYBACK_STATE);
    // A real id means a load is about to start; an empty one means idle.
    setLoading(!!sessionId);
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
            const previousTrackId = lastCurrentTrack?.id ?? null;
            lastCurrentTrack = normalizeCurrentTrack(
              currentTrack,
              sessionCreatedAt,
              sessionHostId,
            );
            setQueue(buildLiveQueue(lastCurrentTrack, lastQueue));
            // A guest's clock only learns the new track's position from the
            // host's next report, which can be seconds away while the host
            // loads it; until then the old song's elapsed time kept ticking
            // under the new title. Start the new track at zero. The host's
            // clock is engine-driven and replaced wholesale, so leave it.
            const nextTrackId = lastCurrentTrack?.id ?? null;
            if (
              shouldResetGuestClock({
                isHostDevice: isHostDeviceRef.current,
                previousTrackId,
                nextTrackId,
              })
            ) {
              const hasTrack = nextTrackId !== null;
              setPlayback((prev) => resetPlaybackForTrackChange(prev, hasTrack));
            }
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
            if (state.roomMode || state.hostId || state.behaviors || state.hostUsername) {
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
                      ...(state.hostUsername
                        ? { hostUsername: state.hostUsername }
                        : {}),
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
            // The server sends the last 50 chat messages on join;
            // they were fetched and discarded until 2026-07-25.
            if (state.chat) setChatLog(state.chat);
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
              // Not `data.position || prev.elapsed`: a report of 0 (the
              // host just started a track) is a real position, and the
              // falsy check kept the previous song's elapsed time.
              elapsed: resolveSyncedElapsed(data.position, prev.elapsed),
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
            // After a network blip the old socket can time out on the
            // server and broadcast our own departure to our new socket.
            // We are connected, so never drop ourselves from the roster.
            if (data.userId === user?.id) return;
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
          // Always-on chat capture: ChatPanel only subscribes while
          // open, so messages sent while it was closed were lost and
          // there was no unread signal.
          onSessionEvent("chat-message", (msg) => {
            if (!mounted || !msg?.id) return;
            setChatLog((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
            );
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
        if (USE_MOCKS) {
          if (data?.userId !== user?.id) advanceQueue('skip');
          return;
        }
        // Attribution: the server sends the skipper's user id (never a
        // username), so the name comes from the roster, falling back to
        // everyone the room has shown us. Shown to the skipper too: their
        // own device used to say "Preview ended" for a skip.
        const line = describeTrackSkipped(data, {
          selfId: user?.id,
          selfUsername: user?.username,
          lookupUsername: (userId) =>
            listenersRef.current.find((l) => l.userId === userId)?.username ||
            ledgerRef.current?.usernameFor(userId),
        });
        if (line) showToast(line, "info", "!");
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
      onSessionEvent("session-ended", (data) => {
        // Never build a receipt for a room other than the one this hook is on.
        if (data?.sessionId && data.sessionId !== sessionId) return;
        stopPlayback();
        clearActiveSession();
        clearActiveJoin();
        // Freeze the receipt NOW, from what the ledger saw during the
        // session. Building it later, from live state, is what produced
        // "Host", a shrunken head count and a render-time end stamp: the
        // host leaves the roster right after this event.
        const ledger = ledgerRef.current;
        if (ledger) {
          if (user) ledger.noteParticipant(user.id, user.username);
          ledger.noteParticipants(listenersRef.current);
          setReceipt(ledger.close(sessionRef.current, Date.now()));
        }
        // Flag the session dead so every surface reacts: the room
        // screen shows its receipt (or terminal state), the global
        // MiniPlayer hides, and reconnects stop rejoining. The toast
        // is the only signal a guest browsing another screen gets.
        setSession((prev) => (prev ? { ...prev, isLive: false } : prev));
        showToast("The room has ended.", "info", "!");
      }),
      onSessionEvent("cv:balance", (data) => {
        if (data.userId === user?.id) cv.syncBalance(data.balance);
      }),
      onSessionEvent("cv:earn", (data) => {
        if (data.userId !== user?.id) return;
        cv.earn(data.amount, data.reason);
        // The receipt reports what this session earned, not the balance.
        ledgerRef.current?.noteCvEarned(data.amount);
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

  // ─── Receipt ledger feeds ───────────────────────────────
  // Both feeds are gated on the loaded session being THIS sessionId: on a
  // room switch the old room's roster and queue are still in state for a
  // render, and must never be credited to the new room's ledger.
  const loadedSessionId = session?.id ?? null;

  // Everyone who was ever on the roster counts as a participant. The live
  // roster shrinks as people leave (the host drops off it the moment they
  // end the room), so the head count has to be accumulated, not read at
  // the end.
  useEffect(() => {
    if (!sessionId || loadedSessionId !== sessionId) return;
    ledgerRef.current?.noteParticipants(listeners);
  }, [listeners, sessionId, loadedSessionId]);

  // A track counts as played once playback reached MIN_PLAYED_SECONDS on
  // it. Guests never ran the engine, so playedHistory (filled by
  // advanceQueue) stayed empty for them and the receipt could only ever
  // show the current track. On the host, the engine's clock lags queue[0]
  // for a moment after an advance; its currentTrackId says which track the
  // clock belongs to, so a stale elapsed time cannot credit the next track.
  const nowPlaying = queue[0] ?? null;
  useEffect(() => {
    if (!nowPlaying || !sessionId || loadedSessionId !== sessionId) return;
    if (
      hasPlayedLongEnough({
        isHostDevice,
        nowPlayingId: nowPlaying.id,
        clockTrackId: playback.currentTrackId,
        elapsedSeconds: playback.elapsed,
      })
    ) {
      ledgerRef.current?.noteTrackPlayed(nowPlaying);
    }
  }, [
    nowPlaying,
    playback.elapsed,
    playback.currentTrackId,
    isHostDevice,
    sessionId,
    loadedSessionId,
  ]);

  const dismissReceipt = useCallback(() => setReceipt(null), []);

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
    chatLog,
    bounceVisible,
    // The frozen receipt for the session this hook is on; null otherwise.
    receipt: bounceVisible ? receipt : null,
    dismissReceipt,
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
