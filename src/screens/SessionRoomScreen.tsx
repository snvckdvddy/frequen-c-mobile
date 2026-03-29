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
 *
 * Session Room V2 guardrails:
 * - Keep room overlays on the tactical V2 path; do not reintroduce legacy OverflowMenu/RoomSettingsPanel or native Alert-based room prompts.
 * - Queue adds are intentionally free in-room. CV is reserved for Power Routing and special room mechanics, not baseline queueing.
 * - Presence stays compact at the top; only the listener count pill should open the roster drawer.
 * - New room overlays must be folded into `closeTransientPanels()` so broad touch blockers never stack.
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
  Share, Keyboard, Modal, Platform,
  ScrollView, Dimensions, Image, Animated, Text as RNText,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, RoomModeBadge, ErrorState, showToast } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import api, { searchApi } from '../services/api';
import {
  addToQueue, voteTrack, sendReaction, skipTrack, removeTrack, voteSkip, trackEnded,
  approveTrackEvent, rejectTrackEvent, changeModeEvent, endSessionEvent,
  updateBehaviors, spendCV, duelVote, submitForecast, phantomPower,
  overdrive, phaseCancel, listenHeartbeat, joinSession, leaveSession, startForecast, startDuel,
  onSessionEvent
} from '../services/socket';
import {
  addTrackToQueue, applyVote, skipCurrentTrack, moveTrack as moveTrackEngine,
  approveTrack as approveTrackEngine, rejectTrack as rejectTrackEngine,
} from '../services/queueEngine';
import {
  loadTrack, onProgress, onTrackEnd, stop as stopPlayback,
  togglePlayPause, type PlaybackState,
} from '../services/playbackEngine';
import { USE_MOCKS } from '../services/config';
import { JoinLeaveToast, ListenerDrawer, type ToastMessage } from '../components/ListenerPresence';
import { ChatPanel } from '../components/ChatPanel';
import { useSearch } from '../hooks/useSearch';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { useActiveSession } from '../contexts/ActiveSessionContext';
import { useFavoritesContext } from '../contexts/FavoritesContext';

import { spacing } from '../theme/spacing';
import { tapMedium, tapLight, tapHeavy, notifyError, notifySuccess, notifyWarning } from '../utils/haptics';
// ─── Design System: Rack × Chrome visual language ──────────
import { VoidSurface, ModuleFaceplate, LEDReadout, ChromeButton, StatusLight } from '../design/components';
import { palette } from '../design/tokens/materials';
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, fontWeight, letterSpacing as ls } from '../design/tokens/typography';
import { notifyParticipantJoined, notifyTrackChanged } from '../services/notifications';
import {
  GameLayerOverlays,
  type DuelState, type ForecastState, type ResonanceState, type TransientState, type ReverbTailEntry,
} from '../components/room';
import type { Session, QueueTrack, Track, RoomMode, Listener, RoomBehaviors } from '../types';
import { DEFAULT_BEHAVIORS, BEHAVIOR_PRESETS } from '../types';
// QueueTrackCard moved to QueueSheet component
import { LyricsOverlay } from '../components/ui/LyricsOverlay';
// DraggableQueue, SearchResultItem, SuggestionCard, PlayedHistory moved to QueueSheet
import { OfflineBanner } from '../components/OfflineBanner';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useAppState } from '../hooks/useAppState';
import { getGlobalLimiter } from '../utils/rateLimiter';
import { TrackContextMenu } from '../components/ui';
import { QUEUE_ACTIONS, type ContextMenuAction } from '../components/ui/TrackContextMenu';
import { Skeleton, TrackCardSkeleton } from '../components/ui/Skeleton';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { useCV } from '../hooks/useCV';
import { useVoltageSag } from '../hooks/useVoltageSag';
import { useGlobalSessionRoom } from '../contexts/GlobalSessionRoomContext';
import PowerRoutingSheet, { type PowerMove, type PowerMoveId } from '../features/power-routing/PowerRoutingSheet';
import { buildTacticalReadout } from '../features/session-v2/adapters/buildTacticalReadout';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import TacticalRoomHeader from '../features/session-v2/components/TacticalRoomHeader';
import TacticalPresenceStrip from '../features/session-v2/components/TacticalPresenceStrip';
import TacticalAlbumHero from '../features/session-v2/components/TacticalAlbumHero';
import TacticalTrackMeta from '../features/session-v2/components/TacticalTrackMeta';
import TacticalWaveform from '../features/session-v2/components/TacticalWaveform';
import TacticalTransportDeck from '../features/session-v2/components/TacticalTransportDeck';
import TacticalReactionMatrix from '../features/session-v2/components/TacticalReactionMatrix';
import TacticalSystemPreferencesPanel from '../features/session-v2/components/TacticalSystemPreferencesPanel';
import TacticalActionPrompt from '../features/session-v2/components/TacticalActionPrompt';
import SignalChainSheetV2 from '../features/session-v2/components/SignalChainSheetV2';
import SearchHudOverlay from '../features/search-hud/SearchHudOverlay';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

type SocketReactionType = "fire" | "vibe" | "skip";

const isValidReaction = (type: string): type is SocketReactionType => {
  return ["fire", "vibe", "skip"].includes(type);
};

type PendingPowerPrompt =
  | { type: 'overdrive'; trackId: string }
  | { type: 'phase_cancel' };

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_ART_SIZE = SCREEN_WIDTH - 48;

// ─── Behavior summary helpers ────────────────────────────────
function getBehaviorSummary(behaviors: RoomBehaviors, isHost: boolean): string {
  const parts: string[] = [];
  switch (behaviors.queueOrdering) {
    case 'roundRobin': parts.push('Round-robin queue'); break;
    case 'voteWeighted': parts.push('Vote-weighted queue'); break;
    default: parts.push('FIFO queue');
  }
  if (behaviors.voteReordersQueue) parts.push('votes reorder');
  if (behaviors.requiresApproval) parts.push(isHost ? 'you approve adds' : 'host approves adds');
  if (behaviors.skipAccess === 'hostOnly') parts.push('host skips only');
  if (behaviors.skipAccess === 'voteRequired') parts.push('vote to skip');
  return parts.join(' · ');
}

// ─── Main Screen ─────────────────────────────────────────────

export function SessionRoomScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ SessionRoom: { sessionId: string } }, 'SessionRoom'>>();
  const { user } = useAuth();
  const sessionId = route.params?.sessionId;
  const { clearActiveSession } = useActiveSession();
  const { isFavorite, toggleFavorite } = useFavoritesContext();
  const { isConnected } = useNetworkStatus();
  const { isVoltageSag, accent, accentGlow } = useVoltageSag();

  const [chatOpen, setChatOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [listenerDrawerOpen, setListenerDrawerOpen] = useState(false);
  const [sharePromptOpen, setSharePromptOpen] = useState(false);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const [pendingPowerPrompt, setPendingPowerPrompt] = useState<PendingPowerPrompt | null>(null);

  const {
    session, setSession,
    queue, setQueue,
    suggestedQueue, setSuggestedQueue,
    playedHistory, loading, error, retrySession,
    listeners, setListeners,
    toasts, setToasts,
    playback, setPlayback,
    bounceVisible, setBounceVisible,
    skipVoteState, phaseCancelShield, advanceQueue,
    connectionId, setConnectionId
  } = useGlobalSessionRoom();

  useEffect(() => {
    if (sessionId && sessionId !== connectionId) {
      setConnectionId(sessionId);
    }
  }, [sessionId, connectionId, setConnectionId]);

  // ─── Bottom sheet & overflow state ─────────────────────────
  const [queueSheetOpen, setQueueSheetOpen] = useState(false);
  const [systemPreferencesOpen, setSystemPreferencesOpen] = useState(false);
  const [powerRoutingOpen, setPowerRoutingOpen] = useState(false);
  const [searchInSheet, setSearchInSheet] = useState(false);
  const [searchHudOpen, setSearchHudOpen] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardVisible(true);
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
  const [duelState, setDuelState] = useState<DuelState>({
    active: false,
    trackA: null,
    trackB: null,
    votes: { a: 0, b: 0 },
    timeRemaining: 0,
    totalTime: 0,
    userVote: null,
    lockedVotes: {},
  });

  // Frequency Forecast
  const [forecastState, setForecastState] = useState<ForecastState>({ active: false, candidates: [], reward: 0, timeRemaining: 0, userPick: null, lastResult: null });
  const duelDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forecastDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duelOptimisticStartRef = useRef(false);
  const forecastOptimisticStartRef = useRef(false);

  // Phase 6: Lyrics
  const [lyricsVisible, setLyricsVisible] = useState(false);

  // Resonance Event
  const [resonanceState, setResonanceState] = useState<ResonanceState>({ active: false, type: 'harmonic', message: '', cvBonus: 0 });

  // Transient Enter (user walk-on)
  const [transientUser, setTransientUser] = useState<TransientState>({ active: false, username: '' });

  // Reverb Tail (ghost presence)
  const [reverbTails, setReverbTails] = useState<ReverbTailEntry[]>([]);

  // Phantom Power boost (per-track)
  const [phantomBoost, setPhantomBoost] = useState<{
    active: boolean;
    trackId: string | null;
    username: string;
    trackName: string;
  }>({ active: false, trackId: null, username: '', trackName: '' });

  const [sessionStartTime] = useState(Date.now());


  const { query, setQuery, sources, setSources, results, fallbackUsed, providerStates, diagnostics, isSearching, clearSearch } = useSearch();
  const { searches: recentSearches, addSearch: saveRecentSearch, removeSearch: removeRecentSearch } = useRecentSearches();

  const resetDuelState = useCallback(() => {
    duelOptimisticStartRef.current = false;
    setDuelState({
      active: false,
      trackA: null,
      trackB: null,
      votes: { a: 0, b: 0 },
      timeRemaining: 0,
      totalTime: 0,
      userVote: null,
      lockedVotes: {},
    });
  }, []);

  const dismissDuelOverlay = useCallback(() => {
    if (duelDismissTimerRef.current) {
      clearTimeout(duelDismissTimerRef.current);
      duelDismissTimerRef.current = null;
    }
    resetDuelState();
  }, [resetDuelState]);

  const resetForecastState = useCallback(() => {
    forecastOptimisticStartRef.current = false;
    setForecastState({
      active: false,
      candidates: [],
      reward: 0,
      timeRemaining: 0,
      userPick: null,
      lastResult: null,
    });
  }, []);

  const dismissForecastOverlay = useCallback(() => {
    if (forecastDismissTimerRef.current) {
      clearTimeout(forecastDismissTimerRef.current);
      forecastDismissTimerRef.current = null;
    }
    resetForecastState();
  }, [resetForecastState]);

  const armDuelOverlay = useCallback((trackA: QueueTrack, trackB: QueueTrack, duration: number) => {
    if (duelDismissTimerRef.current) {
      clearTimeout(duelDismissTimerRef.current);
      duelDismissTimerRef.current = null;
    }
    setDuelState((prev) => {
      const sameMatch =
        prev.active &&
        prev.trackA?.id === trackA.id &&
        prev.trackB?.id === trackB.id;

      return {
        active: true,
        trackA,
        trackB,
        votes: sameMatch ? prev.votes : { a: 0, b: 0 },
        timeRemaining: duration,
        totalTime: duration,
        userVote: sameMatch ? prev.userVote : null,
        lockedVotes: sameMatch ? prev.lockedVotes : {},
      };
    });
  }, []);

  const armForecastOverlay = useCallback((candidates: QueueTrack[], reward: number, duration: number) => {
    if (forecastDismissTimerRef.current) {
      clearTimeout(forecastDismissTimerRef.current);
      forecastDismissTimerRef.current = null;
    }
    setForecastState((prev) => {
      const sameCandidateIds =
        prev.active &&
        prev.candidates.length === candidates.length &&
        prev.candidates.every((candidate, index) => candidate.id === candidates[index]?.id);

      return {
        active: true,
        candidates,
        reward,
        timeRemaining: duration,
        userPick: sameCandidateIds ? prev.userPick : null,
        lastResult: null,
      };
    });
  }, []);

  const applyDuelQueueResult = useCallback((winnerId: string, loserId: string) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const current = prev[0] || null;
      const challengers = prev.slice(1);
      const winner = challengers.find((track) => track.id === winnerId) || null;
      const remaining = challengers.filter((track) => track.id !== winnerId && track.id !== loserId);

      if (current) {
        return winner ? [current, winner, ...remaining] : [current, ...remaining];
      }

      return winner ? [winner, ...remaining] : remaining;
    });
  }, []);

  const finalizeDuel = useCallback((
    winner: 'a' | 'b',
    trackA: QueueTrack,
    trackB: QueueTrack,
    votes: { a: number; b: number },
  ) => {
    const winnerTrack = winner === 'a' ? trackA : trackB;
    const loserTrack = winner === 'a' ? trackB : trackA;

    applyDuelQueueResult(winnerTrack.id, loserTrack.id);
    setDuelState((prev) => ({
      ...prev,
      active: true,
      trackA,
      trackB,
      votes,
      timeRemaining: 0,
      totalTime: prev.totalTime || 18,
    }));
    showToast(`${winnerTrack.title} won the duel. ${loserTrack.title} dropped.`, 'success', '!');

    if (duelDismissTimerRef.current) {
      clearTimeout(duelDismissTimerRef.current);
    }
    duelDismissTimerRef.current = setTimeout(() => {
      resetDuelState();
      duelDismissTimerRef.current = null;
    }, 2400);
  }, [applyDuelQueueResult, resetDuelState]);




  // ─── Listen heartbeat (1 CV per minute of active listening) ──
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      listenHeartbeat(sessionId);
    }, 60_000); // Every 60 seconds
    return () => clearInterval(interval);
  }, [sessionId]);

  // ─── Listener presence (join/leave events) ──────────────
  useEffect(() => {
    const unsubs = [
      onSessionEvent('participant-joined', (participant: Listener) => {
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
      onSessionEvent('participant-left', (data: { userId: string }) => {
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

  // ─── Mock: simulate someone joining after 5s (mock mode only) ──
  useEffect(() => {
    if (!session) return;
    // Only run fake joiners in mock mode — real server handles participants
    if (!USE_MOCKS) return;
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

  useEffect(() => {
    const unsubs = [
      onSessionEvent('duel:start', (data) => {
        armDuelOverlay(data.trackA, data.trackB, data.duration);
        tapLight();
        if (duelOptimisticStartRef.current) {
          duelOptimisticStartRef.current = false;
        } else {
          showToast('Crossfader Duel is live. Lock a side.', 'info', '!');
        }
      }),
      onSessionEvent('duel:vote', (data) => {
        setDuelState((prev) => {
          if (!prev.active || prev.lockedVotes[data.userId]) return prev;
          return {
            ...prev,
            votes: {
              a: prev.votes.a + (data.side === 'a' ? 1 : 0),
              b: prev.votes.b + (data.side === 'b' ? 1 : 0),
            },
            lockedVotes: {
              ...prev.lockedVotes,
              [data.userId]: data.side,
            },
            userVote: data.userId === user?.id ? data.side : prev.userVote,
          };
        });
      }),
      onSessionEvent('duel:end', (data) => {
        if (duelDismissTimerRef.current) return;
        duelOptimisticStartRef.current = false;
        finalizeDuel(data.winner, data.trackA, data.trackB, data.votes);
      }),
      onSessionEvent('forecast:start', (data) => {
        armForecastOverlay(data.candidates, data.reward, data.duration);
        tapLight();
        if (forecastOptimisticStartRef.current) {
          forecastOptimisticStartRef.current = false;
        } else {
          showToast('Frequency Forecast is live. Lock your prediction.', 'info', '!');
        }
      }),
      onSessionEvent('forecast:result', (data) => {
        if (forecastDismissTimerRef.current) return;
        forecastOptimisticStartRef.current = false;
        setForecastState((prev) => {
          const predicted = data.predictions[user?.id || ''] || prev.userPick;
          return {
            ...prev,
            timeRemaining: 0,
            lastResult: predicted
              ? {
                  predicted,
                  actual: data.winnerId,
                  correct: predicted === data.winnerId,
                  earned: predicted === data.winnerId ? prev.reward : 0,
                }
              : null,
          };
        });
        forecastDismissTimerRef.current = setTimeout(() => {
          resetForecastState();
          forecastDismissTimerRef.current = null;
        }, 3200);
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
      if (duelDismissTimerRef.current) {
        clearTimeout(duelDismissTimerRef.current);
        duelDismissTimerRef.current = null;
      }
      if (forecastDismissTimerRef.current) {
        clearTimeout(forecastDismissTimerRef.current);
        forecastDismissTimerRef.current = null;
      }
    };
  }, [armDuelOverlay, armForecastOverlay, finalizeDuel, resetForecastState, user?.id]);

  useEffect(() => {
    if (!duelState.active || duelState.timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setDuelState((prev) =>
        prev.active && prev.timeRemaining > 0
          ? { ...prev, timeRemaining: prev.timeRemaining - 1 }
          : prev,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [duelState.active, duelState.timeRemaining]);

  useEffect(() => {
    if (!duelState.active || duelState.timeRemaining > 0) return;
    if (duelDismissTimerRef.current || !duelState.trackA || !duelState.trackB) return;

    const winner: 'a' | 'b' = duelState.votes.b > duelState.votes.a ? 'b' : 'a';
    finalizeDuel(winner, duelState.trackA, duelState.trackB, duelState.votes);
  }, [
    duelState.active,
    duelState.timeRemaining,
    duelState.trackA,
    duelState.trackB,
    duelState.votes,
    finalizeDuel,
  ]);

  useEffect(() => {
    if (!forecastState.active || forecastState.timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setForecastState((prev) =>
        prev.active && prev.timeRemaining > 0
          ? { ...prev, timeRemaining: prev.timeRemaining - 1 }
          : prev,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [forecastState.active, forecastState.timeRemaining]);

  useEffect(() => {
    if (!forecastState.active || forecastState.timeRemaining > 0) return;
    if (forecastState.lastResult || forecastDismissTimerRef.current) return;

    const winnerId = forecastState.candidates[0]?.id || '';
    setForecastState((prev) => ({
      ...prev,
      lastResult: prev.userPick
        ? {
            predicted: prev.userPick,
            actual: winnerId,
            correct: prev.userPick === winnerId,
            earned: prev.userPick === winnerId ? prev.reward : 0,
          }
        : null,
    }));
    forecastDismissTimerRef.current = setTimeout(() => {
      resetForecastState();
      forecastDismissTimerRef.current = null;
    }, 3200);
  }, [forecastState.active, forecastState.timeRemaining, forecastState.lastResult, forecastState.candidates, resetForecastState]);

  // ─── Playback engine ────────────────────────────────────
  // Host-output model: only the host device plays audio and signals track-end.
  // Non-host devices receive queue/playback state via socket events.
  // Hoisted here (ahead of "Derived values" section) because playback effects need it.
  const isHost = user?.id === session?.hostId;

  useEffect(() => {
    if (!isHost) return;
    const unsub = onProgress((s) => setPlayback(s));
    return () => { unsub(); stopPlayback(); };
  }, [setPlayback, isHost]);

  const currentTrackRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost) return;

    const nowPlaying = queue[0] || null;
    if (nowPlaying && nowPlaying.id !== currentTrackRef.current) {
      currentTrackRef.current = nowPlaying.id;
      loadTrack(nowPlaying.id, nowPlaying.duration || 30, nowPlaying.previewUrl, nowPlaying.sourceId, nowPlaying.source);
      if (user?.connectedServices?.lastfm?.connected) {
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
  }, [queue, isHost, user?.connectedServices?.lastfm?.connected]);

  useEffect(() => {
    // Only the host signals track-end to the backend. Without this guard,
    // every connected user would emit 'track-ended', advancing the queue
    // multiple times per track.
    if (!isHost) return;
    const unsub = onTrackEnd(() => {
      advanceQueue();
      trackEnded(sessionId);
    });
    return unsub;
  }, [advanceQueue, sessionId, isHost]);

  // ─── Handlers ─────────────────────────────────────────
  // Queueing is intentionally passive/free in Session V2.
  // Do not attach CV spend, tactical prompts, or power-routing costs to baseline add-to-queue.
  const handleAddTrack = useCallback((track: Track) => {
    if (!user || !session || !sessionId) return false;
    if (!getGlobalLimiter().canDo('addTrack')) return false;
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
    return true;
  }, [user, session, sessionId, query, saveRecentSearch]);

  // AI: Add a suggested track by searching for it first
  const handleAddSuggestion = useCallback(async (title: string, artist: string) => {
    try {
      const searchQuery = `${title} ${artist}`;
      const data = await searchApi.tracks(searchQuery);
      if (data.tracks && data.tracks.length > 0) {
        handleAddTrack(data.tracks[0]);
      } else {
        notifyWarning();
        showToast(`No match found for ${title} by ${artist}.`, 'warning', '!');
      }
    } catch (err: unknown) {
      console.warn('[AI Suggestion] Search failed:', err instanceof Error ? err.message : String(err));
      notifyError();
      showToast('Failed to search suggested track.', 'error', '!');
    }
  }, [handleAddTrack]);

  // Room Settings: emit behavior update to all clients
  const handleUpdateBehaviors = useCallback((partial: Partial<RoomBehaviors>) => {
    if (!session) return;
    updateBehaviors(sessionId, partial);
    // Optimistic local update (server will broadcast back via 'behaviors-updated')
    setSession((prev) => prev ? {
      ...prev,
      behaviors: { ...(prev.behaviors || DEFAULT_BEHAVIORS), ...partial },
    } : prev);
  }, [session, sessionId]);

  const handleVote = useCallback((trackId: string, direction: 1 | -1) => {
    if (!user) return;
    if (!getGlobalLimiter().canDo('vote')) return;
    tapMedium();
    const behaviors = session?.behaviors || DEFAULT_BEHAVIORS;
    setQueue((prev) => applyVote(prev, trackId, user.id, direction, behaviors));
    voteTrack(sessionId, trackId, user.id, direction);
  }, [user, sessionId, session?.behaviors]);

  const handleReaction = useCallback((trackId: string, type: string) => {
    if (!user) return;
    if (!getGlobalLimiter().canDo('reaction')) return;
    
    if (isValidReaction(type)) {
      tapLight();
      sendReaction(sessionId, trackId, user.id, type);
    } else {
      console.warn(`Invalid reaction type received: ${type}`);
    }
  }, [user, sessionId]);

  const handlePlayPause = useCallback(() => {
    tapLight();
    togglePlayPause();
  }, []);

  const handleRetryPlayback = useCallback(() => {
    const retryTrack = queue[0];
    if (!retryTrack) return;
    loadTrack(retryTrack.id, retryTrack.duration || 30, retryTrack.previewUrl, retryTrack.sourceId, retryTrack.source).catch((err) => {
      console.warn('[SessionRoom] Playback retry failed:', err);
    });
  }, [queue]);

  const handleToggleFavorite = useCallback((track: Track) => {
    const favoriteTrack = { ...track, id: track.sourceId || track.id };
    toggleFavorite(favoriteTrack);
  }, [toggleFavorite]);

  const handleSkip = useCallback(() => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('skip')) return;
    const behaviors = session.behaviors || DEFAULT_BEHAVIORS;
    const { skipped, reason } = skipCurrentTrack(queue, user.id, session.hostId, behaviors);
    if (!skipped) {
      if (reason === 'voteRequired') {
        // In vote-skip mode, toggle user's skip vote instead of direct skip
        tapMedium();
        voteSkip(sessionId);
        return;
      }
      notifyWarning();
      showToast('Skip is restricted in this room.', 'warning', '!');
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
    if (duelState.userVote) return;
    tapHeavy();
    setDuelState((prev) => ({ ...prev, userVote: side }));
    duelVote(sessionId, user.id, side);
  }, [user, session, sessionId, duelState.userVote]);

  const handleStartDuel = useCallback(() => {
    if (!user || !session) return false;
    const hostCanStartDuel = user.id === session.hostId;
    const duelEnabled = (session.behaviors || DEFAULT_BEHAVIORS).duelEnabled;
    const challengerA = queue[1];
    const challengerB = queue[2];

    if (!hostCanStartDuel) {
      notifyWarning();
      showToast('Only the host can start a duel.', 'warning', '!');
      return false;
    }
    if (!duelEnabled) {
      notifyWarning();
      showToast('Enable Crossfader Duel in room settings first.', 'warning', '!');
      return false;
    }
    if (duelState.active) {
      notifyWarning();
      showToast('A duel is already active in this room.', 'info', '!');
      return false;
    }
    if (!challengerA || !challengerB || queue.length < 3) {
      notifyWarning();
      showToast('Need at least 3 queued tracks to launch a duel.', 'warning', '!');
      return false;
    }

    tapMedium();

    duelOptimisticStartRef.current = true;
    armDuelOverlay(challengerA, challengerB, 18);
    startDuel(sessionId, challengerA.id, challengerB.id, 18);
    showToast('Duel armed. Lock a side.', 'info', '!');
    return true;
  }, [user, session, duelState.active, queue, sessionId, armDuelOverlay]);

  const handleForecastPick = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('forecast')) return;
    tapMedium();
    submitForecast(sessionId, user.id, trackId);
    setForecastState((prev) => ({ ...prev, userPick: trackId }));
  }, [user, session, sessionId]);

  const handleStartForecast = useCallback(() => {
    if (!user || !session) return false;
    const hostCanStartForecast = user.id === session.hostId;
    const forecastEnabled = (session.behaviors || DEFAULT_BEHAVIORS).forecastEnabled;

    if (!hostCanStartForecast) {
      notifyWarning();
      showToast('Only the host can start a forecast.', 'warning', '!');
      return false;
    }
    if (!forecastEnabled) {
      notifyWarning();
      showToast('Enable Frequency Forecast in room settings first.', 'warning', '!');
      return false;
    }
    if (forecastState.active) {
      notifyWarning();
      showToast('A forecast is already in progress.', 'info', '!');
      return false;
    }
    if (queue.length < 2) {
      notifyWarning();
      showToast('Need at least 2 tracks in queue to forecast.', 'warning', '!');
      return false;
    }

    tapMedium();

    forecastOptimisticStartRef.current = true;
    armForecastOverlay(queue.slice(0, Math.min(5, queue.length)), 2, 20);
    startForecast(sessionId);
    showToast('Forecast armed. Lock a prediction.', 'info', '!');
    return true;
  }, [user, session, forecastState.active, queue, sessionId, armForecastOverlay]);

  const handlePhantomPower = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('phantom_power')) {
      notifyWarning();
      showToast('Need 5 CV for Phantom Power.', 'warning', '!');
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
      notifyWarning();
      showToast('Need 25 CV for Overdrive.', 'warning', '!');
      return;
    }
    setPendingPowerPrompt({ type: 'overdrive', trackId });
  }, [user, session, sessionId, cv]);

  const handlePhaseCancel = useCallback(() => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('phase_cancel')) {
      notifyWarning();
      showToast('Need 15 CV for Phase Cancel.', 'warning', '!');
      return;
    }
    setPendingPowerPrompt({ type: 'phase_cancel' });
  }, [user, session, sessionId, cv]);

  // ─── CVPill power move dispatch ────────────────────────
  const handlePowerMove = useCallback((moveType: PowerMoveId) => {
    const track = queue[0]; // Power moves act on current track
    switch (moveType) {
      case 'overdrive':
        if (track) handleOverdrive(track.id);
        break;
      case 'phase_cancel':
        handlePhaseCancel();
        break;
      case 'phantom_power':
        if (track) handlePhantomPower(track.id);
        break;
    }
  }, [queue, handleOverdrive, handlePhaseCancel, handlePhantomPower]);

  // ─── Context menu ──────────────────────────────────────
  const [contextTrack, setContextTrack] = useState<QueueTrack | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);

  // Central authority for mutually-exclusive room overlays.
  // Any new modal/panel introduced in SessionRoomScreen should be closed here before it is considered "safe" to render in-room.
  const closeTransientPanels = useCallback(() => {
    setQueueSheetOpen(false);
    setSystemPreferencesOpen(false);
    setPowerRoutingOpen(false);
    setSearchInSheet(false);
    setSearchHudOpen(false);
    setChatOpen(false);
    setShowQR(false);
    setListenerDrawerOpen(false);
    setSharePromptOpen(false);
    setLeavePromptOpen(false);
    setPendingPowerPrompt(null);
    setContextMenuVisible(false);
    setLyricsVisible(false);
  }, []);

  useEffect(() => {
    closeTransientPanels();
  }, [sessionId, closeTransientPanels]);

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
      case 'phaseCancel':
        handlePhaseCancel();
        break;
      default:
        break;
    }
  }, [handleToggleFavorite, handleOverdrive, handlePhantomPower, handlePhaseCancel]);

  // ─── Room Preset Switching (host only) ───────────────────
  const handleSelectMode = useCallback((mode: RoomMode) => {
    if (!session || !user || user.id !== session.hostId) return;
    if (mode === session.roomMode) return;
    tapMedium();
    const newBehaviors = { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS[mode] };
    setSession((prev) => prev ? { ...prev, roomMode: mode, behaviors: newBehaviors } : prev);
    changeModeEvent(sessionId, mode);
  }, [session, user, sessionId]);

  // Share/leave now live on tactical prompts so the room flow stays visually consistent.
  // Keep native OS UI only for the actual Share API handoff.
  const handleShare = useCallback(() => {
    if (!session) return;
    setSharePromptOpen(true);
  }, [session]);

  const handleShareLink = useCallback(() => {
    if (!session) return;
    setSharePromptOpen(false);
    void Share.share({
      message: `Join my Frequen-C room "${session.name}"!\nfrequenc://join/${session.joinCode}`,
      url: `frequenc://join/${session.joinCode}`,
    });
  }, [session]);

  const handleCopyCode = useCallback(async () => {
    if (!session?.joinCode) return;
    await Clipboard.setStringAsync(session.joinCode);
    tapLight();
    showToast(`Room code ${session.joinCode} copied.`, 'success', '!');
  }, [session]);

  // ─── Leave / End Session ───────────────────────────────
  const handleLeaveRoom = useCallback(() => {
    if (!user || !session) return;
    setLeavePromptOpen(true);
  }, [user, session, sessionId, navigation, clearActiveSession]);

  const handleConfirmLeaveRoom = useCallback(() => {
    if (!user || !session) return;
    setLeavePromptOpen(false);
    tapHeavy();
    if (user.id === session.hostId) {
      endSessionEvent(sessionId);
    } else {
      leaveSession(sessionId, user.id);
    }
    clearActiveSession();
    setConnectionId(null);
    navigation.goBack();
  }, [user, session, sessionId, navigation, clearActiveSession, setConnectionId]);

  const handleConfirmPowerPrompt = useCallback(() => {
    if (!user || !session || !pendingPowerPrompt) return;
    tapHeavy();
    if (pendingPowerPrompt.type === 'overdrive') {
      cv.spend('overdrive');
      overdrive(sessionId, pendingPowerPrompt.trackId, user.id);
    } else {
      cv.spend('phase_cancel');
      phaseCancel(sessionId, user.id);
    }
    setPendingPowerPrompt(null);
  }, [user, session, pendingPowerPrompt, cv, sessionId]);

  // ─── Search within queue sheet ─────────────────────────
  const handleCancelSearch = useCallback(() => {
    clearSearch();
    setSearchInSheet(false);
    Keyboard.dismiss();
  }, [clearSearch]);

  // ─── Derived values ────────────────────────────────────
  // isHost is declared above (playback engine section) — needed before effects.
  const currentTrack: QueueTrack | null = queue[0] || null;
  const sessionBehaviors = session?.behaviors || DEFAULT_BEHAVIORS;
  const canStartDuel = !!isHost
    && sessionBehaviors.duelEnabled
    && !duelState.active
    && queue.length >= 3;
  const duelActionDescription = !isHost
    ? 'Host-only head-to-head queue battles.'
    : !sessionBehaviors.duelEnabled
      ? 'Enable Crossfader Duel in Room Settings first.'
      : duelState.active
        ? 'A head-to-head battle is already active in this room.'
        : queue.length < 3
          ? 'Need at least 3 queued tracks so two challengers can battle behind the live track.'
          : 'Launch a timed battle between the next two challengers in queue.';
  const canStartForecast = !!isHost
    && sessionBehaviors.forecastEnabled
    && !forecastState.active
    && queue.length >= 2;
  const forecastActionDescription = !isHost
    ? 'Host-only prediction rounds.'
    : !sessionBehaviors.forecastEnabled
      ? 'Enable Frequency Forecast in Room Settings first.'
      : forecastState.active
        ? 'A prediction round is already live in this room.'
        : queue.length < 2
          ? 'Need at least 2 tracks in queue to launch a forecast.'
          : 'Launch a 20-second prediction round for the current queue.';
  const powerRoutingMoves = useMemo<PowerMove[]>(() => {
    const hasTrackTarget = !!currentTrack;
    return [
      {
        id: 'phantom_power',
        name: 'PHANTOM_PWR',
        cost: 5,
        description: hasTrackTarget
          ? 'Inject +5 votes to the active track in this room.'
          : 'Requires an active track in the room.',
        variant: 'acid',
        disabled: !hasTrackTarget,
      },
      {
        id: 'phase_cancel',
        name: 'PHASE_CANCEL',
        cost: 15,
        description: 'Block the next skip attempt. Guarantee your track plays.',
        variant: 'ice',
      },
      {
        id: 'overdrive',
        name: 'OVERDRIVE',
        cost: 25,
        description: hasTrackTarget
          ? 'Force the active room track to the top of the queue.'
          : 'Requires an active track in the room.',
        variant: 'hotPink',
        disabled: !hasTrackTarget,
      },
    ];
  }, [currentTrack]);
  const isApprovalMode = sessionBehaviors.requiresApproval;
  const canSkip = sessionBehaviors.skipAccess === 'anyone'
    || (sessionBehaviors.skipAccess === 'hostOnly' && isHost)
    || sessionBehaviors.skipAccess === 'voteRequired'; // Everyone can vote-skip
  const isVoteSkipMode = sessionBehaviors.skipAccess === 'voteRequired';
  const hasVotedToSkip = skipVoteState?.voters?.includes(user?.id ?? '') ?? false;
  const systemId = ((session?.joinCode || session?.id?.slice(0, 4) || '----')).toUpperCase();
  const readout = useMemo(() => buildTacticalReadout(currentTrack), [currentTrack]);
  const reactionCounts = useMemo(() => {
    return (currentTrack?.reactions || []).reduce<Partial<Record<'fire' | 'vibe' | 'skip', number>>>(
      (acc, reaction) => {
        if (reaction.type === 'fire' || reaction.type === 'vibe' || reaction.type === 'skip') {
          acc[reaction.type] = (acc[reaction.type] || 0) + 1;
        }
        return acc;
      },
      {},
    );
  }, [currentTrack?.reactions]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ─── Loading state ────────────────────────────────────
  if (loading) {
    return (
      <SafeScreen>
        <VoidSurface style={{ flex: 1 }}>
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonHeader}>
              <Skeleton width={28} height={28} borderRadius={0} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Skeleton fill height={18} style={{ maxWidth: 180 }} />
              </View>
              <Skeleton width={60} height={24} borderRadius={0} />
            </View>
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
              <Skeleton width={ALBUM_ART_SIZE} height={ALBUM_ART_SIZE} borderRadius={0} />
            </View>
            <View style={{ alignItems: 'center', gap: 8, paddingBottom: spacing.lg }}>
              <Skeleton width={200} height={22} />
              <Skeleton width={140} height={16} />
            </View>
            <Skeleton fill height={2} style={{ marginHorizontal: spacing.screenPadding }} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 40, paddingVertical: spacing.md }}>
              <Skeleton width={32} height={32} borderRadius={0} />
              <Skeleton width={56} height={56} borderRadius={0} />
              <Skeleton width={32} height={32} borderRadius={0} />
            </View>
          </View>
        </VoidSurface>
      </SafeScreen>
    );
  }

  if (error || !session) {
    return (
      <SafeScreen>
        <VoidSurface style={{ flex: 1 }}>
          <ErrorState
            message={error || 'Session bus unavailable.'}
            onRetry={retrySession}
          />
        </VoidSurface>
      </SafeScreen>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ─── RENDER: Player-First Layout ──────────────────────────
  // ═══════════════════════════════════════════════════════════

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={{ flex: 1 }} pointerEvents="box-none">
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground />
          </View>
          {/* ─── Connection Status ──────────────────────── */}
          <OfflineBanner visible={!isConnected} />
          <ConnectionBanner />
          {currentTrack && playback.error && (
            <ErrorState
              variant="banner"
              message={`Preview unavailable for "${currentTrack.title}". Timer fallback is active.`}
              onRetry={handleRetryPlayback}
            />
          )}

          {/* ═══ HEADER + SIGNAL FLOW ═══════════════════════ */}
          <TacticalRoomHeader
            roomName={session.name}
            systemId={systemId}
            roomMode={session.roomMode}
            onBack={() => navigation.goBack()}
            onSettingsPress={() => {
              closeTransientPanels();
              setSystemPreferencesOpen(true);
            }}
          />

          <TacticalPresenceStrip
            listeners={listeners}
            hostId={session.hostId}
            currentUserId={user?.id}
            currentUsername={user?.username}
            // Keep the broad top strip passive; only the count pill should open the roster drawer.
            onPress={() => {
              closeTransientPanels();
              setListenerDrawerOpen(true);
            }}
          />

          {/* ═══ SCROLLABLE PLAYER CONTENT ═════════════════ */}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.tacticalPlayerContent,
              !currentTrack && styles.tacticalPlayerContentIdle,
            ]}
            showsVerticalScrollIndicator={false}
          >
            <TacticalAlbumHero track={currentTrack} readout={readout} />
            <TacticalTrackMeta
              track={currentTrack}
              voltage={cv.balance}
              onOpenPowerRouting={() => {
                closeTransientPanels();
                setPowerRoutingOpen(true);
              }}
            />
            <TacticalWaveform
              trackId={currentTrack?.id}
              elapsed={playback.elapsed}
              duration={playback.duration || currentTrack?.duration || 0}
              progress={playback.progress}
            />
            <TacticalTransportDeck
              hasCurrentTrack={!!currentTrack}
              isPlaying={playback.isPlaying}
              isLoading={playback.isLoading}
              canSkip={canSkip}
              isVoteSkipMode={isVoteSkipMode}
              hasVotedToSkip={hasVotedToSkip}
              skipVoteState={skipVoteState}
              onQueueOpen={() => {
                closeTransientPanels();
                setQueueSheetOpen(true);
              }}
              onChatOpen={() => {
                closeTransientPanels();
                setChatOpen(true);
              }}
              onPlayPause={handlePlayPause}
              onSkip={handleSkip}
            />
            <TacticalReactionMatrix
              counts={reactionCounts}
              disabled={!currentTrack}
              onReact={(type) => {
                if (!currentTrack) return;
                handleReaction(currentTrack.id, type);
              }}
            />
          </ScrollView>

          {/* ─── Join/Leave Toast ─────────────────────────── */}
          <JoinLeaveToast messages={toasts} />

          {/* ═══ QUEUE BOTTOM SHEET (§3.9) ═════════════════ */}
          {queueSheetOpen && (
            <SignalChainSheetV2
              visible
              roomMode={session.roomMode}
              behaviors={sessionBehaviors}
              queue={queue}
              suggestedQueue={suggestedQueue}
              playedHistory={playedHistory}
              voltage={cv.balance}
              searchInSheet={searchInSheet}
              query={query}
              results={results}
              searchFallbackUsed={fallbackUsed}
              isSearching={isSearching}
              recentSearches={recentSearches}
              isHost={isHost}
              keyboardVisible={keyboardVisible}
              keyboardHeight={keyboardHeight}
              onClose={() => { setQueueSheetOpen(false); setSearchInSheet(false); }}
              onOpenSearch={() => {
                if (Platform.OS === 'ios') {
                  // iOS only supports one active Modal — close queue first,
                  // then defer search open to avoid native modal overlap.
                  setQueueSheetOpen(false);
                  setSearchInSheet(false);
                  requestAnimationFrame(() => {
                    setSearchHudOpen(true);
                  });
                } else {
                  // Android handles stacked Modals fine — open SearchHudOverlay
                  // on top of the queue sheet. When search is dismissed, user
                  // lands right back in the queue with zero navigation cost.
                  setSearchHudOpen(true);
                }
              }}
              onCloseSearch={handleCancelSearch}
              onQueryChange={setQuery}
              onSelectMode={handleSelectMode}
              onAddTrack={handleAddTrack}
              onAddSuggestion={handleAddSuggestion}
              onVote={handleVote}
              onApproveTrack={handleApproveTrack}
              onRejectTrack={handleRejectTrack}
              onRemoveRecentSearch={removeRecentSearch}
              onLongPress={handleLongPress}
              onRequeueHistory={handleAddTrack}
            />
          )}

          {searchHudOpen && (
            <SearchHudOverlay
              visible
              query={query}
              onQueryChange={setQuery}
              sources={sources}
              onSourcesChange={setSources}
              results={results}
              fallbackUsed={fallbackUsed}
              providerStates={providerStates}
              diagnostics={diagnostics}
              isSearching={isSearching}
              queuedTrackIds={queue.map((t) => t.id)}
              onClose={() => setSearchHudOpen(false)}
              onPatchTrack={(track) => {
                handleAddTrack(track);
              }}
              onAddSuggestion={handleAddSuggestion}
              connectedServices={user?.connectedServices}
            />
          )}

          {/* ═══ SYSTEM PREFERENCES PANEL V2 ═══════════════ */}
          {systemPreferencesOpen && (
            <TacticalSystemPreferencesPanel
              visible
              isHost={isHost}
              hasCurrentTrack={!!currentTrack}
              roomCode={session.joinCode}
              behaviors={sessionBehaviors}
              onClose={() => setSystemPreferencesOpen(false)}
              onShare={handleShare}
              onCopyCode={handleCopyCode}
              onOpenChat={() => {
                closeTransientPanels();
                setChatOpen(true);
              }}
              onOpenLyrics={() => {
                closeTransientPanels();
                setLyricsVisible(true);
              }}
              onShowQrCode={() => {
                closeTransientPanels();
                setShowQR(true);
              }}
              onLeaveRoom={handleLeaveRoom}
              duelActionEnabled={canStartDuel}
              duelActionDescription={duelActionDescription}
              onStartDuel={handleStartDuel}
              canStartForecast={canStartForecast}
              forecastActionDescription={forecastActionDescription}
              onStartForecast={handleStartForecast}
              onUpdateBehaviors={handleUpdateBehaviors}
            />
          )}

          {powerRoutingOpen && (
            <PowerRoutingSheet
              visible
              voltage={cv.balance}
              moves={powerRoutingMoves}
              onClose={() => setPowerRoutingOpen(false)}
              onExecute={(moveId) => {
                setPowerRoutingOpen(false);
                handlePowerMove(moveId);
              }}
            />
          )}

          {/* ─── Track Context Menu ─────────────────────── */}
          {contextMenuVisible && (
            <TrackContextMenu
              visible
              track={contextTrack}
              actions={QUEUE_ACTIONS}
              onAction={handleContextAction}
              onClose={() => setContextMenuVisible(false)}
            />
          )}

          {/* ─── Chat Panel ────────────────────────────────── */}
          {chatOpen && (
            <ChatPanel
              sessionId={session.id}
              userId={user?.id || ''}
              username={user?.username || ''}
              visible
              onClose={() => setChatOpen(false)}
            />
          )}

          {listenerDrawerOpen && (
            <ListenerDrawer
              visible
              listeners={listeners}
              hostId={session.hostId}
              onClose={() => setListenerDrawerOpen(false)}
            />
          )}

          {sharePromptOpen && (
            <TacticalActionPrompt
              visible
              eyebrow="SYS.FREQ // SHARE BUS"
              title="SHARE ROOM"
              description="Distribute the room link or open an in-room QR handoff."
              onClose={() => setSharePromptOpen(false)}
              actions={[
                {
                  label: 'Show QR Code',
                  description: 'Display the room join code as a tactical QR overlay.',
                  icon: 'qr-code-outline',
                  onPress: () => {
                    setSharePromptOpen(false);
                    setShowQR(true);
                  },
                },
                {
                  label: 'Share Link',
                  description: 'Open the native share sheet with the room deep link.',
                  icon: 'share-social-outline',
                  onPress: handleShareLink,
                },
              ]}
            />
          )}

          {leavePromptOpen && (
            <TacticalActionPrompt
              visible
              eyebrow={user?.id === session.hostId ? 'SYS.FREQ // HOST EXIT' : 'SYS.FREQ // EXIT BUS'}
              title={user?.id === session.hostId ? 'END SESSION' : 'LEAVE ROOM'}
              description={
                user?.id === session.hostId
                  ? 'This will close the room for everyone and terminate the active session.'
                  : `Exit "${session.name}" and return to the room list.`
              }
              onClose={() => setLeavePromptOpen(false)}
              actions={[
                {
                  label: user?.id === session.hostId ? 'Stay Online' : 'Stay In Room',
                  description: 'Dismiss this prompt and continue in the session.',
                  icon: 'arrow-undo-outline',
                  onPress: () => setLeavePromptOpen(false),
                },
                {
                  label: user?.id === session.hostId ? 'End Session' : 'Leave Room',
                  description: user?.id === session.hostId
                    ? 'Close the room for everyone connected right now.'
                    : 'Disconnect from this session and leave the room.',
                  icon: 'exit-outline',
                  tone: 'danger',
                  onPress: handleConfirmLeaveRoom,
                },
              ]}
            />
          )}

          {pendingPowerPrompt && (
            <TacticalActionPrompt
              visible
              eyebrow={pendingPowerPrompt.type === 'overdrive' ? 'SYS.FREQ // POWER ROUTE' : 'SYS.FREQ // SHIELD BUS'}
              title={pendingPowerPrompt.type === 'overdrive' ? 'CONFIRM OVERDRIVE' : 'CONFIRM PHASE CANCEL'}
              description={
                pendingPowerPrompt.type === 'overdrive'
                  ? 'Spend 25 CV to force the targeted track to the top of the queue.'
                  : 'Spend 15 CV to block the next skip in this room.'
              }
              onClose={() => setPendingPowerPrompt(null)}
              actions={[
                {
                  label: 'Cancel',
                  description: 'Dismiss this power route request.',
                  icon: 'close-outline',
                  onPress: () => setPendingPowerPrompt(null),
                },
                {
                  label: pendingPowerPrompt.type === 'overdrive' ? 'Spend 25 CV' : 'Spend 15 CV',
                  description: pendingPowerPrompt.type === 'overdrive'
                    ? 'Execute Overdrive on the targeted track.'
                    : 'Activate Phase Cancel for the room.',
                  icon: pendingPowerPrompt.type === 'overdrive' ? 'flash-outline' : 'shield-outline',
                  tone: 'danger',
                  onPress: handleConfirmPowerPrompt,
                },
              ]}
            />
          )}

          {/* ─── QR Code Modal ─────────────────────────────── */}
          {showQR && (
            <Modal
              visible
              transparent
              animationType="fade"
              statusBarTranslucent
              onRequestClose={() => setShowQR(false)}
              accessible={true}
              accessibilityViewIsModal={true}
            >
              <View style={styles.qrOverlay} accessible={true}>
                <TouchableOpacity
                  style={styles.qrBackdrop}
                  onPress={() => setShowQR(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close QR code overlay"
                />
                <View style={styles.qrModal}>
                  <TacticalGridBackground opacity={0.86} />
                  <View style={styles.qrContent}>
                    <View style={styles.qrHeader}>
                      <View style={styles.qrHeaderText}>
                        <RNText style={styles.qrSysText}>SYS.FREQ // JOIN LINK</RNText>
                        <RNText style={styles.qrTitleText} numberOfLines={1}>
                          {(session?.name || 'ROOM QR').toUpperCase()}
                        </RNText>
                        <RNText style={styles.qrSubText}>SCAN TO JOIN THIS SESSION</RNText>
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowQR(false)}
                        style={styles.qrCloseButton}
                        accessibilityRole="button"
                        accessibilityLabel="Close QR code modal"
                      >
                        <Ionicons name="close" size={18} color={tacticalTokens.colors.white} />
                      </TouchableOpacity>
                    </View>
                  {session?.joinCode && (
                      <QRCodeDisplay joinCode={session.joinCode} size={190} />
                  )}
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* ─── Layers 3-4: Game / Economy / Environment ── */}
          <GameLayerOverlays
            duelState={duelState}
            onDuelVote={handleDuelVote}
            onDuelEnd={dismissDuelOverlay}
            forecastState={forecastState}
            onForecastPick={handleForecastPick}
            onForecastDismiss={dismissForecastOverlay}
            resonanceState={resonanceState}
            onResonanceComplete={() => setResonanceState((prev) => ({ ...prev, active: false }))}
            transientUser={transientUser}
            onTransientComplete={() => setTransientUser({ active: false, username: '' })}
            reverbTails={reverbTails}
            onReverbDecayed={(userId) => setReverbTails((prev) => prev.filter((t) => t.userId !== userId))}
            bounceVisible={bounceVisible}
            sessionName={session.name}
            roomMode={session.roomMode}
            behaviors={sessionBehaviors}
            hostUsername={listeners.find((l) => l.userId === session.hostId)?.username || 'Host'}
            durationSeconds={Math.round((Date.now() - sessionStartTime) / 1000)}
            tracksPlayed={[...playedHistory, ...(currentTrack ? [currentTrack] : [])]}
            participantCount={listeners.length}
            cvEarned={cv.balance}
            endedAt={new Date().toISOString()}
            onBounceDismiss={() => { setBounceVisible(false); navigation.goBack(); }}
          />

        </View>
      </VoidSurface>

      {/* ─── Lyrics Overlay ──────────────────────────── */}
      {lyricsVisible && (
        <LyricsOverlay
          track={currentTrack || undefined}
          visible
          onClose={() => setLyricsVisible(false)}
        />
      )}
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
    borderBottomWidth: 1, borderBottomColor: palette.chromeBorder,
  },

  // ─── Player Content ───────────────────────────────────
  tacticalPlayerContent: {
    paddingBottom: spacing.xl,
  },
  tacticalPlayerContentIdle: {
    paddingBottom: spacing.lg,
  },


  // ─── QR Modal ─────────────────────────────────────────
  qrOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  qrModal: {
    width: 320,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    overflow: 'hidden',
  },
  qrContent: {
    alignItems: 'stretch',
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.lg,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.md,
  },
  qrHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  qrSysText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.8,
  },
  qrTitleText: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
  },
  qrSubText: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
  },
  qrCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
});

export default SessionRoomScreen;
