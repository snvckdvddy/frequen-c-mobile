/**
 * Session Room Screen — The Mix Bus
 *
 * Central signal processing hub. All audio routes through here.
 *
 * Layout: Signal Path breadcrumb → Rhythm Channel (controls) →
 *         Filter Sweep search → Melody Channel (queue) → Mini player
 *
 * Research pillars active here:
 * - Social Choice Architecture (room mode governs queue physics)
 * - Room Mode Physics (waveform mode indicator)
 * - Contribution Visibility (who added what, when)
 * - Control Voltage Economy (votes, boosts, reactions)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Share, Keyboard, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, RoomModeBadge, WaveformIcon, SignalPathBreadcrumb } from '../components/ui';
import type { BreadcrumbNode } from '../components/ui/SignalPathBreadcrumb';
import { useAuth } from '../contexts/AuthContext';
import api, { sessionApi } from '../services/api';
import {
  connectSocket, joinSession, leaveSession, quitSession, addToQueue,
  voteTrack, sendReaction, skipTrack, trackEnded,
  approveTrackEvent, rejectTrackEvent, changeModeEvent, endSessionEvent,
  onSessionEvent, spendCV, duelVote, submitForecast, phantomPower,
  overdrive, phaseCancel,
} from '../services/socket';
import {
  addTrackToQueue, applyVote, skipCurrentTrack, moveTrack as moveTrackEngine,
  approveTrack as approveTrackEngine, rejectTrack as rejectTrackEngine,
} from '../services/queueEngine';
import {
  loadTrack, onProgress, onTrackEnd, stop as stopPlayback,
  togglePlayPause, type PlaybackState,
} from '../services/playbackEngine';
import { NowPlayingSheet } from '../components/NowPlayingSheet';
import {
  ListenerBar, ListenerDrawer, JoinLeaveToast, type ToastMessage,
} from '../components/ListenerPresence';
import { ChatPanel } from '../components/ChatPanel';
import { useSearch } from '../hooks/useSearch';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { useActiveSession } from '../contexts/ActiveSessionContext';
import { useFavoritesContext } from '../contexts/FavoritesContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { tapMedium, tapLight, tapHeavy, notifySuccess } from '../utils/haptics';
import { notifyParticipantJoined, notifyTrackChanged } from '../services/notifications';
import type { Session, QueueTrack, Track, RoomMode, Listener } from '../types';
import { QueueTrackCard } from '../components/QueueTrackCard';
import { LyricsOverlay } from '../components/ui/LyricsOverlay';
import { DraggableQueue } from '../components/DraggableQueue';
import { SearchResultItem } from '../components/SearchResultItem';
import { MiniPlayer, MINI_PLAYER_HEIGHT } from '../components/MiniPlayer';
import { SuggestionCard } from '../components/SuggestionCard';
import { PlayedHistory } from '../components/PlayedHistory';
import { OfflineBanner } from '../components/OfflineBanner';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppState } from '../hooks/useAppState';
import { getGlobalLimiter } from '../utils/rateLimiter';
import { ADSRFadeIn, StepSequencer, TrackContextMenu, SwipeableRow } from '../components/ui';
import { QUEUE_ACTIONS, type ContextMenuAction } from '../components/ui/TrackContextMenu';
import { Skeleton, TrackCardSkeleton } from '../components/ui/Skeleton';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
// Layer 3-4: Social, Game, Economy, Environment
import { CrossfaderDuel } from '../components/CrossfaderDuel';
import { FrequencyForecast } from '../components/FrequencyForecast';
import { ResonanceEvent } from '../components/ResonanceEvent';
import { PhantomPower } from '../components/PhantomPower';
import { TransientEnter } from '../components/TransientEnter';
import { ReverbTail } from '../components/ReverbTail';
import { MasterBounce } from '../components/MasterBounce';
import { useCV } from '../hooks/useCV';

// ─── Signal Type Labels ──────────────────────────────────────

const modeLabel: Record<string, string> = {
  campfire: 'Sine',
  spotlight: 'Square',
  openFloor: 'Sawtooth',
};

const modeDesc: Record<string, string> = {
  campfire: 'Round-robin — tracks interleave by contributor',
  spotlight_host: 'You curate — approve or reject suggestions',
  spotlight_guest: 'Host curates — your adds need approval',
  openFloor: 'Democratic — votes reorder the queue',
};

// ─── Main Screen ─────────────────────────────────────────────

export function SessionRoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const sessionId = route.params?.sessionId;
  const { setActiveSession, clearActiveSession } = useActiveSession();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { isConnected } = useNetworkStatus();
  const searchInputRef = useRef<TextInput>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [suggestedQueue, setSuggestedQueue] = useState<QueueTrack[]>([]);
  const [playedHistory, setPlayedHistory] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [listenerDrawerOpen, setListenerDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [playback, setPlayback] = useState<PlaybackState>({
    isPlaying: false, currentTrackId: null,
    elapsed: 0, duration: 0, progress: 0,
    isLoading: false, error: null,
  });

  // ─── App state recovery (background → foreground) ──
  useAppState({
    onForeground: useCallback(() => {
      // Re-join the session to get fresh state after returning from background
      if (user?.id && sessionId) {
        joinSession(sessionId, user.id, user.username);
      }
    }, [user?.id, user?.username, sessionId]),
  });

  // ─── Layer 3-4: Social / Game / Economy / Environment state ──
  const cv = useCV();

  // Crossfader Duel
  const [duelState, setDuelState] = useState<{
    active: boolean;
    trackA: QueueTrack | null;
    trackB: QueueTrack | null;
    votes: { a: number; b: number };
    timeRemaining: number;
    totalTime: number;
    userVote: 'a' | 'b' | null;
  }>({ active: false, trackA: null, trackB: null, votes: { a: 0, b: 0 }, timeRemaining: 0, totalTime: 0, userVote: null });

  // Frequency Forecast
  const [forecastState, setForecastState] = useState<{
    active: boolean;
    candidates: QueueTrack[];
    reward: number;
    timeRemaining: number;
    userPick: string | null;
    lastResult: { predicted: string; actual: string; correct: boolean; earned: number } | null;
  }>({ active: false, candidates: [], reward: 0, timeRemaining: 0, userPick: null, lastResult: null });

  // Phase 6: Lyrics
  const [lyricsVisible, setLyricsVisible] = useState(false);

  // Resonance Event
  const [resonanceState, setResonanceState] = useState<{
    active: boolean;
    type: 'harmonic' | 'octave' | 'feedback';
    message: string;
    cvBonus: number;
  }>({ active: false, type: 'harmonic', message: '', cvBonus: 0 });

  // Transient Enter (user walk-on)
  const [transientUser, setTransientUser] = useState<{
    active: boolean;
    username: string;
  }>({ active: false, username: '' });

  // Reverb Tail (ghost presence)
  const [reverbTails, setReverbTails] = useState<Array<{
    userId: string;
    username: string;
    duration: number;
    active: boolean;
  }>>([]);

  // Phantom Power boost (per-track)
  const [phantomBoost, setPhantomBoost] = useState<{
    active: boolean;
    trackId: string | null;
    username: string;
    trackName: string;
  }>({ active: false, trackId: null, username: '', trackName: '' });

  // Master Bounce (session receipt)
  const [bounceVisible, setBounceVisible] = useState(false);
  const [sessionStartTime] = useState(Date.now());

  // Guards against double-removal (skip + auto-advance race)
  const isAdvancingRef = useRef(false);
  const MAX_PLAYED_HISTORY = 50;
  const { query, setQuery, results, isSearching, clearSearch } = useSearch();
  const { searches: recentSearches, addSearch: saveRecentSearch, removeSearch: removeRecentSearch } = useRecentSearches();

  // Shared queue advancement — moves queue[0] to history, advances to next.
  // Defined early so socket listeners + playback effects can reference it.
  const advanceQueue = useCallback(() => {
    if (isAdvancingRef.current) return; // prevent double-fire
    isAdvancingRef.current = true;

    setQueue((prev) => {
      if (prev.length === 0) {
        isAdvancingRef.current = false;
        return prev;
      }
      // Move finished track to history
      const finished = prev[0];
      if (finished) {
        setPlayedHistory((hist) => [finished, ...hist].slice(0, MAX_PLAYED_HISTORY));
        // Phase 6: Scrobble if $> 30s
        if (finished.duration > 30 && !!user?.connectedServices?.lastfm?.connected) {
          api.integrations.scrobble(
            finished.title,
            finished.artist,
            Math.floor(Date.now() / 1000) - Math.floor(finished.duration)
          ).catch(() => { });
        }
      }

      const next = prev.slice(1);
      // Notify about the new track (next[0]) if one exists
      if (next.length > 0) {
        notifyTrackChanged(next[0].title, next[0].artist, sessionId).catch(() => { });
      }
      // Reset guard after a short delay to allow new track to load
      setTimeout(() => { isAdvancingRef.current = false; }, 300);
      return next;
    });
  }, [sessionId]);

  // ─── Load session & connect socket ──────────────────────
  // Real-mode listener cleanup refs — stored here so the cleanup
  // function can detach them even though they're created async.
  const socketUnsubsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { session: s } = await sessionApi.get(sessionId);
        if (!mounted) return;
        setSession(s);
        // Track active session for Search → Add to Queue
        setActiveSession({
          sessionId: s.id,
          sessionName: s.name,
          roomMode: s.roomMode,
          hostId: s.hostId,
        });
        // Initialize listeners: include the current user (host or joiner) + session listeners
        const baseListeners: Listener[] = s.listeners || [];
        const selfInList = baseListeners.some((l: Listener) => l.userId === user?.id);
        setListeners(
          selfInList || !user
            ? baseListeners
            : [{ userId: user.id, username: user.username }, ...baseListeners]
        );
        const initialQueue: QueueTrack[] = (s.queue || []).map((t: Track) => ({
          ...t,
          addedById: t.addedBy?.userId || '',
          addedAt: s.createdAt,
        }));
        setQueue(initialQueue);

        // Connect socket FIRST, then attach listeners, then join
        await connectSocket();
        if (!mounted) return;

        // ── Real-mode socket listeners ──
        // MUST be set up AFTER connectSocket() resolves so socket is non-null.
        socketUnsubsRef.current = [
          onSessionEvent('queue-updated', (newQueue) => {
            if (mounted) setQueue(newQueue);
          }),
          onSessionEvent('session-updated', (update) => {
            if (mounted) setSession((prev) => prev ? { ...prev, ...update } : null);
          }),
          // Backend sends full room state on join — use it to hydrate queue + participants + suggestions
          onSessionEvent('room-state' as any, (state: any) => {
            if (!mounted) return;
            if (state.queue) setQueue(state.queue);
            if (state.suggestedQueue) setSuggestedQueue(state.suggestedQueue);
            if (state.participants) setListeners(state.participants);
            if (state.currentTrack && state.queue?.length === 0) {
              // If there's a current track but queue is empty, put it at front
              setQueue([state.currentTrack]);
            }
          }),
          // Spotlight mode: server notifies when a non-host adds a pending track
          onSessionEvent('track-pending' as any, (data: any) => {
            if (!mounted || !data?.track) return;
            setSuggestedQueue((prev) => {
              // Prevent duplicates
              if (prev.some((t) => t.id === data.track.id)) return prev;
              return [...prev, { ...data.track, status: 'pending' as const }];
            });
          }),
          onSessionEvent('track-changed' as any, (track: any) => {
            if (!mounted || !track) return;
            // track-changed fires when a new track becomes current
            // The queue-updated event will follow with the refreshed queue
          }),
          onSessionEvent('participant-joined' as any, (data: any) => {
            if (!mounted) return;
            setListeners((prev) => {
              if (prev.some((l) => l.userId === data.userId)) return prev;
              return [...prev, { userId: data.userId, username: data.username }];
            });
            setToasts((prev) => [...prev, { id: Date.now().toString(), text: `${data.username} joined`, type: 'join' as const }]);
          }),
          onSessionEvent('participant-left' as any, (data: any) => {
            if (!mounted) return;
            setListeners((prev) => prev.filter((l) => l.userId !== data.userId));
          }),
          // Real-mode reaction listener (backend emits 'reaction-received')
          onSessionEvent('reaction-received' as any, (data: any) => {
            if (!mounted) return;
            setQueue((prev) =>
              prev.map((t) => {
                if (t.id !== data.trackId) return t;
                const existing = t.reactions || [];
                const hasReaction = existing.some(
                  (r) => r.userId === data.userId && r.type === data.type
                );
                return {
                  ...t,
                  reactions: hasReaction
                    ? existing.filter((r) => !(r.userId === data.userId && r.type === data.type))
                    : [...existing, { userId: data.userId, type: data.type as 'fire' | 'vibe' | 'skip' }],
                };
              })
            );
          }),
          // Real-mode skip listener
          onSessionEvent('track-changed' as any, (_track: any) => {
            // When backend advances to next track, it broadcasts queue-updated too,
            // so we just need queue-updated (already handled above)
          }),
        ];

        // NOW join the room — backend will emit room-state back
        if (user) {
          joinSession(sessionId, user.id, user.username);
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Could not load session.');
        navigation.goBack();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
      // Detach all real-mode socket listeners
      socketUnsubsRef.current.forEach((fn) => fn());
      socketUnsubsRef.current = [];
      if (user) leaveSession(sessionId, user.id);
      clearActiveSession();
    };
  }, [sessionId]);

  // ─── Mock socket listeners (mode-aware via queueEngine) ──
  useEffect(() => {
    const roomMode: RoomMode = session?.roomMode || 'campfire';
    const hostId = session?.hostId || '';

    const unsubs = [
      onSessionEvent('track-added', (track: QueueTrack) => {
        // Engine decides where the track goes based on room mode.
        // We use refs-in-closures pattern: read both queues, set both.
        setQueue((prevQ) => {
          // For Spotlight non-host: track goes to suggested, main queue unchanged
          if (roomMode === 'spotlight' && track.addedById !== hostId) {
            setSuggestedQueue((prevS) => [...prevS, { ...track, status: 'pending' as const }]);
            return prevQ;
          }
          // For all other cases: run through engine for mode-specific ordering
          const result = addTrackToQueue(prevQ, [], track, roomMode, hostId);
          return result.queue;
        });
      }),
      onSessionEvent('vote-cast', (data) => {
        // Toggle-aware: engine handles dedup via votedBy map
        setQueue((prev) => applyVote(prev, data.trackId, data.userId, data.direction, roomMode));
      }),
      onSessionEvent('reaction-local', (data) => {
        // Toggle: if user already has this reaction type → remove it. Otherwise → add it.
        setQueue((prev) =>
          prev.map((t) => {
            if (t.id !== data.trackId) return t;
            const existing = t.reactions || [];
            const hasReaction = existing.some(
              (r) => r.userId === data.userId && r.type === data.type
            );
            return {
              ...t,
              reactions: hasReaction
                ? existing.filter((r) => !(r.userId === data.userId && r.type === data.type))
                : [...existing, { userId: data.userId, type: data.type as 'fire' | 'vibe' | 'skip' }],
            };
          })
        );
      }),
      onSessionEvent('track-skipped', (data) => {
        // Only advance if this skip came from another user
        // (our own skip is handled locally in handleSkip → advanceQueue)
        if (data?.userId !== user?.id) {
          advanceQueue();
        }
      }),
      // Spotlight mode: host approved a suggested track
      onSessionEvent('track-approved', (data) => {
        setSuggestedQueue((prev) => prev.filter((t) => t.id !== data.trackId));
        if (data.track) {
          setQueue((prev) => [...prev, { ...data.track, status: 'approved' }]);
        }
      }),
      // Spotlight mode: host rejected a suggested track
      onSessionEvent('track-rejected', (data) => {
        setSuggestedQueue((prev) => prev.filter((t) => t.id !== data.trackId));
      }),
      onSessionEvent('mode-changed', (data) => {
        setSession((prev) => prev ? { ...prev, roomMode: data.roomMode as RoomMode } : prev);
        // Server auto-approves pending tracks and re-broadcasts queue on mode switch.
        // If leaving Spotlight, flush the local suggested queue (server sends pending-updated too).
        if (data.roomMode !== 'spotlight') {
          setSuggestedQueue([]);
        }
        // Mode transition toast + haptic
        const label = modeLabel[data.roomMode] || data.roomMode;
        const toast: ToastMessage = {
          id: `mode_${Date.now()}`,
          text: `Waveform → ${label}`,
          type: 'mode',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 3000);
        tapMedium();
      }),
      // Full replacement of suggested/pending queue (sent by server after approve/reject/mode-change)
      onSessionEvent('pending-updated', (pendingQueue) => {
        setSuggestedQueue(pendingQueue);
      }),
      // Host ended the session — show Master Bounce receipt instead of alert
      onSessionEvent('session-ended', () => {
        stopPlayback();
        clearActiveSession();
        setBounceVisible(true);
      }),
      // ─── Layer 3-4 Socket Events ──────────────────────────
      // Resonance event (server-triggered synchronized moment)
      onSessionEvent('resonance', (data) => {
        setResonanceState({ active: true, type: data.type, message: data.message, cvBonus: data.cvBonus });
        if (data.cvBonus > 0) cv.earn(data.cvBonus, 'resonance');
      }),
      // Crossfader Duel
      onSessionEvent('duel:start', (data) => {
        setDuelState({
          active: true, trackA: data.trackA, trackB: data.trackB,
          votes: { a: 0, b: 0 }, timeRemaining: data.duration, totalTime: data.duration, userVote: null,
        });
      }),
      onSessionEvent('duel:vote', (data) => {
        setDuelState((prev) => ({
          ...prev,
          votes: {
            a: prev.votes.a + (data.side === 'a' ? 1 : 0),
            b: prev.votes.b + (data.side === 'b' ? 1 : 0),
          },
        }));
      }),
      onSessionEvent('duel:end', (data) => {
        setDuelState((prev) => ({ ...prev, active: false }));
      }),
      // Frequency Forecast
      onSessionEvent('forecast:start', (data) => {
        setForecastState({
          active: true, candidates: data.candidates,
          reward: data.reward, timeRemaining: data.duration, userPick: null, lastResult: null,
        });
      }),
      onSessionEvent('forecast:result', (data) => {
        const predicted = user?.id ? data.predictions[user.id] || '' : '';
        const correct = predicted === data.winnerId;
        setForecastState((prev) => ({
          ...prev, active: false,
          lastResult: {
            predicted,
            actual: data.winnerId,
            correct,
            earned: correct ? prev.reward : 0,
          },
        }));
        if (correct) cv.earn(forecastState.reward, 'forecast_correct');
      }),
      // Transient enter (user walk-on)
      onSessionEvent('transient:enter', (data) => {
        if (data.userId === user?.id) return; // don't show own walk-on
        setTransientUser({ active: true, username: data.username });
      }),
      // Reverb tail (ghost departure)
      onSessionEvent('reverb-tail:ghost', (data) => {
        setReverbTails((prev) => [...prev, {
          userId: data.userId, username: data.username,
          duration: data.duration, active: true,
        }]);
      }),
      // CV economy sync
      onSessionEvent('cv:balance', (data) => {
        if (data.userId === user?.id) cv.syncBalance(data.balance);
      }),
      onSessionEvent('cv:earn', (data) => {
        if (data.userId === user?.id) cv.earn(data.amount, data.reason);
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [session?.roomMode, session?.hostId, user?.id, advanceQueue, clearActiveSession, navigation]);

  // ─── Listener presence (join/leave events) ──────────────
  useEffect(() => {
    const unsubs = [
      onSessionEvent('participant-joined', (participant) => {
        setListeners((prev) => {
          if (prev.some((l) => l.userId === participant.userId)) return prev;
          return [...prev, participant];
        });
        // Show toast
        const toast: ToastMessage = {
          id: `join_${participant.userId}_${Date.now()}`,
          text: `${participant.username} joined`,
          type: 'join',
        };
        setToasts((prev) => [...prev, toast]);
        // Auto-clear toast after 3s
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 3000);
        // Push notification (shown even when foregrounded via notification handler)
        if (participant.userId !== user?.id && session?.name) {
          notifyParticipantJoined(participant.username, session.name, sessionId).catch(() => { });
        }
      }),
      onSessionEvent('participant-left', (data) => {
        setListeners((prev) => {
          const leaving = prev.find((l) => l.userId === data.userId);
          if (leaving) {
            const toast: ToastMessage = {
              id: `leave_${data.userId}_${Date.now()}`,
              text: `${leaving.username} left`,
              type: 'leave',
            };
            setToasts((p) => [...p, toast]);
            setTimeout(() => {
              setToasts((p) => p.filter((t) => t.id !== toast.id));
            }, 3000);
          }
          return prev.filter((l) => l.userId !== data.userId);
        });
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []);

  // ─── Mock: simulate someone joining after 5s ──────────────
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => {
      const mockJoiner: Listener = {
        userId: 'usr_sim_' + Date.now(),
        username: ['zara', 'finn', 'rio', 'ivy', 'sage'][Math.floor(Math.random() * 5)],
      };
      // Emit through mock bus so the listener handler picks it up
      onSessionEvent('participant-joined', () => { })(); // noop, just to ensure type
      setListeners((prev) => {
        if (prev.some((l) => l.username === mockJoiner.username)) return prev;
        return [...prev, mockJoiner];
      });
      const toast: ToastMessage = {
        id: `join_${mockJoiner.userId}`,
        text: `${mockJoiner.username} joined`,
        type: 'join',
      };
      setToasts((prev) => [...prev, toast]);
      setTimeout(() => setToasts((p) => p.filter((t) => t.id !== toast.id)), 3000);
    }, 5000);
    return () => clearTimeout(timer);
  }, [session?.id]);

  // ─── Playback engine ────────────────────────────────────

  // Subscribe to progress updates
  useEffect(() => {
    const unsub = onProgress((s) => setPlayback(s));
    return () => { unsub(); stopPlayback(); };
  }, []);

  // Auto-load track when current track changes
  const currentTrackRef = useRef<string | null>(null);
  useEffect(() => {
    const nowPlaying = queue[0] || null;
    if (nowPlaying && nowPlaying.id !== currentTrackRef.current) {
      currentTrackRef.current = nowPlaying.id;
      loadTrack(nowPlaying.id, nowPlaying.duration || 30, nowPlaying.previewUrl);
    } else if (!nowPlaying && currentTrackRef.current) {
      currentTrackRef.current = null;
      stopPlayback();
    }
  }, [queue]);

  // Auto-advance when track ends — also tell backend to remove the finished track
  useEffect(() => {
    const unsub = onTrackEnd(() => {
      advanceQueue();
      trackEnded(sessionId);
    });
    return unsub;
  }, [advanceQueue, sessionId]);

  // ─── Handlers ─────────────────────────────────────────
  const handleAddTrack = useCallback((track: Track) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('addTrack')) return;
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
    // Save this search as recent (only if there's a query)
    if (query.trim()) saveRecentSearch(query.trim());
    // Don't close search — let user add multiple tracks
  }, [user, session, sessionId, query, saveRecentSearch]);

  const handleVote = useCallback((trackId: string, direction: 1 | -1) => {
    if (!user) return;
    if (!getGlobalLimiter().canDo('vote')) return;
    tapMedium();
    // Optimistic update: apply vote locally for instant UI feedback
    const mode = session?.roomMode || 'campfire';
    setQueue((prev) => applyVote(prev, trackId, user.id, direction, mode));
    // Then emit to server — queue-updated from backend will reconcile
    voteTrack(sessionId, trackId, user.id, direction);
  }, [user, sessionId, session?.roomMode]);

  const handleReaction = useCallback((trackId: string, type: string) => {
    if (!user) return;
    if (!getGlobalLimiter().canDo('reaction')) return;
    tapLight();
    sendReaction(sessionId, trackId, user.id, type as "fire" | "vibe" | "skip");
  }, [user, sessionId]);

  const handlePlayPause = useCallback(() => {
    tapLight();
    togglePlayPause();
  }, []);

  // Wrapper so favorites use the source track ID, not the queue entry ID
  const handleToggleFavorite = useCallback((track: Track) => {
    const favoriteTrack = { ...track, id: (track as any).sourceId || track.id };
    toggleFavorite(favoriteTrack);
  }, [toggleFavorite]);

  const handleSkip = useCallback(() => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('skip')) return;
    // Engine checks if this user is allowed to skip in this mode
    const { skipped } = skipCurrentTrack(queue, user.id, session.hostId, session.roomMode);
    if (!skipped) {
      Alert.alert('Host only', 'Only the host can skip tracks in Spotlight mode.');
      return;
    }
    tapHeavy();
    // Stop current playback immediately to prevent auto-advance race
    stopPlayback();
    advanceQueue();
    skipTrack(sessionId, user.id);
  }, [user, session, sessionId, queue, advanceQueue]);

  const handleApproveTrack = useCallback((trackId: string) => {
    if (!session) return;
    tapMedium();
    // Run engine to move track from suggested → main queue
    const result = approveTrackEngine(queue, suggestedQueue, trackId);
    setQueue(result.queue);
    setSuggestedQueue(result.suggestedQueue);
    // Emit so other clients stay in sync
    const approvedTrack = result.queue[result.queue.length - 1];
    approveTrackEvent(sessionId, trackId, approvedTrack);
  }, [session, sessionId, queue, suggestedQueue]);

  const handleRejectTrack = useCallback((trackId: string) => {
    if (!session) return;
    tapLight();
    setSuggestedQueue((prev) => rejectTrackEngine(prev, trackId));
    rejectTrackEvent(sessionId, trackId);
  }, [session, sessionId]);

  // ─── Layer 3-4 Handlers ─────────────────────────────────
  const handleDuelVote = useCallback((side: 'a' | 'b') => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('duelVote')) return;
    tapHeavy();
    setDuelState((prev) => ({ ...prev, userVote: side }));
    duelVote(sessionId, user.id, side);
  }, [user, session, sessionId]);

  const handleForecastPick = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('forecast')) return;
    tapMedium();
    submitForecast(sessionId, user.id, trackId);
    setForecastState((prev) => ({ ...prev, userPick: trackId }));
  }, [user, session, sessionId]);

  const handlePhantomPower = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('phantom_power')) {
      Alert.alert('Insufficient CV', 'You need 5 CV for Phantom Power.');
      return;
    }
    tapHeavy();
    cv.spend('phantom_power');
    const track = queue.find((t) => t.id === trackId);
    setPhantomBoost({
      active: true, trackId,
      username: user.username, trackName: track?.title || '',
    });
    phantomPower(sessionId, trackId, user.id);
  }, [user, session, sessionId, cv, queue]);

  const handleOverdrive = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('overdrive')) {
      Alert.alert('Insufficient CV', 'You need 25 CV for Overdrive.');
      return;
    }
    Alert.alert(
      '⚡ Overdrive',
      'Spend 25 CV to force this track to the top of the queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Overdrive',
          style: 'destructive',
          onPress: () => {
            tapHeavy();
            cv.spend('overdrive');
            overdrive(sessionId, trackId, user.id);
          },
        },
      ],
    );
  }, [user, session, sessionId, cv]);

  const handlePhaseCancel = useCallback(() => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('phase_cancel')) {
      Alert.alert('Insufficient CV', 'You need 15 CV for Phase Cancel.');
      return;
    }
    Alert.alert(
      '🛡️ Phase Cancel',
      'Spend 15 CV to block the next skip in this room?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: () => {
            tapHeavy();
            cv.spend('phase_cancel');
            phaseCancel(sessionId, user.id);
          },
        },
      ],
    );
  }, [user, session, sessionId, cv]);

  // ─── Reorder (long-press) ──────────────────────────────
  const [reorderTrackId, setReorderTrackId] = useState<string | null>(null);

  // ─── Context menu (§5.1: long-press → context sheet) ──
  const [contextTrack, setContextTrack] = useState<QueueTrack | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);

  const handleLongPress = useCallback((track: QueueTrack) => {
    tapMedium();
    setContextTrack(track);
    setContextMenuVisible(true);
  }, []);

  const handleContextAction = useCallback((actionId: string, track: Track) => {
    switch (actionId) {
      case 'removeFromQueue':
        setQueue((prev) => prev.filter((t) => t.id !== track.id));
        break;
      case 'addToLibrary':
        handleToggleFavorite(track);
        break;
      case 'share':
        Share.share({ message: `${track.title} by ${track.artist} — on Frequen-C` });
        break;
      case 'overdrive':
        handleOverdrive(track.id);
        break;
      case 'phantomPower':
        handlePhantomPower(track.id);
        break;
      default:
        break;
    }
  }, [handleToggleFavorite, handleOverdrive, handlePhantomPower]);

  const handleMoveUp = useCallback((trackId: string) => {
    tapLight();
    setQueue((prev) => moveTrackEngine(prev, trackId, 'up'));
  }, []);

  const handleMoveDown = useCallback((trackId: string) => {
    tapLight();
    setQueue((prev) => moveTrackEngine(prev, trackId, 'down'));
  }, []);

  // ─── Room Mode Switching (host only) ───────────────────
  const handleChangeMode = useCallback(() => {
    if (!session || !user || user.id !== session.hostId) return;
    const modes: RoomMode[] = ['campfire', 'spotlight', 'openFloor'];
    const modeNames = ['Campfire — Round-robin turns', 'Spotlight — Host curates', 'Open Floor — Votes decide'];
    const currentIdx = modes.indexOf(session.roomMode);
    const buttons = modes.map((mode, i) => ({
      text: `${i === currentIdx ? '● ' : ''}${modeNames[i]}`,
      onPress: () => {
        if (mode === session.roomMode) return;
        tapMedium();
        // Update local session state
        setSession((prev) => prev ? { ...prev, roomMode: mode } : prev);
        // Emit to other clients
        changeModeEvent(sessionId, mode);
      },
    }));
    buttons.push({ text: 'Cancel', onPress: () => { } });
    Alert.alert('Change Room Mode', 'This affects how the queue works for everyone.', buttons);
  }, [session, user, sessionId]);

  const handleShare = useCallback(() => {
    if (!session) return;
    Alert.alert('Share Room', 'How do you want to share?', [
      {
        text: 'Show QR Code',
        onPress: () => setShowQR(true),
      },
      {
        text: 'Share Link',
        onPress: () =>
          Share.share({
            message: `Join my Frequen-C room "${session.name}"!\nfrequenc://join/${session.joinCode}`,
            url: `frequenc://join/${session.joinCode}`,
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [session]);

  const handleCopyCode = useCallback(async () => {
    if (!session?.joinCode) return;
    await Clipboard.setStringAsync(session.joinCode);
    tapLight();
    Alert.alert('Copied!', `Room code "${session.joinCode}" copied to clipboard.`);
  }, [session]);

  const handleCancelSearch = useCallback(() => {
    clearSearch();
    setSearchFocused(false);
    Keyboard.dismiss();
  }, [clearSearch]);

  // ─── Leave / End Session ───────────────────────────────
  const handleLeaveRoom = useCallback(() => {
    if (!user || !session) return;
    const userIsHost = user.id === session.hostId;

    if (userIsHost) {
      // Host ending the session
      Alert.alert(
        'End Session',
        'This will close the room for everyone. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Session',
            style: 'destructive',
            onPress: () => {
              tapHeavy();
              endSessionEvent(sessionId);
              clearActiveSession();
              navigation.goBack();
            },
          },
        ],
      );
    } else {
      // Participant leaving
      Alert.alert(
        'Leave Room',
        `Leave "${session.name}"?`,
        [
          { text: 'Stay', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              tapHeavy();
              quitSession(sessionId, user.id);
              clearActiveSession();
              navigation.goBack();
            },
          },
        ],
      );
    }
  }, [user, session, sessionId, navigation, clearActiveSession]);

  // ─── Loading state ────────────────────────────────────
  if (loading || !session) {
    return (
      <SafeScreen>
        <View style={styles.skeletonContainer}>
          {/* Header skeleton */}
          <View style={styles.skeletonHeader}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Skeleton fill height={18} style={{ maxWidth: 180 }} />
              <Skeleton fill height={12} style={{ marginTop: 6, maxWidth: 100 }} />
            </View>
            <Skeleton width={60} height={24} borderRadius={12} />
          </View>

          {/* Search bar skeleton */}
          <Skeleton fill height={40} borderRadius={spacing.radius.md} style={{ marginBottom: spacing.md }} />

          {/* Now playing skeleton */}
          <View style={styles.skeletonNowPlaying}>
            <Skeleton width={56} height={56} borderRadius={spacing.radius.sm} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Skeleton fill height={16} style={{ maxWidth: 200 }} />
              <Skeleton fill height={12} style={{ marginTop: 6, maxWidth: 140 }} />
            </View>
          </View>

          {/* Queue skeletons */}
          <Skeleton fill height={14} style={{ maxWidth: 80, marginBottom: spacing.sm }} />
          <TrackCardSkeleton />
          <TrackCardSkeleton />
          <TrackCardSkeleton />
          <TrackCardSkeleton />
        </View>
      </SafeScreen>
    );
  }

  // Current track = always queue[0]. Backend deletes finished tracks
  // and broadcastQueue keeps this in sync across all clients.
  const currentTrack: QueueTrack | null = queue[0] || null;

  const listenerCount = listeners.length || session.listeners?.length || 0;
  const modeName = modeLabel[session.roomMode] || 'Campfire';
  const showSearchResults = searchFocused && query.length > 0;
  const showSearchPanel = searchFocused; // includes empty-query state for recent searches
  const isHost = user?.id === session.hostId;
  const isSpotlight = session.roomMode === 'spotlight';
  const canSkip = session.roomMode !== 'spotlight' || isHost;

  return (
    <SafeScreen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >

        {/* ─── Connection Status ──────────────────────── */}
        <OfflineBanner visible={!isConnected} />
        <ConnectionBanner />

        {/* ─── Signal Path Breadcrumb ─────────────────────── */}
        <SignalPathBreadcrumb
          nodes={[
            { id: 'home', label: 'HOME', onPress: () => navigation.goBack() },
            { id: 'room', label: session.name.toUpperCase() },
          ]}
        />

        {/* ─── Rhythm Channel (Controls Header) ──────────── */}
        <View style={styles.header}>
          {/* Left: waveform + room name */}
          <TouchableOpacity onPress={isHost ? handleChangeMode : undefined} activeOpacity={isHost ? 0.6 : 1}>
            <WaveformIcon mode={session.roomMode as RoomMode} size={18} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <Text variant="labelLarge" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
                {session.name}
              </Text>
              <ListenerBar
                listeners={listeners}
                hostId={session.hostId}
                onPress={() => setListenerDrawerOpen(true)}
              />
            </View>

            {/* Join code pill — tappable */}
            {session.joinCode ? (
              <TouchableOpacity style={styles.codePill} onPress={handleCopyCode} activeOpacity={0.7}>
                <Text variant="labelSmall" color={colors.chrome.text} style={{ fontSize: 8, letterSpacing: 1.5 }}>CODE</Text>
                <Text variant="label" color={colors.action.primary} style={styles.codeValue}>
                  {session.joinCode}
                </Text>
                <Ionicons name="copy-outline" size={11} color={colors.text.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Right: lyrics + chat + share + leave */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {currentTrack && (
              <TouchableOpacity onPress={() => setLyricsVisible(true)} style={styles.headerAction}>
                <Ionicons name="musical-notes-outline" size={16} color={colors.chrome.text} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setChatOpen(true)} style={styles.headerAction}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.chrome.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.headerAction}>
              <Ionicons name="share-outline" size={16} color={colors.chrome.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLeaveRoom} style={styles.headerAction}>
              <Ionicons
                name={isHost ? 'close-circle-outline' : 'exit-outline'}
                size={16}
                color={colors.action.destructive}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── CV Economy Bar ─────────────────────────────── */}
        <View style={styles.cvBar}>
          <View style={styles.cvBalanceChip}>
            <Ionicons name="flash" size={12} color={colors.action.primary} />
            <Text variant="labelSmall" color={colors.action.primary} style={{ fontWeight: '600' }}>
              {cv.balance} CV
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.cvActionChip,
              !cv.canUse('phase_cancel') && styles.cvActionDisabled,
            ]}
            onPress={handlePhaseCancel}
            activeOpacity={0.6}
            disabled={!cv.canUse('phase_cancel')}
          >
            <Ionicons name="shield-outline" size={12} color={cv.canUse('phase_cancel') ? colors.text.primary : colors.text.muted} />
            <Text
              variant="labelSmall"
              color={cv.canUse('phase_cancel') ? colors.text.primary : colors.text.muted}
            >
              Phase Cancel · 15
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Filter Sweep (Search) ────────────────────── */}
        <View style={styles.searchBarRow}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search for tracks..."
            placeholderTextColor={colors.text.muted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchFocused && (
            <TouchableOpacity onPress={handleCancelSearch} style={styles.cancelBtn}>
              <Text variant="label" color={colors.text.muted}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ─── Search Panel (Results + Recent Searches) ──── */}
        {showSearchPanel && (
          <View style={styles.searchOverlay}>
            {showSearchResults ? (
              <>
                {isSearching && (
                  <ActivityIndicator color={colors.action.primary} style={{ marginVertical: spacing.sm }} />
                )}
                <FlatList
                  data={results}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => <SearchResultItem track={item} onAdd={handleAddTrack} />}
                  keyboardShouldPersistTaps="handled"
                  style={styles.searchResultsList}
                  initialNumToRender={8}
                  maxToRenderPerBatch={5}
                  windowSize={7}
                />
              </>
            ) : (
              /* Recent searches when focused but no query */
              <View style={styles.recentSearches}>
                {recentSearches.length > 0 ? (
                  <>
                    <Text variant="labelSmall" color={colors.text.muted} style={styles.recentTitle}>
                      Recent Searches
                    </Text>
                    {recentSearches.slice(0, 6).map((s) => (
                      <TouchableOpacity
                        key={s.query + s.timestamp}
                        style={styles.recentItem}
                        onPress={() => {
                          setQuery(s.query);
                          // useSearch will auto-debounce and fetch
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="time-outline" size={14} color={colors.text.muted} style={{ marginRight: 8 }} />
                        <Text variant="body" color={colors.text.secondary} style={{ flex: 1 }} numberOfLines={1}>
                          {s.query}
                        </Text>
                        <TouchableOpacity
                          onPress={() => removeRecentSearch(s.query)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close" size={14} color={colors.text.muted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <Text variant="body" color={colors.text.muted} align="center" style={{ paddingTop: spacing.xl }}>
                    Search for tracks to add to the queue
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* ─── Queue (Main Content) ─────────────────────── */}
        {!showSearchPanel && (
          <DraggableQueue<QueueTrack>
            data={queue}
            keyExtractor={(item, i) => item.id + '_' + i}
            onReorder={(reordered) => setQueue(reordered)}
            lockedIndices={[0]}
            dragEnabled={isHost}
            renderItem={({ item, index, isDragging }) => (
              <ADSRFadeIn index={index} staggerMs={60}>
                <SwipeableRow
                  onRemove={() => setQueue((prev) => prev.filter((t) => t.id !== item.id))}
                  enabled={index > 0 && !isDragging}
                >
                  <QueueTrackCard
                    track={item}
                    isNowPlaying={index === 0}
                    onVote={handleVote}
                    userId={user?.id}
                    roomMode={session.roomMode as RoomMode}
                    isHost={isHost}
                    isFavorite={isFavorite(item.sourceId || item.id)}
                    onToggleFavorite={handleToggleFavorite}
                    showReorder={reorderTrackId === item.id}
                    onMoveUp={index > 1 ? handleMoveUp : undefined}
                    onMoveDown={index > 0 && index < queue.length - 1 ? handleMoveDown : undefined}
                    onLongPress={() => handleLongPress(item)}
                    showDragHandle={isHost && index > 0}
                    isDragging={isDragging}
                  />
                </SwipeableRow>
              </ADSRFadeIn>
            )}
            contentContainerStyle={[
              styles.queueList,
              { paddingBottom: currentTrack ? MINI_PLAYER_HEIGHT + spacing.md : spacing['3xl'] },
            ]}
            ListHeaderComponent={
              <View>
                {/* Spotlight: Suggestions panel (host only) */}
                {isSpotlight && isHost && suggestedQueue.length > 0 && (
                  <View style={styles.suggestionsPanel}>
                    <View style={styles.suggestionsPanelHeader}>
                      <Text variant="label" color={colors.text.secondary}>
                        Suggestions ({suggestedQueue.length})
                      </Text>
                    </View>
                    {suggestedQueue.map((track) => (
                      <SuggestionCard
                        key={track.id}
                        track={track}
                        onApprove={handleApproveTrack}
                        onReject={handleRejectTrack}
                      />
                    ))}
                  </View>
                )}

                {/* Spotlight: Non-host sees pending count */}
                {isSpotlight && !isHost && suggestedQueue.length > 0 && (
                  <View style={styles.pendingBanner}>
                    <Text variant="bodySmall" color={colors.text.muted} align="center">
                      {suggestedQueue.length} suggestion{suggestedQueue.length !== 1 ? 's' : ''} pending host approval
                    </Text>
                  </View>
                )}

                {/* Waveform mode indicator */}
                <View style={styles.modeIndicator}>
                  <WaveformIcon mode={session.roomMode as RoomMode} size={14} />
                  <Text variant="labelSmall" color={colors.chrome.text} style={{ marginLeft: 6, flex: 1 }}>
                    {session.roomMode === 'campfire'
                      ? modeDesc.campfire
                      : session.roomMode === 'spotlight'
                        ? (isHost ? modeDesc.spotlight_host : modeDesc.spotlight_guest)
                        : modeDesc.openFloor}
                  </Text>
                </View>

                {/* Step Sequencer — visual queue grid */}
                {queue.length > 0 && (
                  <StepSequencer
                    queue={queue}
                    currentTrackId={currentTrack?.id}
                    roomMode={session.roomMode as RoomMode}
                    maxSteps={16}
                    onStepPress={(track, index) => {
                      // Scroll to the tapped track in the list below
                      tapLight();
                    }}
                  />
                )}

                <View style={styles.queueHeader}>
                  <Text variant="label" color={colors.text.secondary} style={{ letterSpacing: 1.5, fontSize: 10 }}>
                    UP NEXT
                  </Text>
                  <Text variant="labelSmall" color={colors.text.muted}>
                    {queue.length} track{queue.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <TouchableOpacity
                style={styles.emptyQueue}
                onPress={() => { setSearchFocused(true); }}
                activeOpacity={0.7}
              >
                <WaveformIcon mode={session.roomMode as RoomMode} size={32} />
                <Text variant="body" color={colors.text.muted} align="center" style={{ marginTop: spacing.sm }}>
                  Queue is empty
                </Text>
                <Text variant="labelSmall" color={colors.action.primary} align="center" style={{ marginTop: spacing.xs }}>
                  Search to add tracks
                </Text>
              </TouchableOpacity>
            }
            ListFooterComponent={
              <PlayedHistory history={playedHistory} onRequeue={handleAddTrack} />
            }
          />
        )}

        {/* ─── Mini Player (Fixed Bottom) ───────────────── */}
        {currentTrack && (
          <MiniPlayer
            track={currentTrack}
            playback={playback}
            onSkip={handleSkip}
            onPlayPause={handlePlayPause}
            onPress={() => setNowPlayingOpen(true)}
            canSkip={canSkip}
          />
        )}

        {/* ─── Join/Leave Toast ─────────────────────────── */}
        <JoinLeaveToast messages={toasts} />

        {/* ─── Now Playing Expanded Sheet ─────────────────── */}
        <NowPlayingSheet
          visible={nowPlayingOpen}
          track={currentTrack}
          playback={playback}
          onClose={() => setNowPlayingOpen(false)}
          onSkip={handleSkip}
          onReact={handleReaction}
          canSkip={canSkip}
          roomName={session.name}
        />

        {/* ─── Track Context Menu (§5.1 long-press) ─────── */}
        <TrackContextMenu
          visible={contextMenuVisible}
          track={contextTrack}
          actions={QUEUE_ACTIONS}
          onAction={handleContextAction}
          onClose={() => setContextMenuVisible(false)}
        />

        {/* ─── Listener Drawer ──────────────────────────── */}
        <ListenerDrawer
          visible={listenerDrawerOpen}
          listeners={listeners}
          hostId={session.hostId}
          onClose={() => setListenerDrawerOpen(false)}
        />

        {/* ─── Chat Panel ────────────────────────────────── */}
        <ChatPanel
          sessionId={session.id}
          userId={user?.id || ''}
          username={user?.username || ''}
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
        />

        {/* ─── Layer 3: Crossfader Duel (overlay) ──────── */}
        {duelState.active && duelState.trackA && duelState.trackB && (
          <View style={StyleSheet.absoluteFill}>
            <CrossfaderDuel
              trackA={duelState.trackA}
              trackB={duelState.trackB}
              votes={duelState.votes}
              timeRemaining={duelState.timeRemaining}
              totalTime={duelState.totalTime}
              userVote={duelState.userVote}
              onVote={handleDuelVote}
              onDuelEnd={() => setDuelState((prev) => ({ ...prev, active: false }))}
            />
          </View>
        )}

        {/* ─── Layer 3: Frequency Forecast (overlay) ───── */}
        {forecastState.active && (
          <View style={StyleSheet.absoluteFill}>
            <FrequencyForecast
              candidates={forecastState.candidates}
              reward={forecastState.reward}
              timeRemaining={forecastState.timeRemaining}
              onPredict={handleForecastPick}
              lastResult={forecastState.lastResult}
            />
          </View>
        )}

        {/* ─── Layer 3: Resonance Event (full-screen) ──── */}
        <ResonanceEvent
          type={resonanceState.type}
          message={resonanceState.message}
          cvBonus={resonanceState.cvBonus}
          active={resonanceState.active}
          duration={3000}
          onComplete={() => setResonanceState((prev) => ({ ...prev, active: false }))}
        />

        {/* ─── Layer 4: Transient Enter (walk-on) ──────── */}
        <TransientEnter
          username={transientUser.username}
          active={transientUser.active}
          onComplete={() => setTransientUser({ active: false, username: '' })}
        />

        {/* ─── Layer 4: Reverb Tails (ghost departures) ── */}
        {reverbTails.map((tail) => (
          <ReverbTail
            key={tail.userId}
            username={tail.username}
            duration={tail.duration}
            active={tail.active}
            onDecayed={() => {
              setReverbTails((prev) => prev.filter((t) => t.userId !== tail.userId));
            }}
          />
        ))}

      </KeyboardAvoidingView>

      {/* QR Code Modal */}
      <Modal
        visible={showQR}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQR(false)}
      >
        <View style={styles.qrOverlay}>
          <View style={styles.qrModal}>
            <Text variant="h3" color={colors.text.primary} align="center">
              {session?.name}
            </Text>
            {session?.joinCode && (
              <QRCodeDisplay joinCode={session.joinCode} />
            )}
            <TouchableOpacity onPress={() => setShowQR(false)} style={styles.qrClose}>
              <Text variant="label" color={colors.text.muted}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─── Master Bounce Receipt (session end) ──────── */}
      {bounceVisible && (
        <MasterBounce
          sessionName={session.name}
          roomMode={session.roomMode as RoomMode}
          hostUsername={listeners.find((l) => l.userId === session.hostId)?.username || 'Host'}
          durationSeconds={Math.round((Date.now() - sessionStartTime) / 1000)}
          tracksPlayed={[...playedHistory, ...(currentTrack ? [currentTrack] : [])]}
          participantCount={listeners.length}
          cvEarned={cv.balance}
          endedAt={new Date().toISOString()}
          visible
          onDismiss={() => {
            setBounceVisible(false);
            navigation.goBack();
          }}
        />
      )}

      {/* ─── Layer 6: Lyrics ───────────────────────────── */}
      <LyricsOverlay
        track={currentTrack || undefined}
        visible={lyricsVisible}
        onClose={() => setLyricsVisible(false)}
      />
    </SafeScreen>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  skeletonContainer: {
    flex: 1, padding: spacing.md,
  },
  skeletonHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  skeletonNowPlaying: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing.sm, marginBottom: spacing.md,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.border.subtle,
  },

  // Rhythm Channel (controls header)
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.chrome.border,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: colors.chrome.surface,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
  codeValue: {
    letterSpacing: 2,
  },
  headerAction: {
    width: 30,
    height: 30,
    borderRadius: 6,
    backgroundColor: colors.chrome.surface,
    borderWidth: 1,
    borderColor: colors.chrome.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CV Economy Bar
  cvBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 6,
    gap: 8,
  },
  cvBalanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
  },
  cvActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.bg.surface,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  cvActionDisabled: {
    opacity: 0.4,
  },

  // Filter Sweep (search bar)
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 38,
    backgroundColor: colors.bg.surface,
    borderRadius: 6,
    paddingHorizontal: 12,
    color: colors.text.primary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
  cancelBtn: {
    paddingVertical: spacing.xs,
  },

  // Search overlay
  searchOverlay: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
  },
  searchResultsList: {
    flex: 1,
  },
  recentSearches: {
    paddingTop: spacing.sm,
  },
  recentTitle: {
    marginBottom: spacing.sm,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  recentItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },

  // Queue
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  queueList: {
    paddingHorizontal: spacing.screenPadding,
  },
  emptyQueue: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },



  // Spotlight suggestions panel
  suggestionsPanel: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
  suggestionsPanelHeader: {
    marginBottom: spacing.sm,
  },
  pendingBanner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
  },

  // Waveform mode indicator
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: spacing.sm,
    borderRadius: 6,
    backgroundColor: colors.chrome.surface,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },

  // QR Modal
  qrOverlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModal: {
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: spacing.xl,
    width: 300,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },
  qrClose: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
});

export default SessionRoomScreen;
