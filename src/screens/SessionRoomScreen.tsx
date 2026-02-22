/**
 * Session Room Screen — Player-First Layout
 *
 * UX Convergence Approach C (Hybrid):
 * Full-screen player as core shell, Frequen-C features via progressive disclosure.
 *
 * Layout: Header → Participant Bar → Album Art Hero → Track Info →
 *         Progress Bar → Transport → Reaction Bar → Queue Peek + CV Pill
 *
 * Queue is a pull-up bottom sheet, not inline.
 * CV/Power Moves accessible via CV pill expansion.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Share, Keyboard, Modal, KeyboardAvoidingView, Platform,
  ScrollView, Dimensions, Image, Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, RoomModeBadge } from '../components/ui';
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
import { SuggestionCard } from '../components/SuggestionCard';
import { PlayedHistory } from '../components/PlayedHistory';
import { OfflineBanner } from '../components/OfflineBanner';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppState } from '../hooks/useAppState';
import { getGlobalLimiter } from '../utils/rateLimiter';
import { ADSRFadeIn, TrackContextMenu, SwipeableRow } from '../components/ui';
import { QUEUE_ACTIONS, type ContextMenuAction } from '../components/ui/TrackContextMenu';
import { Skeleton, TrackCardSkeleton } from '../components/ui/Skeleton';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { ParticipantAvatarBar } from '../components/ui/ParticipantAvatarBar';
import { ReactionBar } from '../components/ui/ReactionBar';
// Layer 3-4: Social, Game, Economy, Environment
import { CrossfaderDuel } from '../components/CrossfaderDuel';
import { FrequencyForecast } from '../components/FrequencyForecast';
import { ResonanceEvent } from '../components/ResonanceEvent';
import { PhantomPower } from '../components/PhantomPower';
import { TransientEnter } from '../components/TransientEnter';
import { ReverbTail } from '../components/ReverbTail';
import { MasterBounce } from '../components/MasterBounce';
import { useCV } from '../hooks/useCV';
import { useVoltageSag } from '../hooks/useVoltageSag';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_ART_SIZE = SCREEN_WIDTH - 48;

// ─── Mode descriptions (for overflow menu tooltip) ───────────
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
  const { isVoltageSag, accent, accentGlow } = useVoltageSag();

  const [session, setSession] = useState<Session | null>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [suggestedQueue, setSuggestedQueue] = useState<QueueTrack[]>([]);
  const [playedHistory, setPlayedHistory] = useState<QueueTrack[]>([]);
  const [loading, setLoading] = useState(true);
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

  // ─── Bottom sheet & overflow state ─────────────────────────
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [cvExpanded, setCvExpanded] = useState(false);
  const [searchInSheet, setSearchInSheet] = useState(false);

  // ─── App state recovery (background → foreground) ──
  useAppState({
    onForeground: useCallback(() => {
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
  const searchInputRef = useRef<TextInput>(null);

  // Shared queue advancement
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
        setPlayedHistory((hist) => [finished, ...hist].slice(0, MAX_PLAYED_HISTORY));
        if (finished.duration > 30 && !!user?.connectedServices?.lastfm?.connected) {
          api.integrations.scrobble(
            finished.title,
            finished.artist,
            Math.floor(Date.now() / 1000) - Math.floor(finished.duration)
          ).catch(() => { });
        }
      }
      const next = prev.slice(1);
      if (next.length > 0) {
        notifyTrackChanged(next[0].title, next[0].artist, sessionId).catch(() => { });
      }
      setTimeout(() => { isAdvancingRef.current = false; }, 300);
      return next;
    });
  }, [sessionId]);

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
          hostId: s.hostId,
        });
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

        await connectSocket();
        if (!mounted) return;

        socketUnsubsRef.current = [
          onSessionEvent('queue-updated', (newQueue) => {
            if (mounted) setQueue(newQueue);
          }),
          onSessionEvent('session-updated', (update) => {
            if (mounted) setSession((prev) => prev ? { ...prev, ...update } : null);
          }),
          onSessionEvent('room-state' as any, (state: any) => {
            if (!mounted) return;
            if (state.queue) setQueue(state.queue);
            if (state.suggestedQueue) setSuggestedQueue(state.suggestedQueue);
            if (state.participants) setListeners(state.participants);
            if (state.currentTrack && state.queue?.length === 0) {
              setQueue([state.currentTrack]);
            }
          }),
          onSessionEvent('track-pending' as any, (data: any) => {
            if (!mounted || !data?.track) return;
            setSuggestedQueue((prev) => {
              if (prev.some((t) => t.id === data.track.id)) return prev;
              return [...prev, { ...data.track, status: 'pending' as const }];
            });
          }),
          onSessionEvent('track-changed' as any, (_track: any) => {}),
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
        ];

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
        setQueue((prevQ) => {
          if (roomMode === 'spotlight' && track.addedById !== hostId) {
            setSuggestedQueue((prevS) => [...prevS, { ...track, status: 'pending' as const }]);
            return prevQ;
          }
          const result = addTrackToQueue(prevQ, [], track, roomMode, hostId);
          return result.queue;
        });
      }),
      onSessionEvent('vote-cast', (data) => {
        setQueue((prev) => applyVote(prev, data.trackId, data.userId, data.direction, roomMode));
      }),
      onSessionEvent('reaction-local', (data) => {
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
        if (data?.userId !== user?.id) {
          advanceQueue();
        }
      }),
      onSessionEvent('track-approved', (data) => {
        setSuggestedQueue((prev) => prev.filter((t) => t.id !== data.trackId));
        if (data.track) {
          setQueue((prev) => [...prev, { ...data.track, status: 'approved' }]);
        }
      }),
      onSessionEvent('track-rejected', (data) => {
        setSuggestedQueue((prev) => prev.filter((t) => t.id !== data.trackId));
      }),
      onSessionEvent('mode-changed', (data) => {
        setSession((prev) => prev ? { ...prev, roomMode: data.roomMode as RoomMode } : prev);
        if (data.roomMode !== 'spotlight') {
          setSuggestedQueue([]);
        }
        const toast: ToastMessage = {
          id: `mode_${Date.now()}`,
          text: `Mode → ${data.roomMode}`,
          type: 'mode',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 3000);
        tapMedium();
      }),
      onSessionEvent('pending-updated', (pendingQueue) => {
        setSuggestedQueue(pendingQueue);
      }),
      onSessionEvent('session-ended', () => {
        stopPlayback();
        clearActiveSession();
        setBounceVisible(true);
      }),
      // ─── Layer 3-4 Socket Events ──────────────────────────
      onSessionEvent('resonance', (data) => {
        setResonanceState({ active: true, type: data.type, message: data.message, cvBonus: data.cvBonus });
        if (data.cvBonus > 0) cv.earn(data.cvBonus, 'resonance');
      }),
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
      onSessionEvent('duel:end', (_data) => {
        setDuelState((prev) => ({ ...prev, active: false }));
      }),
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
      onSessionEvent('transient:enter', (data) => {
        if (data.userId === user?.id) return;
        setTransientUser({ active: true, username: data.username });
      }),
      onSessionEvent('reverb-tail:ghost', (data) => {
        setReverbTails((prev) => [...prev, {
          userId: data.userId, username: data.username,
          duration: data.duration, active: true,
        }]);
      }),
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
        const toast: ToastMessage = {
          id: `join_${participant.userId}_${Date.now()}`,
          text: `${participant.username} joined`,
          type: 'join',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 3000);
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
  useEffect(() => {
    const unsub = onProgress((s) => setPlayback(s));
    return () => { unsub(); stopPlayback(); };
  }, []);

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
    if (query.trim()) saveRecentSearch(query.trim());
  }, [user, session, sessionId, query, saveRecentSearch]);

  const handleVote = useCallback((trackId: string, direction: 1 | -1) => {
    if (!user) return;
    if (!getGlobalLimiter().canDo('vote')) return;
    tapMedium();
    const mode = session?.roomMode || 'campfire';
    setQueue((prev) => applyVote(prev, trackId, user.id, direction, mode));
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

  const handleToggleFavorite = useCallback((track: Track) => {
    const favoriteTrack = { ...track, id: (track as any).sourceId || track.id };
    toggleFavorite(favoriteTrack);
  }, [toggleFavorite]);

  const handleSkip = useCallback(() => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('skip')) return;
    const { skipped } = skipCurrentTrack(queue, user.id, session.hostId, session.roomMode);
    if (!skipped) {
      Alert.alert('Host only', 'Only the host can skip tracks in Spotlight mode.');
      return;
    }
    tapHeavy();
    stopPlayback();
    advanceQueue();
    skipTrack(sessionId, user.id);
  }, [user, session, sessionId, queue, advanceQueue]);

  const handleApproveTrack = useCallback((trackId: string) => {
    if (!session) return;
    tapMedium();
    const result = approveTrackEngine(queue, suggestedQueue, trackId);
    setQueue(result.queue);
    setSuggestedQueue(result.suggestedQueue);
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

  // ─── Context menu ──────────────────────────────────────
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

  // ─── Room Mode Switching (host only) ───────────────────
  const handleChangeMode = useCallback(() => {
    if (!session || !user || user.id !== session.hostId) return;
    const modes: RoomMode[] = ['campfire', 'spotlight', 'openFloor'];
    const modeNames = ['🔥 Campfire — Round-robin', '🎤 Spotlight — Host curates', '⚡ Open Floor — Votes decide'];
    const currentIdx = modes.indexOf(session.roomMode);
    const buttons = modes.map((mode, i) => ({
      text: `${i === currentIdx ? '● ' : ''}${modeNames[i]}`,
      onPress: () => {
        if (mode === session.roomMode) return;
        tapMedium();
        setSession((prev) => prev ? { ...prev, roomMode: mode } : prev);
        changeModeEvent(sessionId, mode);
      },
    }));
    buttons.push({ text: 'Cancel', onPress: () => { } });
    Alert.alert('Change Room Mode', 'This affects how the queue works for everyone.', buttons);
  }, [session, user, sessionId]);

  const handleShare = useCallback(() => {
    if (!session) return;
    Alert.alert('Share Room', 'How do you want to share?', [
      { text: 'Show QR Code', onPress: () => setShowQR(true) },
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

  // ─── Leave / End Session ───────────────────────────────
  const handleLeaveRoom = useCallback(() => {
    if (!user || !session) return;
    const userIsHost = user.id === session.hostId;

    if (userIsHost) {
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

  // ─── Search within queue sheet ─────────────────────────
  const handleCancelSearch = useCallback(() => {
    clearSearch();
    setSearchInSheet(false);
    Keyboard.dismiss();
  }, [clearSearch]);

  // ─── Loading state ────────────────────────────────────
  if (loading || !session) {
    return (
      <SafeScreen>
        <View style={styles.skeletonContainer}>
          <View style={styles.skeletonHeader}>
            <Skeleton width={28} height={28} borderRadius={14} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Skeleton fill height={18} style={{ maxWidth: 180 }} />
            </View>
            <Skeleton width={60} height={24} borderRadius={12} />
          </View>
          <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Skeleton width={ALBUM_ART_SIZE} height={ALBUM_ART_SIZE} borderRadius={spacing.radius.sm} />
          </View>
          <View style={{ alignItems: 'center', gap: 8, paddingBottom: spacing.lg }}>
            <Skeleton width={200} height={22} />
            <Skeleton width={140} height={16} />
          </View>
          <Skeleton fill height={2} style={{ marginHorizontal: spacing.screenPadding }} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 40, paddingVertical: spacing.md }}>
            <Skeleton width={32} height={32} borderRadius={16} />
            <Skeleton width={56} height={56} borderRadius={28} />
            <Skeleton width={32} height={32} borderRadius={16} />
          </View>
        </View>
      </SafeScreen>
    );
  }

  // ─── Derived values ────────────────────────────────────
  const currentTrack: QueueTrack | null = queue[0] || null;
  const nextTrack: QueueTrack | null = queue[1] || null;
  const isHost = user?.id === session.hostId;
  const isSpotlight = session.roomMode === 'spotlight';
  const canSkip = session.roomMode !== 'spotlight' || isHost;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ═══════════════════════════════════════════════════════════
  // ─── RENDER: Player-First Layout ──────────────────────────
  // ═══════════════════════════════════════════════════════════

  return (
    <SafeScreen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ─── Connection Status ──────────────────────── */}
        <OfflineBanner visible={!isConnected} />
        <ConnectionBanner />

        {/* ═══ HEADER (§3.1) ═════════════════════════════ */}
        <View style={styles.header}>
          {/* ← Back */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Room Name */}
          <Text
            variant="labelLarge"
            color={colors.text.primary}
            numberOfLines={1}
            style={styles.headerTitle}
          >
            {session.name}
          </Text>

          {/* Mode Badge (tap = mode switch for host) */}
          <TouchableOpacity
            onPress={isHost ? handleChangeMode : undefined}
            activeOpacity={isHost ? 0.6 : 1}
          >
            <RoomModeBadge mode={session.roomMode as RoomMode} variant="full" />
          </TouchableOpacity>

          {/* ⋯ Overflow */}
          <TouchableOpacity
            onPress={() => setOverflowOpen(true)}
            style={styles.overflowBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* ═══ PARTICIPANT BAR (§3.2) ════════════════════ */}
        <ParticipantAvatarBar
          listeners={listeners}
          maxVisible={4}
          showInvite
          onInvitePress={handleShare}
          onAvatarPress={() => setListenerDrawerOpen(true)}
        />

        {/* ═══ SCROLLABLE PLAYER CONTENT ═════════════════ */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.playerContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Album Art Hero (§3.3) ────────────────── */}
          <View style={styles.albumArtContainer}>
            {currentTrack?.albumArt || currentTrack?.artwork ? (
              <Image
                source={{ uri: currentTrack.albumArt || currentTrack.artwork }}
                style={styles.albumArt}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.albumArt, styles.albumArtPlaceholder]}>
                <Ionicons
                  name="musical-notes"
                  size={64}
                  color={colors.text.muted}
                />
                {!currentTrack && (
                  <Text variant="body" color={colors.text.muted} style={{ marginTop: spacing.sm }}>
                    No track playing
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* ─── Track Info (§3.4) ────────────────────── */}
          <View style={styles.trackInfo}>
            <Text
              variant="h3"
              color={colors.text.primary}
              numberOfLines={1}
              align="center"
              style={styles.trackTitle}
            >
              {currentTrack?.title || 'Add a track to start'}
            </Text>
            <Text
              variant="body"
              color={colors.text.secondary}
              numberOfLines={1}
              align="center"
            >
              {currentTrack
                ? `${currentTrack.artist}${currentTrack.addedBy ? ` · Added by @${currentTrack.addedBy.username}` : ''}`
                : 'Search to add tracks to the queue'}
            </Text>
          </View>

          {/* ─── Progress Bar (§3.5) ──────────────────── */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(playback.progress || 0) * 100}%`,
                    backgroundColor: accent,
                  },
                ]}
              />
            </View>
            <View style={styles.progressLabels}>
              <Text variant="labelSmall" color={colors.text.muted}>
                {formatTime(playback.elapsed || 0)}
              </Text>
              <Text variant="labelSmall" color={colors.text.muted}>
                {formatTime(playback.duration || 0)}
              </Text>
            </View>
          </View>

          {/* ─── Transport Controls (§3.6) ─────────────── */}
          <View style={styles.transport}>
            {/* Previous */}
            <TouchableOpacity
              onPress={handleSkip}
              disabled={!canSkip || !currentTrack}
              style={styles.transportSecondary}
            >
              <Ionicons
                name="play-skip-back"
                size={24}
                color={canSkip && currentTrack ? colors.text.primary : colors.text.muted}
              />
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity
              onPress={handlePlayPause}
              style={[styles.playPauseBtn, { backgroundColor: accent }]}
              disabled={!currentTrack}
              activeOpacity={0.8}
            >
              {playback.isLoading ? (
                <ActivityIndicator color={colors.bg.primary} size="small" />
              ) : (
                <Ionicons
                  name={playback.isPlaying ? 'pause' : 'play'}
                  size={28}
                  color={colors.bg.primary}
                  style={!playback.isPlaying ? { marginLeft: 3 } : undefined}
                />
              )}
            </TouchableOpacity>

            {/* Next / Skip */}
            <TouchableOpacity
              onPress={handleSkip}
              disabled={!canSkip || !currentTrack}
              style={styles.transportSecondary}
            >
              <Ionicons
                name="play-skip-forward"
                size={24}
                color={canSkip && currentTrack ? colors.text.primary : colors.text.muted}
              />
            </TouchableOpacity>
          </View>

          {/* ─── Reaction Bar (§3.7) ──────────────────── */}
          {currentTrack && (
            <ReactionBar
              onReact={(type) => handleReaction(currentTrack.id, type)}
              disabled={!currentTrack}
            />
          )}

          {/* ─── Queue Peek + CV Pill (§3.8) ──────────── */}
          <View style={styles.queuePeekSection}>
            {/* Label row */}
            <View style={styles.queuePeekHeader}>
              <TouchableOpacity
                onPress={() => setQueueSheetOpen(true)}
                style={styles.upNextLabel}
              >
                <Text
                  variant="label"
                  color={colors.text.secondary}
                  style={{ letterSpacing: 1.5, fontSize: 10 }}
                >
                  UP NEXT
                </Text>
                <Text variant="labelSmall" color={colors.text.muted}>
                  {queue.length > 1 ? `${queue.length - 1} track${queue.length - 1 !== 1 ? 's' : ''}` : ''}
                </Text>
              </TouchableOpacity>

              {/* CV Pill */}
              <TouchableOpacity
                style={[styles.cvPill, { borderColor: accent }]}
                onPress={() => setCvExpanded(!cvExpanded)}
                activeOpacity={0.7}
              >
                <Ionicons name="flash" size={12} color={accent} />
                <Text variant="labelSmall" color={accent} style={{ fontWeight: '600' }}>
                  {cv.balance} CV
                </Text>
                <Ionicons
                  name={cvExpanded ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={accent}
                />
              </TouchableOpacity>
            </View>

            {/* CV Expansion — Power Moves */}
            {cvExpanded && (
              <View style={styles.cvExpansion}>
                <TouchableOpacity
                  style={[styles.powerMoveBtn, !cv.canUse('phantom_power') && styles.powerMoveDisabled]}
                  onPress={() => nextTrack && handlePhantomPower(nextTrack.id)}
                  disabled={!cv.canUse('phantom_power') || !nextTrack}
                >
                  <Ionicons name="flash-outline" size={14} color={cv.canUse('phantom_power') ? colors.text.primary : colors.text.muted} />
                  <Text variant="labelSmall" color={cv.canUse('phantom_power') ? colors.text.primary : colors.text.muted}>
                    Phantom Power · 5 CV
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.powerMoveBtn, !cv.canUse('phase_cancel') && styles.powerMoveDisabled]}
                  onPress={handlePhaseCancel}
                  disabled={!cv.canUse('phase_cancel')}
                >
                  <Ionicons name="shield-outline" size={14} color={cv.canUse('phase_cancel') ? colors.text.primary : colors.text.muted} />
                  <Text variant="labelSmall" color={cv.canUse('phase_cancel') ? colors.text.primary : colors.text.muted}>
                    Phase Cancel · 15 CV
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.powerMoveBtn, !cv.canUse('overdrive') && styles.powerMoveDisabled]}
                  onPress={() => nextTrack && handleOverdrive(nextTrack.id)}
                  disabled={!cv.canUse('overdrive') || !nextTrack}
                >
                  <Ionicons name="rocket-outline" size={14} color={cv.canUse('overdrive') ? colors.action.destructive : colors.text.muted} />
                  <Text variant="labelSmall" color={cv.canUse('overdrive') ? colors.action.destructive : colors.text.muted}>
                    Overdrive · 25 CV
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Next track peek card */}
            {nextTrack ? (
              <TouchableOpacity
                style={styles.peekCard}
                onPress={() => setQueueSheetOpen(true)}
                onLongPress={() => handleLongPress(nextTrack)}
                activeOpacity={0.7}
              >
                {(nextTrack.albumArt || nextTrack.artwork) ? (
                  <Image
                    source={{ uri: nextTrack.albumArt || nextTrack.artwork }}
                    style={styles.peekArt}
                  />
                ) : (
                  <View style={[styles.peekArt, styles.peekArtPlaceholder]}>
                    <Ionicons name="musical-note" size={18} color={colors.text.muted} />
                  </View>
                )}
                <View style={styles.peekText}>
                  <Text variant="body" color={colors.text.primary} numberOfLines={1}>
                    {nextTrack.title}
                  </Text>
                  <Text variant="bodySmall" color={colors.text.secondary} numberOfLines={1}>
                    {nextTrack.artist}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleLongPress(nextTrack)}>
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.muted} />
                </TouchableOpacity>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.peekCardEmpty}
                onPress={() => { setQueueSheetOpen(true); setSearchInSheet(true); }}
              >
                <Ionicons name="add-circle-outline" size={20} color={accent} />
                <Text variant="body" color={colors.text.muted}>
                  Add a track to the queue
                </Text>
              </TouchableOpacity>
            )}

            {/* Pull-up hint */}
            {queue.length > 2 && (
              <TouchableOpacity onPress={() => setQueueSheetOpen(true)} style={styles.pullUpHint}>
                <Text variant="labelSmall" color={colors.text.muted}>
                  Pull up for full queue
                </Text>
                <Ionicons name="chevron-up" size={14} color={colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Spotlight: Suggestions banner (non-host) */}
          {isSpotlight && !isHost && suggestedQueue.length > 0 && (
            <View style={styles.pendingBanner}>
              <Text variant="bodySmall" color={colors.text.muted} align="center">
                {suggestedQueue.length} suggestion{suggestedQueue.length !== 1 ? 's' : ''} pending host approval
              </Text>
            </View>
          )}
        </ScrollView>

        {/* ─── Join/Leave Toast ─────────────────────────── */}
        <JoinLeaveToast messages={toasts} />

        {/* ═══ QUEUE BOTTOM SHEET (§3.9) ═════════════════ */}
        <Modal
          visible={queueSheetOpen}
          animationType="slide"
          transparent
          onRequestClose={() => { setQueueSheetOpen(false); setSearchInSheet(false); }}
        >
          <View style={styles.sheetBackdrop}>
            <TouchableOpacity
              style={styles.sheetBackdropTouch}
              onPress={() => { setQueueSheetOpen(false); setSearchInSheet(false); }}
              activeOpacity={1}
            />
            <View style={styles.sheetContainer}>
              {/* Drag handle */}
              <View style={styles.sheetHandle} />

              {/* Sheet header */}
              <View style={styles.sheetHeader}>
                <Text variant="labelLarge" color={colors.text.primary}>
                  Queue
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.addTrackBtn, { borderColor: accent }]}
                    onPress={() => setSearchInSheet(!searchInSheet)}
                  >
                    <Ionicons name="add" size={16} color={accent} />
                    <Text variant="label" color={accent} style={{ fontSize: 12 }}>
                      Add track
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setQueueSheetOpen(false); setSearchInSheet(false); }}>
                    <Ionicons name="close" size={24} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Search (inside sheet) */}
              {searchInSheet && (
                <View style={styles.sheetSearchRow}>
                  <TextInput
                    ref={searchInputRef}
                    style={styles.sheetSearchInput}
                    placeholder="Search for tracks..."
                    placeholderTextColor={colors.text.muted}
                    value={query}
                    onChangeText={setQuery}
                    autoFocus
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={handleCancelSearch}>
                    <Text variant="label" color={colors.text.muted}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Search results */}
              {searchInSheet && query.length > 0 ? (
                <View style={{ flex: 1 }}>
                  {isSearching && (
                    <ActivityIndicator color={accent} style={{ marginVertical: spacing.sm }} />
                  )}
                  <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <SearchResultItem track={item} onAdd={handleAddTrack} />}
                    keyboardShouldPersistTaps="handled"
                    style={{ flex: 1 }}
                    initialNumToRender={8}
                    maxToRenderPerBatch={5}
                    windowSize={7}
                  />
                </View>
              ) : searchInSheet && recentSearches.length > 0 ? (
                <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
                  <Text variant="labelSmall" color={colors.text.muted} style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Recent Searches
                  </Text>
                  {recentSearches.slice(0, 6).map((s) => (
                    <TouchableOpacity
                      key={s.query + s.timestamp}
                      style={styles.recentItem}
                      onPress={() => setQuery(s.query)}
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
                </View>
              ) : (
                /* Queue list */
                <FlatList<QueueTrack>
                  data={queue}
                  keyExtractor={(item, i) => item.id + '_' + i}
                  renderItem={({ item, index }) => (
                    <ADSRFadeIn index={index} staggerMs={40}>
                      <SwipeableRow
                        onRemove={() => setQueue((prev) => prev.filter((t) => t.id !== item.id))}
                        enabled={index > 0}
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
                          onLongPress={() => handleLongPress(item)}
                          showDragHandle={isHost && index > 0}
                        />
                      </SwipeableRow>
                    </ADSRFadeIn>
                  )}
                  contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
                  ListHeaderComponent={
                    <>
                      {/* Spotlight: Suggestions panel (host only) */}
                      {isSpotlight && isHost && suggestedQueue.length > 0 && (
                        <View style={styles.suggestionsPanel}>
                          <Text variant="label" color={colors.text.secondary} style={{ marginBottom: spacing.sm }}>
                            Suggestions ({suggestedQueue.length})
                          </Text>
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
                    </>
                  }
                  ListEmptyComponent={
                    <View style={styles.sheetEmpty}>
                      <Ionicons name="musical-notes" size={32} color={colors.text.muted} />
                      <Text variant="body" color={colors.text.muted} style={{ marginTop: spacing.sm }}>
                        Queue is empty
                      </Text>
                      <TouchableOpacity
                        style={{ marginTop: spacing.sm }}
                        onPress={() => setSearchInSheet(true)}
                      >
                        <Text variant="label" color={accent}>
                          Search to add tracks
                        </Text>
                      </TouchableOpacity>
                    </View>
                  }
                  ListFooterComponent={
                    <PlayedHistory history={playedHistory} onRequeue={handleAddTrack} />
                  }
                />
              )}
            </View>
          </View>
        </Modal>

        {/* ═══ OVERFLOW BOTTOM SHEET ═════════════════════ */}
        <Modal
          visible={overflowOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setOverflowOpen(false)}
        >
          <View style={styles.sheetBackdrop}>
            <TouchableOpacity
              style={styles.sheetBackdropTouch}
              onPress={() => setOverflowOpen(false)}
              activeOpacity={1}
            />
            <View style={[styles.sheetContainer, { maxHeight: '50%' }]}>
              <View style={styles.sheetHandle} />
              <View style={{ padding: spacing.md, gap: 4 }}>
                {/* Share */}
                <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); handleShare(); }}>
                  <Ionicons name="share-outline" size={20} color={colors.text.primary} />
                  <Text variant="body" color={colors.text.primary}>Share Room</Text>
                </TouchableOpacity>
                {/* Copy Code */}
                <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); handleCopyCode(); }}>
                  <Ionicons name="copy-outline" size={20} color={colors.text.primary} />
                  <Text variant="body" color={colors.text.primary}>Copy Room Code</Text>
                  {session.joinCode && (
                    <Text variant="labelSmall" color={colors.text.muted} style={{ marginLeft: 'auto' }}>
                      {session.joinCode}
                    </Text>
                  )}
                </TouchableOpacity>
                {/* Chat */}
                <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); setChatOpen(true); }}>
                  <Ionicons name="chatbubble-outline" size={20} color={colors.text.primary} />
                  <Text variant="body" color={colors.text.primary}>Chat</Text>
                </TouchableOpacity>
                {/* Lyrics */}
                {currentTrack && (
                  <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); setLyricsVisible(true); }}>
                    <Ionicons name="musical-notes-outline" size={20} color={colors.text.primary} />
                    <Text variant="body" color={colors.text.primary}>Lyrics</Text>
                  </TouchableOpacity>
                )}
                {/* QR Code */}
                <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); setShowQR(true); }}>
                  <Ionicons name="qr-code-outline" size={20} color={colors.text.primary} />
                  <Text variant="body" color={colors.text.primary}>Show QR Code</Text>
                </TouchableOpacity>
                {/* Divider */}
                <View style={styles.overflowDivider} />
                {/* Leave / End */}
                <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); handleLeaveRoom(); }}>
                  <Ionicons
                    name={isHost ? 'close-circle-outline' : 'exit-outline'}
                    size={20}
                    color={colors.action.destructive}
                  />
                  <Text variant="body" color={colors.action.destructive}>
                    {isHost ? 'End Session' : 'Leave Room'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ─── Track Context Menu ─────────────────────── */}
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

        {/* ─── QR Code Modal ─────────────────────────────── */}
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

        {/* ─── Layer 3: Resonance Event ────────────────── */}
        <ResonanceEvent
          type={resonanceState.type}
          message={resonanceState.message}
          cvBonus={resonanceState.cvBonus}
          active={resonanceState.active}
          duration={3000}
          onComplete={() => setResonanceState((prev) => ({ ...prev, active: false }))}
        />

        {/* ─── Layer 4: Transient Enter ────────────────── */}
        <TransientEnter
          username={transientUser.username}
          active={transientUser.active}
          onComplete={() => setTransientUser({ active: false, username: '' })}
        />

        {/* ─── Layer 4: Reverb Tails ────────────────────── */}
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

      {/* ─── Lyrics Overlay ──────────────────────────── */}
      <LyricsOverlay
        track={currentTrack || undefined}
        visible={lyricsVisible}
        onClose={() => setLyricsVisible(false)}
      />
    </SafeScreen>
  );
}

// ═════════════════════════════════════════════════════════════
// ─── STYLES ─────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  // Skeleton
  skeletonContainer: {
    flex: 1, padding: spacing.md,
  },
  skeletonHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: spacing.md, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },

  // ─── Header (§3.1) ───────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
  },
  overflowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Player Content ───────────────────────────────────
  playerContent: {
    alignItems: 'center',
    paddingBottom: spacing['2xl'],
  },

  // ─── Album Art (§3.3) ─────────────────────────────────
  albumArtContainer: {
    width: ALBUM_ART_SIZE,
    height: ALBUM_ART_SIZE,
    borderRadius: spacing.radius.sm,
    overflow: 'hidden',
    marginTop: spacing.md,
    backgroundColor: colors.bg.elevated,
  },
  albumArt: {
    width: '100%',
    height: '100%',
  },
  albumArtPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.elevated,
  },

  // ─── Track Info (§3.4) ────────────────────────────────
  trackInfo: {
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '700',
  },

  // ─── Progress Bar (§3.5) ──────────────────────────────
  progressContainer: {
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.xs,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border.default,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  // ─── Transport (§3.6) ─────────────────────────────────
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    paddingVertical: spacing.sm,
  },
  transportSecondary: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Queue Peek (§3.8) ────────────────────────────────
  queuePeekSection: {
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.md,
  },
  queuePeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  upNextLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cvPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderRadius: 100,
    borderWidth: 1,
  },
  cvExpansion: {
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: 4,
  },
  powerMoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  powerMoveDisabled: {
    opacity: 0.4,
  },
  peekCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing.sm,
  },
  peekArt: {
    width: 48,
    height: 48,
    borderRadius: 6,
  },
  peekArtPlaceholder: {
    backgroundColor: colors.bg.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  peekText: {
    flex: 1,
    gap: 2,
  },
  peekCardEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: spacing.radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderStyle: 'dashed',
    gap: 8,
  },
  pullUpHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    gap: 4,
  },

  // ─── Pending banner ───────────────────────────────────
  pendingBanner: {
    width: '100%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.screenPadding,
    marginTop: spacing.sm,
  },

  // ─── Queue Sheet (§3.9) ───────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdropTouch: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: '85%',
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    paddingHorizontal: 12,
    borderRadius: spacing.radius.full,
    borderWidth: 1,
    gap: 4,
  },
  sheetSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  sheetSearchInput: {
    flex: 1,
    height: 38,
    backgroundColor: colors.bg.input,
    borderRadius: 6,
    paddingHorizontal: 12,
    color: colors.text.primary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sheetEmpty: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },

  // ─── Suggestions (Spotlight) ──────────────────────────
  suggestionsPanel: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.chrome.border,
  },

  // ─── Overflow Sheet ───────────────────────────────────
  overflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
  },
  overflowDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: 4,
  },

  // ─── QR Modal ─────────────────────────────────────────
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
