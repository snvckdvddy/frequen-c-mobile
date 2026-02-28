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
  ScrollView, Dimensions, Image, Animated, PanResponder,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, RoomModeBadge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import api, { sessionApi } from '../services/api';
import {
  connectSocket, joinSession, leaveSession, quitSession, addToQueue,
  voteTrack, sendReaction, skipTrack, voteSkip, trackEnded,
  approveTrackEvent, rejectTrackEvent, changeModeEvent, endSessionEvent,
  updateBehaviors, onSessionEvent, spendCV, duelVote, submitForecast, phantomPower,
  overdrive, phaseCancel, listenHeartbeat,
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
import {
  ListenerBar, ListenerDrawer, JoinLeaveToast, type ToastMessage,
} from '../components/ListenerPresence';
import { ChatPanel } from '../components/ChatPanel';
import { useSearch } from '../hooks/useSearch';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { useActiveSession } from '../contexts/ActiveSessionContext';
import { useFavoritesContext } from '../contexts/FavoritesContext';

import { spacing } from '../theme/spacing';
import { tapMedium, tapLight, tapHeavy, notifySuccess } from '../utils/haptics';
// ─── Design System: Rack × Chrome visual language ──────────
import { VoidSurface, ModuleFaceplate, LEDReadout, ChromeButton, StatusLight } from '../design/components';
import { palette } from '../design/tokens/materials';
import { fontFamily } from '../design/tokens/typography';
import { notifyParticipantJoined, notifyTrackChanged } from '../services/notifications';
import type { Session, QueueTrack, Track, RoomMode, Listener, RoomBehaviors } from '../types';
import { DEFAULT_BEHAVIORS, BEHAVIOR_PRESETS } from '../types';
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

  // Skip-vote state (voteRequired rooms)
  const [skipVoteState, setSkipVoteState] = useState<{
    votes: number;
    threshold: number;
    participants: number;
    voters: string[];
  } | null>(null);

  // Phase Cancel shield state — shows shield indicator when active
  const [phaseCancelShield, setPhaseCancelShield] = useState<{
    userId: string;
    username: string;
  } | null>(null);

  // Guards against double-removal (skip + auto-advance race)
  const isAdvancingRef = useRef(false);
  const MAX_PLAYED_HISTORY = 50;
  const { query, setQuery, results, isSearching, clearSearch } = useSearch();
  const { searches: recentSearches, addSearch: saveRecentSearch, removeSearch: removeRecentSearch } = useRecentSearches();
  const searchInputRef = useRef<TextInput>(null);

  // Swipe-to-close gesture for the queue sheet
  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only claim the gesture if user is swiping down significantly
        return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 50) {
          setQueueSheetOpen(false);
          setSearchInSheet(false);
          Keyboard.dismiss();
        }
      },
    })
  ).current;

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
          behaviors: s.behaviors || { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS[s.roomMode] },
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

        let lastCurrentTrack: QueueTrack | null = s.currentTrack ? {
          ...s.currentTrack,
          addedBy: { userId: (s.currentTrack as any).addedBy?.id || '', username: (s.currentTrack as any).addedBy?.username || '' },
          addedById: (s.currentTrack as any).addedBy?.id || '',
          addedAt: s.createdAt,
          votes: 0,
          voltageBoost: 0,
          reactions: []
        } as QueueTrack : null;
        let lastQueue: QueueTrack[] = initialQueue;

        socketUnsubsRef.current = [
          onSessionEvent('queue:updated', (newQueue) => {
            if (!mounted) return;
            lastQueue = newQueue;
            setQueue(lastCurrentTrack ? [lastCurrentTrack, ...newQueue] : newQueue);
          }),
          onSessionEvent('session:current_track_updated', (currentTrack) => {
            if (!mounted) return;
            lastCurrentTrack = currentTrack;
            setQueue(currentTrack ? [currentTrack, ...lastQueue] : lastQueue);
          }),
          onSessionEvent('session:playback_state_updated', (data) => {
            if (!mounted) return;
            setPlayback(prev => ({ ...prev, isPlaying: data.isPlaying }));
          }),
          onSessionEvent('session-updated', (update) => {
            if (mounted) setSession((prev) => prev ? { ...prev, ...update } : null);
          }),
          onSessionEvent('room-state', (state) => {
            if (!mounted) return;
            // ─── Authoritative state from server on join ───
            // Sync behaviors, roomMode & hostId (server is source of truth)
            if (state.roomMode || state.hostId || state.behaviors) {
              setSession((prev) => prev ? {
                ...prev,
                ...(state.roomMode ? { roomMode: state.roomMode as RoomMode } : {}),
                ...(state.behaviors ? { behaviors: state.behaviors } : {}),
                ...(state.hostId ? { hostId: state.hostId } : {}),
              } : prev);
            }
            if (state.queue) setQueue(state.queue);
            if (state.suggestedQueue) setSuggestedQueue(state.suggestedQueue);
            if (state.participants) setListeners(state.participants);
            if (state.currentTrack && (!state.queue || state.queue.length === 0)) {
              // Server's currentTrack includes addedById/addedAt — safe to cast
              setQueue([{
                ...state.currentTrack,
                addedById: (state.currentTrack as any).addedById || state.hostId || '',
                addedAt: (state.currentTrack as any).addedAt || new Date().toISOString(),
              } as QueueTrack]);
            }
            // Sync playback position for late joiners
            if (state.playback && state.playback.state !== 'stopped') {
              const serverPos = state.playback.position || 0;
              const serverTimestamp = state.playback.timestamp || Date.now();
              const drift = (Date.now() - serverTimestamp) / 1000;
              const correctedPos = state.playback.state === 'playing'
                ? serverPos + drift
                : serverPos;
              // playbackEngine will handle seeking to correct position
              setPlayback((prev) => ({
                ...prev,
                isPlaying: state.playback.state === 'playing',
                elapsed: Math.max(0, correctedPos),
              }));
            }
          }),
          onSessionEvent('track-pending', (data) => {
            if (!mounted || !data?.track) return;
            setSuggestedQueue((prev) => {
              if (prev.some((t) => t.id === data.track.id)) return prev;
              return [...prev, { ...data.track, status: 'pending' as const }];
            });
          }),
          // ─── Track changed (server advanced the queue) ───
          onSessionEvent('track-changed', (track) => {
            if (!mounted) return;
            setSkipVoteState(null); // Reset skip votes on track change
            setPhaseCancelShield(null); // Reset phase cancel shield on track change
            // Server says a new track is now playing — update local state
            if (track) {
              setQueue((prev) => {
                // If the track is already at position 0, no-op
                if (prev[0]?.id === track.id) return prev;
                // Server advanced: remove the old head, put this track at front
                const filtered = prev.filter((t) => t.id !== track.id);
                return [track as QueueTrack, ...filtered.slice(filtered[0] ? 1 : 0)];
              });
            }
          }),
          // ─── Playback sync (multi-client) ───
          onSessionEvent('playback:stateChange', (data) => {
            if (!mounted) return;
            const isPlaying = data.state === 'playing';
            setPlayback((prev) => ({
              ...prev,
              isPlaying,
              elapsed: data.position || prev.elapsed,
            }));
            // Sync local audio engine with server state
            if (isPlaying !== playback.isPlaying) {
              togglePlayPause();
            }
          }),
          onSessionEvent('playback:seeked', (data) => {
            if (!mounted) return;
            setPlayback((prev) => ({
              ...prev,
              elapsed: data.position || 0,
            }));
          }),
          // participant-joined / participant-left handled by dedicated useEffect below
          onSessionEvent('reaction-received', (data) => {
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

  // ─── Mock socket listeners (behavior-aware via queueEngine) ──
  useEffect(() => {
    const behaviors: RoomBehaviors = session?.behaviors || DEFAULT_BEHAVIORS;
    const hostId = session?.hostId || '';

    const unsubs = [
      onSessionEvent('track-added', (track: QueueTrack) => {
        setQueue((prevQ) => {
          const result = addTrackToQueue(prevQ, suggestedQueue, track, behaviors, hostId);
          if (result.destination === 'suggested') {
            setSuggestedQueue(result.suggestedQueue);
            return prevQ;
          }
          return result.queue;
        });
      }),
      onSessionEvent('vote-cast', (data) => {
        setQueue((prev) => applyVote(prev, data.trackId, data.userId, (data.direction || 1) as 1 | -1, behaviors));
      }),
      onSessionEvent('track-skipped', (data) => {
        // Reset skip vote UI when track changes
        setSkipVoteState(null);
        if (data?.userId !== user?.id) {
          advanceQueue();
        }
      }),
      onSessionEvent('skip-vote-update', (data) => {
        setSkipVoteState({
          votes: data.votes,
          threshold: data.threshold,
          participants: data.participants,
          voters: data.voters || [],
        });
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
        setSession((prev) => prev ? {
          ...prev,
          roomMode: data.roomMode as RoomMode,
          ...(data.behaviors ? { behaviors: data.behaviors } : {}),
        } : prev);
        // If approval was turned off, clear suggested queue
        if (data.behaviors && !data.behaviors.requiresApproval) {
          setSuggestedQueue([]);
        }
        const toast: ToastMessage = {
          id: `mode_${Date.now()}`,
          text: `Preset → ${data.roomMode}`,
          type: 'mode',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 3000);
        tapMedium();
      }),
      onSessionEvent('behaviors-updated', (data) => {
        setSession((prev) => prev ? {
          ...prev,
          behaviors: data.behaviors,
        } : prev);
        // If approval was turned off, move all pending to approved
        if (!data.behaviors.requiresApproval) {
          setSuggestedQueue((prev) => {
            if (prev.length === 0) return prev;
            const approved = prev.map((t) => ({ ...t, status: 'approved' as const }));
            setQueue((q) => [...q, ...approved]);
            return [];
          });
        }
        tapLight();
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
      // ─── Phantom Power: vote boost on a track ──
      onSessionEvent('phantom-power-activated', (data) => {
        const toast: ToastMessage = {
          id: `phantompower_${Date.now()}`,
          text: `⚡ ${data.username} used Phantom Power on "${data.trackTitle}" (+${data.voteBoost} votes)`,
          type: 'system',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 4000);
        tapLight();
      }),
      // ─── Overdrive: track boosted to front of queue ──
      onSessionEvent('overdrive-activated', (data) => {
        const toast: ToastMessage = {
          id: `overdrive_${Date.now()}`,
          text: `⚡ ${data.username} used Overdrive on "${data.trackTitle}"`,
          type: 'system',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 4000);
        tapLight();
      }),
      // ─── Phase Cancel: skip shield placed ──
      onSessionEvent('phase-cancel-active', (data) => {
        setPhaseCancelShield({ userId: data.userId, username: data.username });
        const toast: ToastMessage = {
          id: `phasecancelactive_${Date.now()}`,
          text: `🛡️ ${data.username} activated Phase Cancel`,
          type: 'system',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 4000);
        tapLight();
      }),
      // ─── Phase Cancel: shield consumed a skip ──
      onSessionEvent('phase-cancel-triggered', (data) => {
        setPhaseCancelShield(null);
        const blocker = data.voteSkip ? 'vote-skip' : data.shieldUsername;
        const toast: ToastMessage = {
          id: `phasecanceltriggered_${Date.now()}`,
          text: `🛡️ Phase Cancel blocked ${data.voteSkip ? 'a vote-skip' : 'a skip'} — shielded by ${data.shieldUsername}`,
          type: 'system',
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 5000);
        notifySuccess();
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [session?.behaviors, session?.hostId, user?.id, advanceQueue, clearActiveSession, navigation]);

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
    const behaviors = session?.behaviors || DEFAULT_BEHAVIORS;
    setQueue((prev) => applyVote(prev, trackId, user.id, direction, behaviors));
    voteTrack(sessionId, trackId, user.id, direction);
  }, [user, sessionId, session?.behaviors]);

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
    const behaviors = session.behaviors || DEFAULT_BEHAVIORS;
    const { skipped, reason } = skipCurrentTrack(queue, user.id, session.hostId, behaviors);
    if (!skipped) {
      if (reason === 'voteRequired') {
        // In vote-skip mode, toggle user's skip vote instead of direct skip
        tapMedium();
        voteSkip(sessionId);
        return;
      }
      Alert.alert('Skip restricted', 'You don\'t have permission to skip in this room.');
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

  // ─── Room Preset Switching (host only) ───────────────────
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
        const newBehaviors = { ...DEFAULT_BEHAVIORS, ...BEHAVIOR_PRESETS[mode] };
        setSession((prev) => prev ? { ...prev, roomMode: mode, behaviors: newBehaviors } : prev);
        changeModeEvent(sessionId, mode);
      },
    }));
    buttons.push({ text: 'Cancel', onPress: () => { } });
    Alert.alert('Switch Preset', 'This changes queue behavior for everyone.', buttons);
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
        <VoidSurface style={{ flex: 1 }}>
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
        </VoidSurface>
      </SafeScreen>
    );
  }

  // ─── Derived values ────────────────────────────────────
  const currentTrack: QueueTrack | null = queue[0] || null;
  const nextTrack: QueueTrack | null = queue[1] || null;
  const isHost = user?.id === session.hostId;
  const sessionBehaviors = session.behaviors || DEFAULT_BEHAVIORS;
  const isApprovalMode = sessionBehaviors.requiresApproval;
  const canSkip = sessionBehaviors.skipAccess === 'anyone'
    || (sessionBehaviors.skipAccess === 'hostOnly' && isHost)
    || sessionBehaviors.skipAccess === 'voteRequired'; // Everyone can vote-skip
  const isVoteSkipMode = sessionBehaviors.skipAccess === 'voteRequired';
  const hasVotedToSkip = skipVoteState?.voters?.includes(user?.id ?? '') ?? false;

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
      <VoidSurface style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* ─── Connection Status ──────────────────────── */}
          <OfflineBanner visible={!isConnected} />
          <ConnectionBanner />

          {/* ═══ HEADER — Gemini V7 Layout ═══════════════════ */}
          <View style={styles.header}>
            {/* ← Back (chevron down) */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-down" size={24} color={palette.silver} />
            </TouchableOpacity>

            {/* Center: Mode Badge + Room Name stacked */}
            <View style={styles.headerCenter}>
              <TouchableOpacity
                onPress={isHost ? handleChangeMode : undefined}
                activeOpacity={isHost ? 0.6 : 1}
                style={styles.modeBadgeBtn}
              >
                <Text style={styles.modeBadgeText}>
                  {(session.roomMode || 'campfire').toUpperCase().replace(/([a-z])([A-Z])/g, '$1 $2')}
                </Text>
              </TouchableOpacity>
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
              >
                {session.name}
              </Text>
            </View>

            {/* Right: Settings icon + status dot */}
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={() => setOverflowOpen(true)}
                style={styles.overflowBtn}
              >
                <Ionicons name="options-outline" size={22} color={palette.silver} />
              </TouchableOpacity>
              <StatusLight variant="pulse" color="green" size="sm" />
            </View>
          </View>

          {/* SIGNAL FLOW info row */}
          <View style={styles.signalFlowRow}>
            <View style={styles.signalFlowLeft}>
              <Ionicons name="git-network-outline" size={14} color={palette.slate} />
              <Text style={styles.signalFlowLabel}>SIGNAL FLOW</Text>
            </View>
            <View style={styles.codecBadge}>
              <Text style={styles.codecText}>STEREO | 320KBPS</Text>
            </View>
          </View>

          {/* ═══ SCROLLABLE PLAYER CONTENT ═════════════════ */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.playerContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ─── Album Art — Gemini V7: vinyl + grid + orange glow ── */}
            <View style={styles.albumArtContainer}>
              <View style={styles.albumArtFrame}>
                {/* Orange glow behind frame */}
                <View style={styles.albumArtGlow} />
                {/* Dark surface with grid lines */}
                <View style={styles.albumArtSurface}>
                  {/* Grid overlay lines */}
                  <View style={styles.gridH} />
                  <View style={styles.gridV} />
                  {/* Vinyl record concentric circles */}
                  <View style={styles.vinylOuter}>
                    <View style={styles.vinylMiddle}>
                      <View style={styles.vinylInner}>
                        <View style={styles.vinylDot} />
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* ─── Track Info (§3.4) — LED-style readout ── */}
            <View style={styles.trackInfo}>
              <Text
                variant="h3"
                color={palette.frost}
                numberOfLines={1}
                align="center"
                style={styles.trackTitle}
              >
                {currentTrack?.title || 'Add a track to start'}
              </Text>
              <Text
                variant="body"
                color={palette.silver}
                numberOfLines={1}
                align="center"
              >
                {currentTrack
                  ? `${currentTrack.artist}${currentTrack.addedBy ? ` · Added by @${currentTrack.addedBy.username}` : ''}`
                  : 'Search to add tracks to the queue'}
              </Text>
            </View>

            {/* ─── Progress Bar (§3.5) — Hardware groove ── */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(playback.progress || 0) * 100}%`,
                      backgroundColor: accent,
                      shadowColor: accent,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.6,
                      shadowRadius: 4,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <LEDReadout
                  value={formatTime(playback.elapsed || 0)}
                  variant="ice"
                  size="sm"
                />
                <LEDReadout
                  value={formatTime(playback.duration || 0)}
                  variant="ice"
                  size="sm"
                />
              </View>
            </View>

            {/* ─── Transport Controls — Gemini V7: mic | ORANGE play | skip ─ */}
            <View style={styles.transport}>
              {/* Mic button (room voice/chat) */}
              <TouchableOpacity
                style={styles.transportCircle}
                onPress={() => setChatOpen(true)}
              >
                <Ionicons name="mic-outline" size={22} color={palette.silver} />
              </TouchableOpacity>

              {/* Play / Pause — BIG ORANGE button */}
              <TouchableOpacity
                onPress={handlePlayPause}
                disabled={!currentTrack}
                style={styles.playPauseBtn}
                activeOpacity={0.8}
              >
                {playback.isLoading ? (
                  <ActivityIndicator color={palette.void} size="small" />
                ) : (
                  <Ionicons
                    name={playback.isPlaying ? 'pause' : 'play'}
                    size={30}
                    color={palette.void}
                    style={!playback.isPlaying ? { marginLeft: 3 } : undefined}
                  />
                )}
              </TouchableOpacity>

              {/* Skip forward / Vote-skip */}
              <TouchableOpacity
                style={[
                  styles.transportCircle,
                  isVoteSkipMode && hasVotedToSkip && { borderColor: palette.orange, borderWidth: 1.5 },
                ]}
                onPress={handleSkip}
                disabled={!canSkip || !currentTrack}
              >
                <Ionicons
                  name={isVoteSkipMode ? 'hand-right' : 'play-forward'}
                  size={22}
                  color={
                    isVoteSkipMode && hasVotedToSkip
                      ? palette.orange
                      : canSkip && currentTrack
                        ? palette.silver
                        : palette.slate
                  }
                />
                {isVoteSkipMode && skipVoteState && (
                  <View style={styles.skipVoteBadge}>
                    <Text variant="labelSmall" color={palette.frost} style={styles.skipVoteText}>
                      {skipVoteState.votes}/{skipVoteState.threshold}
                    </Text>
                  </View>
                )}
                {phaseCancelShield && (
                  <View style={styles.phaseCancelBadge}>
                    <Text variant="labelSmall" color={palette.frost} style={styles.phaseCancelBadgeText}>
                      🛡️
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* ─── Reaction Bar (§3.7) ──────────────────── */}
            {currentTrack && (
              <ReactionBar
                onReact={(type) => handleReaction(currentTrack.id, type)}
                disabled={!currentTrack}
              />
            )}

          </ScrollView>

          {/* ═══ BOTTOM SHEET — SIGNAL CHAIN / TERMINAL LOG tabs ═══ */}
          <TouchableOpacity
            style={styles.bottomSheetTab}
            onPress={() => setQueueSheetOpen(true)}
            activeOpacity={0.9}
          >
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetTabs}>
              <TouchableOpacity
                style={[styles.tabBtn, !chatOpen && styles.tabBtnActive]}
                onPress={() => { setChatOpen(false); setQueueSheetOpen(true); }}
              >
                <Text style={[styles.tabText, !chatOpen && styles.tabTextActive]}>SIGNAL CHAIN</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, chatOpen && styles.tabBtnActive]}
                onPress={() => { setChatOpen(true); setQueueSheetOpen(false); }}
              >
                <Text style={[styles.tabText, chatOpen && styles.tabTextActive]}>TERMINAL LOG</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* ─── Join/Leave Toast ─────────────────────────── */}
          <JoinLeaveToast messages={toasts} />

          {/* ═══ QUEUE BOTTOM SHEET (§3.9) ═════════════════ */}
          <Modal
            visible={queueSheetOpen}
            animationType="slide"
            transparent
            onRequestClose={() => { setQueueSheetOpen(false); setSearchInSheet(false); }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.sheetBackdrop}
            >
              <TouchableOpacity
                style={styles.sheetBackdropTouch}
                onPress={() => { setQueueSheetOpen(false); setSearchInSheet(false); }}
                activeOpacity={1}
              />
              <VoidSurface style={styles.sheetContainer} grain={false}>
                {/* Drag handle and Header wrapper with PanResponder */}
                <View {...sheetPanResponder.panHandlers}>
                  <View style={styles.sheetHandle} />

                  {/* Sheet header */}
                  <View style={styles.sheetHeader}>
                    <LEDReadout value="QUEUE" variant="amber" size="md" />

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
                        <Ionicons name="close" size={24} color={palette.slate} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Search (inside sheet) */}
                {searchInSheet && (
                  <View style={styles.sheetSearchRow}>
                    <TextInput
                      ref={searchInputRef}
                      style={styles.sheetSearchInput}
                      placeholder="Search for tracks..."
                      placeholderTextColor={palette.slate}
                      value={query}
                      onChangeText={setQuery}
                      autoFocus
                      returnKeyType="search"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={handleCancelSearch}>
                      <Text variant="label" color={palette.slate}>Cancel</Text>
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
                    <Text variant="labelSmall" color={palette.slate} style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Recent Searches
                    </Text>
                    {recentSearches.slice(0, 6).map((s) => (
                      <TouchableOpacity
                        key={s.query + s.timestamp}
                        style={styles.recentItem}
                        onPress={() => setQuery(s.query)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="time-outline" size={14} color={palette.slate} style={{ marginRight: 8 }} />
                        <Text variant="body" color={palette.silver} style={{ flex: 1 }} numberOfLines={1}>
                          {s.query}
                        </Text>
                        <TouchableOpacity
                          onPress={() => removeRecentSearch(s.query)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="close" size={14} color={palette.slate} />
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
                            behaviors={sessionBehaviors}
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
                        {/* Approval mode: Suggestions panel (host only) */}
                        {isApprovalMode && isHost && suggestedQueue.length > 0 && (
                          <View style={styles.suggestionsPanel}>
                            <Text variant="label" color={palette.silver} style={{ marginBottom: spacing.sm }}>
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
                        <Ionicons name="musical-notes" size={32} color={palette.slate} />
                        <Text variant="body" color={palette.slate} style={{ marginTop: spacing.sm }}>
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
              </VoidSurface>
            </KeyboardAvoidingView>
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
              <VoidSurface style={[styles.sheetContainer, { maxHeight: '50%' }]} grain={false}>
                <View style={styles.sheetHandle} />
                <View style={{ padding: spacing.md, gap: 4 }}>
                  {/* Share */}
                  <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); handleShare(); }}>
                    <Ionicons name="share-outline" size={20} color={palette.frost} />
                    <Text variant="body" color={palette.frost}>Share Room</Text>
                  </TouchableOpacity>
                  {/* Copy Code */}
                  <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); handleCopyCode(); }}>
                    <Ionicons name="copy-outline" size={20} color={palette.frost} />
                    <Text variant="body" color={palette.frost}>Copy Room Code</Text>
                    {session.joinCode && (
                      <LEDReadout value={session.joinCode} variant="amber" size="sm" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                  {/* Chat */}
                  <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); setChatOpen(true); }}>
                    <Ionicons name="chatbubble-outline" size={20} color={palette.frost} />
                    <Text variant="body" color={palette.frost}>Chat</Text>
                  </TouchableOpacity>
                  {/* Lyrics */}
                  {currentTrack && (
                    <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); setLyricsVisible(true); }}>
                      <Ionicons name="musical-notes-outline" size={20} color={palette.frost} />
                      <Text variant="body" color={palette.frost}>Lyrics</Text>
                    </TouchableOpacity>
                  )}
                  {/* QR Code */}
                  <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); setShowQR(true); }}>
                    <Ionicons name="qr-code-outline" size={20} color={palette.frost} />
                    <Text variant="body" color={palette.frost}>Show QR Code</Text>
                  </TouchableOpacity>
                  {/* Divider — chrome line */}
                  <View style={styles.overflowDivider} />
                  {/* Leave / End */}
                  <TouchableOpacity style={styles.overflowRow} onPress={() => { setOverflowOpen(false); handleLeaveRoom(); }}>
                    <Ionicons
                      name={isHost ? 'close-circle-outline' : 'exit-outline'}
                      size={20}
                      color={palette.red}
                    />
                    <Text variant="body" color={palette.red}>
                      {isHost ? 'End Session' : 'Leave Room'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </VoidSurface>
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
                <Text variant="h3" color={palette.frost} align="center">
                  {session?.name}
                </Text>
                {session?.joinCode && (
                  <QRCodeDisplay joinCode={session.joinCode} />
                )}
                <TouchableOpacity onPress={() => setShowQR(false)} style={styles.qrClose}>
                  <Text variant="label" color={palette.slate}>Close</Text>
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
      </VoidSurface>

      {/* ─── Master Bounce Receipt (session end) ──────── */}
      {bounceVisible && (
        <MasterBounce
          sessionName={session.name}
          roomMode={session.roomMode}
          behaviors={sessionBehaviors}
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
    borderBottomWidth: 1, borderBottomColor: palette.chromeBorder,
  },

  // ─── Header — Gemini V7 layout ─────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  modeBadgeBtn: {
    borderWidth: 1,
    borderColor: palette.orange,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  modeBadgeText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.orange,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'ChakraPetch-Bold',
    color: palette.frost,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overflowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Signal Flow info row ──────────────────────────
  signalFlowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  signalFlowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signalFlowLabel: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 10,
    color: palette.slate,
    letterSpacing: 1.5,
  },
  codecBadge: {
    borderWidth: 1,
    borderColor: palette.orange,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  codecText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 9,
    color: palette.orange,
    letterSpacing: 1,
  },

  // ─── Player Content ───────────────────────────────────
  playerContent: {
    alignItems: 'center',
    paddingBottom: spacing['2xl'],
  },

  // ─── Album Art — Gemini V7: vinyl + grid + orange glow ──
  albumArtContainer: {
    width: ALBUM_ART_SIZE,
    height: ALBUM_ART_SIZE,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  albumArtFrame: {
    width: ALBUM_ART_SIZE - 24,
    height: ALBUM_ART_SIZE - 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  albumArtGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: 'transparent',
    // Orange glow emanating from edges
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 12,
  },
  albumArtSurface: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Grid overlay
  gridH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    top: '50%',
  },
  gridV: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    left: '50%',
  },
  // Vinyl concentric circles
  vinylOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: palette.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylMiddle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 107, 53, 0.50)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.orange,
    // Glow on center dot
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },

  // ─── Track Info (§3.4) — Display typography ─────────
  trackInfo: {
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: 8,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'ChakraPetch-Bold',
    letterSpacing: 0.3,
  },

  // ─── Progress Bar (§3.5) — Recessed hardware groove ──
  progressContainer: {
    width: '100%',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.md,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(192, 223, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    // Inset groove effect
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.4)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(192, 223, 255, 0.05)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },

  // ─── Transport — Gemini V7: mic | ORANGE play | skip ──
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    paddingVertical: spacing.xl,
  },
  transportCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipVoteBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: palette.midnight,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: palette.orange,
    minWidth: 22,
    alignItems: 'center',
  },
  skipVoteText: {
    fontSize: 8,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  phaseCancelBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: palette.steel,
    borderRadius: 8,
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: palette.green,
    minWidth: 18,
    alignItems: 'center',
  },
  phaseCancelBadgeText: {
    fontSize: 9,
  },
  playPauseBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: palette.orange,
    alignItems: 'center',
    justifyContent: 'center',
    // Orange glow
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },

  // ─── Bottom Sheet Tab Bar — SIGNAL CHAIN / TERMINAL LOG ─
  bottomSheetTab: {
    backgroundColor: palette.steel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.10)',
  },
  bottomSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    alignSelf: 'center',
    marginBottom: 10,
  },
  bottomSheetTabs: {
    flexDirection: 'row',
    gap: 24,
  },
  tabBtn: {
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: palette.ice,
  },
  tabText: {
    fontFamily: 'SpaceMono-Regular',
    fontSize: 12,
    color: palette.slate,
    letterSpacing: 1,
  },
  tabTextActive: {
    color: palette.frost,
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
    height: Dimensions.get('window').height * 0.92,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 223, 255, 0.12)',
  },
  sheetHandle: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(192, 223, 255, 0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
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
    backgroundColor: 'rgba(192, 223, 255, 0.04)',
    borderRadius: 4,
    paddingHorizontal: 12,
    color: '#F0F4F8',
    fontSize: 13,
    fontFamily: 'SpaceMono-Regular',
    borderWidth: 1,
    borderColor: 'rgba(192, 223, 255, 0.1)',
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
    borderBottomColor: palette.chromeBorder,
  },

  // ─── Suggestions (Spotlight) ──────────────────────────
  suggestionsPanel: {
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: 10,
    backgroundColor: palette.midnight,
    borderWidth: 1,
    borderColor: palette.chromeBorder,
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
    backgroundColor: 'rgba(192, 223, 255, 0.06)',
    marginVertical: 4,
  },

  // ─── QR Modal ─────────────────────────────────────────
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModal: {
    backgroundColor: '#0E1219',
    borderRadius: 4,
    padding: spacing.xl,
    width: 300,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192, 223, 255, 0.15)',
  },
  qrClose: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
});

export default SessionRoomScreen;
