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
  addToQueue, voteTrack, sendReaction, skipTrack, voteSkip,
  approveTrackEvent, rejectTrackEvent, changeModeEvent, endSessionEvent,
  updateBehaviors, joinSession, leaveSession,
} from '../services/socket';
import {
  addTrackToQueue, applyVote, skipCurrentTrack, moveTrack as moveTrackEngine,
  approveTrack as approveTrackEngine, rejectTrack as rejectTrackEngine,
} from '../services/queueEngine';
import {
  loadTrack, stop as stopPlayback, togglePlayPause,
} from '../services/playbackEngine';
import { USE_MOCKS } from '../services/config';
import { JoinLeaveToast, ListenerDrawer, type ToastMessage } from '../components/ListenerPresence';
import { ChatPanel } from '../components/ChatPanel';
import { useSearch } from '../hooks/useSearch';
import { useRecentSearches } from '../hooks/useRecentSearches';
import { resolvePlayableTrack } from '../hooks/useIsrcCrossMatch';
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
import { GameLayerOverlays } from '../components/room';
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
import { logger } from '../utils/logger';
import { TrackContextMenu } from '../components/ui';
import { QUEUE_ACTIONS, type ContextMenuAction } from '../components/ui/TrackContextMenu';
import { Skeleton, TrackCardSkeleton } from '../components/ui/Skeleton';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { useCV } from '../hooks/useCV';
import { useGameLayer } from '../hooks/useGameLayer';
import { usePresenceListeners } from '../hooks/usePresenceListeners';
import { useHostPlaybackEngine } from '../hooks/useHostPlaybackEngine';
import { useVoltageSag } from '../hooks/useVoltageSag';
import { useGlobalSessionRoom } from '../contexts/GlobalSessionRoomContext';
import PowerRoutingSheet, { type PowerMove, type PowerMoveId } from '../features/power-routing/PowerRoutingSheet';
import { buildTacticalReadout } from '../features/session-v2/adapters/buildTacticalReadout';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import TacticalRoomHeader from '../features/session-v2/components/TacticalRoomHeader';
import TacticalPresenceStrip from '../features/session-v2/components/TacticalPresenceStrip';
import TacticalAlbumHero from '../features/session-v2/components/TacticalAlbumHero';
import TacticalTrackMeta from '../features/session-v2/components/TacticalTrackMeta';
import TacticalSpectrum from '../features/session-v2/components/TacticalSpectrum';
import TacticalTransportDeck from '../features/session-v2/components/TacticalTransportDeck';
import TacticalReactionMatrix from '../features/session-v2/components/TacticalReactionMatrix';
import TacticalSystemPreferencesPanel from '../features/session-v2/components/TacticalSystemPreferencesPanel';
import SessionRoomPrompts from '../features/session-v2/components/SessionRoomPrompts';
import SignalChainSheetV2 from '../features/session-v2/components/SignalChainSheetV2';
import SearchHudOverlay from '../features/search-hud/SearchHudOverlay';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

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
  const [listenerDrawerOpen, setListenerDrawerOpen] = useState(false);
  const [sharePromptOpen, setSharePromptOpen] = useState(false);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);

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
  const isHost = user?.id === session?.hostId;
  const gameLayer = useGameLayer({
    sessionId,
    userId: user?.id,
    user: user ? { id: user.id, username: user.username } : null,
    session,
    queue,
    setQueue,
    cv,
    isHost: !!isHost,
  });

  // Phase 6: Lyrics
  const [lyricsVisible, setLyricsVisible] = useState(false);

  const [sessionStartTime] = useState(Date.now());


  const { query, setQuery, sources, setSources, results, fallbackUsed, providerStates, diagnostics, isSearching, clearSearch } = useSearch();
  const { searches: recentSearches, addSearch: saveRecentSearch, removeSearch: removeRecentSearch } = useRecentSearches();

  // ─── Presence: heartbeat, join/leave events, mock joiner ──
  usePresenceListeners({ sessionId, userId: user?.id, session, setListeners, setToasts });

  // ─── Playback engine ────────────────────────────────────
  // Host-output model: only the host device plays audio and signals track-end.

  useHostPlaybackEngine({
    isHost: !!isHost,
    queue,
    sessionId,
    setPlayback,
    advanceQueue,
    lastfmConnected: !!user?.connectedServices?.lastfm?.connected,
  });

  // ─── Handlers ─────────────────────────────────────────
  // Queueing is intentionally passive/free in Session V2.
  // Do not attach CV spend, tactical prompts, or power-routing costs to baseline add-to-queue.
  //
  // Phase 5: the cross-match resolve is a fire-and-forget async IIFE so this
  // function keeps its synchronous boolean contract with all callers (prop
  // types in SearchHud / SearchHudOverlay expect `(track) => void | boolean`).
  // Non-Spotify tracks pass through `resolvePlayableTrack` unchanged and hit
  // the cache immediately. Spotify tracks get resolved to a Tier 1/2 playable
  // equivalent before the socket emit. On resolve failure we fall back to the
  // original track so the queue never silently drops a user's selection.
  const handleAddTrack = useCallback((track: Track) => {
    if (!user || !session || !sessionId) return false;
    if (!getGlobalLimiter().canDo('addTrack')) return false;

    // Cheap pre-check: if the unresolved track id is already queued, bail
    // before doing the resolve round-trip. Resolved-id check happens
    // inside the async block as a second line of defense (catches the
    // case where two different source ids resolve to the same playable
    // track, e.g. Spotify -> SoundCloud cross-match collision).
    if (queue.some((q) => q.id === track.id)) {
      const dupName = queue.find((q) => q.id === track.id);
      const queuedBy = dupName?.addedBy?.username
        ? ` by @${dupName.addedBy.username}`
        : '';
      showToast(`"${track.title}" is already queued${queuedBy}.`, 'info');
      notifyWarning();
      return false;
    }

    void (async () => {
      const resolved = await resolvePlayableTrack(track);

      // Second-line dedupe after cross-match resolve. The resolved id
      // may differ from track.id (e.g. Spotify track resolved to its
      // SoundCloud equivalent), and the resolved id is what actually
      // lands in the queue. So re-check against the freshly-snapshotted
      // queue ids here. We snapshot queue at this point because the
      // outer queue state may have changed during the resolve.
      if (queue.some((q) => q.id === resolved.id)) {
        showToast(`"${resolved.title}" is already queued.`, 'info');
        notifyWarning();
        return;
      }

      const queueTrack: QueueTrack = {
        ...resolved,
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
    })();
    return true;
  }, [user, session, sessionId, query, saveRecentSearch, queue]);

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
      logger.warn('session', 'AI suggestion search failed', err instanceof Error ? err.message : String(err));
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
      logger.warn('session', `Invalid reaction type received: ${type}`);
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
      logger.warn('session', 'Playback retry failed', err);
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
    gameLayer.powerMoves.setPendingPrompt(null);
    setContextMenuVisible(false);
    setLyricsVisible(false);
  }, [gameLayer.powerMoves.setPendingPrompt]);

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
        gameLayer.powerMoves.handleMove('overdrive');
        break;
      case 'phantomPower':
        gameLayer.powerMoves.handleMove('phantom_power');
        break;
      case 'phaseCancel':
        gameLayer.powerMoves.handleMove('phase_cancel');
        break;
      default:
        break;
    }
  }, [handleToggleFavorite, gameLayer.powerMoves]);

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
  }, [session]);

  // ─── Leave / End Session ───────────────────────────────
  const handleLeaveRoom = useCallback(() => {
    if (!user || !session) return;
    setLeavePromptOpen(true);
  }, [user, session]);

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

  // ─── Search within queue sheet ─────────────────────────
  const handleCancelSearch = useCallback(() => {
    clearSearch();
    setSearchInSheet(false);
    Keyboard.dismiss();
  }, [clearSearch]);

  // ─── Derived values ────────────────────────────────────
  const currentTrack: QueueTrack | null = queue[0] || null;
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
            <TacticalSpectrum
              trackId={currentTrack?.id}
              elapsed={playback.elapsed}
              duration={playback.duration || currentTrack?.duration || 0}
              progress={playback.progress}
              isPlaying={playback.isPlaying}
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
              duelActionEnabled={gameLayer.duel.canStart}
              duelActionDescription={gameLayer.duel.actionDescription}
              onStartDuel={gameLayer.duel.handleStart}
              canStartForecast={gameLayer.forecast.canStart}
              forecastActionDescription={gameLayer.forecast.actionDescription}
              onStartForecast={gameLayer.forecast.handleStart}
              onUpdateBehaviors={handleUpdateBehaviors}
            />
          )}

          {powerRoutingOpen && (
            <PowerRoutingSheet
              visible
              voltage={cv.balance}
              moves={gameLayer.powerMoves.moves}
              onClose={() => setPowerRoutingOpen(false)}
              onExecute={(moveId) => {
                setPowerRoutingOpen(false);
                gameLayer.powerMoves.handleMove(moveId);
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

          <SessionRoomPrompts
            sharePromptOpen={sharePromptOpen}
            onCloseShare={() => setSharePromptOpen(false)}
            onShowQR={() => setShowQR(true)}
            onShareLink={handleShareLink}
            leavePromptOpen={leavePromptOpen}
            isHost={!!isHost}
            sessionName={session.name}
            onCloseLeave={() => setLeavePromptOpen(false)}
            onConfirmLeave={handleConfirmLeaveRoom}
            pendingPowerPrompt={gameLayer.powerMoves.pendingPrompt}
            onClosePower={() => gameLayer.powerMoves.setPendingPrompt(null)}
            onConfirmPower={gameLayer.powerMoves.handleConfirm}
          />

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
            duelState={gameLayer.duel.state}
            onDuelVote={gameLayer.duel.handleVote}
            onDuelEnd={gameLayer.duel.dismiss}
            forecastState={gameLayer.forecast.state}
            onForecastPick={gameLayer.forecast.handlePick}
            onForecastDismiss={gameLayer.forecast.dismiss}
            resonanceState={gameLayer.overlays.resonanceState}
            onResonanceComplete={() => gameLayer.overlays.setResonanceState((prev) => ({ ...prev, active: false }))}
            transientUser={gameLayer.overlays.transientUser}
            onTransientComplete={() => gameLayer.overlays.setTransientUser({ active: false, username: '' })}
            reverbTails={gameLayer.overlays.reverbTails}
            onReverbDecayed={(userId) => gameLayer.overlays.setReverbTails((prev) => prev.filter((t) => t.userId !== userId))}
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
