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

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity,
  Alert, Share, Keyboard, Modal, Platform,
  ScrollView, Dimensions, Image, Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen, RoomModeBadge, ErrorState } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import api, { searchApi } from '../services/api';
import {
  addToQueue, voteTrack, sendReaction, skipTrack, removeTrack, voteSkip, trackEnded,
  approveTrackEvent, rejectTrackEvent, changeModeEvent, endSessionEvent,
  updateBehaviors, spendCV, duelVote, submitForecast, phantomPower,
  overdrive, phaseCancel, listenHeartbeat, joinSession, leaveSession,
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
import { JoinLeaveToast, type ToastMessage } from '../components/ListenerPresence';
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
import { colors } from '../design/tokens/colors';
import { fontFamily, fontSize, fontWeight, letterSpacing as ls } from '../design/tokens/typography';
import { notifyParticipantJoined, notifyTrackChanged } from '../services/notifications';
import {
  OverflowMenu, GameLayerOverlays, RoomSettingsPanel,
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
import { buildTacticalReadout } from '../features/session-v2/adapters/buildTacticalReadout';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import TacticalRoomHeader from '../features/session-v2/components/TacticalRoomHeader';
import TacticalPresenceStrip from '../features/session-v2/components/TacticalPresenceStrip';
import TacticalAlbumHero from '../features/session-v2/components/TacticalAlbumHero';
import TacticalTrackMeta from '../features/session-v2/components/TacticalTrackMeta';
import TacticalWaveform from '../features/session-v2/components/TacticalWaveform';
import TacticalTransportDeck from '../features/session-v2/components/TacticalTransportDeck';
import TacticalReactionMatrix from '../features/session-v2/components/TacticalReactionMatrix';
import SignalChainSheetV2 from '../features/session-v2/components/SignalChainSheetV2';
import SearchHudOverlay from '../features/search-hud/SearchHudOverlay';

type SocketReactionType = "fire" | "vibe" | "skip";

const isValidReaction = (type: string): type is SocketReactionType => {
  return ["fire", "vibe", "skip"].includes(type);
};

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

  const {
    session, setSession,
    queue, setQueue,
    suggestedQueue, setSuggestedQueue,
    playedHistory, loading,
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
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(false);
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
  const [duelState, setDuelState] = useState<DuelState>({ active: false, trackA: null, trackB: null, votes: { a: 0, b: 0 }, timeRemaining: 0, totalTime: 0, userVote: null });

  // Frequency Forecast
  const [forecastState, setForecastState] = useState<ForecastState>({ active: false, candidates: [], reward: 0, timeRemaining: 0, userPick: null, lastResult: null });

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


  const { query, setQuery, results, isSearching, clearSearch } = useSearch();
  const { searches: recentSearches, addSearch: saveRecentSearch, removeSearch: removeRecentSearch } = useRecentSearches();




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

  // ─── Playback engine ────────────────────────────────────
  useEffect(() => {
    const unsub = onProgress((s) => setPlayback(s));
    return () => { unsub(); stopPlayback(); };
  }, [setPlayback]);

  const currentTrackRef = useRef<string | null>(null);
  useEffect(() => {
    const nowPlaying = queue[0] || null;
    if (nowPlaying && nowPlaying.id !== currentTrackRef.current) {
      currentTrackRef.current = nowPlaying.id;
      loadTrack(nowPlaying.id, nowPlaying.duration || 30, nowPlaying.previewUrl);
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
  }, [queue, user?.connectedServices?.lastfm?.connected]);

  useEffect(() => {
    const unsub = onTrackEnd(() => {
      advanceQueue();
      trackEnded(sessionId);
    });
    return unsub;
  }, [advanceQueue, sessionId]);

  // ─── Handlers ─────────────────────────────────────────
  const handleAddTrack = useCallback((track: Track) => {
    if (!user || !session) return false;
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
        Alert.alert('Track Not Found', `Couldn't find "${title}" by ${artist} on Spotify.`);
      }
    } catch (err: unknown) {
      console.warn('[AI Suggestion] Search failed:', err instanceof Error ? err.message : String(err));
      Alert.alert('Error', 'Failed to search for suggested track.');
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
    loadTrack(retryTrack.id, retryTrack.duration || 30, retryTrack.previewUrl).catch((err) => {
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

  // ─── CVPill power move dispatch ────────────────────────
  const handlePowerMove = useCallback((moveType: string) => {
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

  const closeTransientPanels = useCallback(() => {
    setQueueSheetOpen(false);
    setOverflowOpen(false);
    setRoomSettingsOpen(false);
    setSearchInSheet(false);
    setSearchHudOpen(false);
    setChatOpen(false);
    setShowQR(false);
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
              setConnectionId(null);
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
              leaveSession(sessionId, user.id);
              clearActiveSession();
              setConnectionId(null);
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

  // ─── Derived values ────────────────────────────────────
  const currentTrack: QueueTrack | null = queue[0] || null;
  const isHost = user?.id === session?.hostId;
  const sessionBehaviors = session?.behaviors || DEFAULT_BEHAVIORS;
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
  if (loading || !session) {
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

  // ═══════════════════════════════════════════════════════════
  // ─── RENDER: Player-First Layout ──────────────────────────
  // ═══════════════════════════════════════════════════════════

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <TacticalGridBackground />
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
              setOverflowOpen(true);
            }}
          />

          <TacticalPresenceStrip
            listeners={listeners}
            hostId={session.hostId}
            currentUserId={user?.id}
            currentUsername={user?.username}
            onPress={() => {}}
          />

          {/* ═══ SCROLLABLE PLAYER CONTENT ═════════════════ */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.tacticalPlayerContent}
            showsVerticalScrollIndicator={false}
          >
            <TacticalAlbumHero track={currentTrack} readout={readout} />
            <TacticalTrackMeta track={currentTrack} />
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
              isSearching={isSearching}
              recentSearches={recentSearches}
              isHost={isHost}
              keyboardVisible={keyboardVisible}
              keyboardHeight={keyboardHeight}
              onClose={() => { setQueueSheetOpen(false); setSearchInSheet(false); }}
              onOpenSearch={() => {
                setQueueSheetOpen(false);
                setSearchInSheet(false);
                setSearchHudOpen(true);
              }}
              onCloseSearch={handleCancelSearch}
              onQueryChange={setQuery}
              onSelectMode={handleSelectMode}
              onAddTrack={handleAddTrack}
              onVote={handleVote}
              onApproveTrack={handleApproveTrack}
              onRejectTrack={handleRejectTrack}
              onRemoveRecentSearch={removeRecentSearch}
              onLongPress={handleLongPress}
              onRequeueHistory={handleAddTrack}
            />
          )}

          {/* ═══ SEARCH HUD OVERLAY (Never Leave the Room) ═══ */}
          {searchHudOpen && (
            <SearchHudOverlay
              visible
              query={query}
              onQueryChange={setQuery}
              results={results}
              isSearching={isSearching}
              queuedTrackIds={queue.map((t) => t.id)}
              onClose={() => setSearchHudOpen(false)}
              onPatchTrack={(track) => {
                handleAddTrack(track);
                setSearchHudOpen(false);
              }}
            />
          )}

          {/* ═══ OVERFLOW BOTTOM SHEET ═════════════════════ */}
          {overflowOpen && (
            <OverflowMenu
              visible
              joinCode={session.joinCode}
              isHost={isHost}
              hasCurrentTrack={!!currentTrack}
              onClose={() => setOverflowOpen(false)}
              onShare={handleShare}
              onCopyCode={handleCopyCode}
              onChatOpen={() => {
                closeTransientPanels();
                setChatOpen(true);
              }}
              onLyricsOpen={() => {
                closeTransientPanels();
                setLyricsVisible(true);
              }}
              onQRShow={() => {
                closeTransientPanels();
                setShowQR(true);
              }}
              onLeaveRoom={handleLeaveRoom}
              onRoomSettings={() => {
                closeTransientPanels();
                setRoomSettingsOpen(true);
              }}
            />
          )}

          {/* ═══ ROOM SETTINGS PANEL (host only) ════════════ */}
          {isHost && roomSettingsOpen && (
            <RoomSettingsPanel
              visible
              behaviors={sessionBehaviors}
              onClose={() => setRoomSettingsOpen(false)}
              onUpdateBehaviors={handleUpdateBehaviors}
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

          {/* ─── QR Code Modal ─────────────────────────────── */}
          {showQR && (
            <Modal
              visible
              transparent
              animationType="fade"
              onRequestClose={() => setShowQR(false)}
              accessible={true}
              accessibilityViewIsModal={true}
            >
              <View style={styles.qrOverlay} accessible={true}>
                <View style={styles.qrModal}>
                  <Text variant="h3" color={palette.frost} align="center">
                    {session?.name}
                  </Text>
                  {session?.joinCode && (
                    <QRCodeDisplay joinCode={session.joinCode} />
                  )}
                  <TouchableOpacity onPress={() => setShowQR(false)} style={styles.qrClose} accessibilityRole="button" accessibilityLabel="Close QR code modal" accessibilityHint="Double tap to close this dialog">
                    <Text variant="label" color={palette.slate}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}

          {/* ─── Layers 3-4: Game / Economy / Environment ── */}
          <GameLayerOverlays
            duelState={duelState}
            onDuelVote={handleDuelVote}
            onDuelEnd={() => setDuelState((prev) => ({ ...prev, active: false }))}
            forecastState={forecastState}
            onForecastPick={handleForecastPick}
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


  // ─── QR Modal ─────────────────────────────────────────
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModal: {
    backgroundColor: palette.midnight,
    padding: spacing.xl,
    width: 300,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.iceGlow,
  },
  qrClose: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
});

export default SessionRoomScreen;
