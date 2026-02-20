/**
 * Session Room Screen — THE CORE EXPERIENCE
 *
 * Layout: Compact header → Inline search → Queue (main scroll) → Mini player (bottom)
 *
 * Research pillars active here:
 * - Social Choice Architecture (room mode governs queue behavior)
 * - Room Mode Physics (visual mode indicator)
 * - Contribution Visibility (who added what, when)
 * - Social Voltage Economy (votes, boosts, reactions)
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Alert, Share, Keyboard, Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text, SafeScreen } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { sessionApi } from '../services/api';
import {
  connectSocket, joinSession, leaveSession, addToQueue,
  voteTrack, sendReaction, skipTrack, trackEnded,
  approveTrackEvent, rejectTrackEvent, changeModeEvent, onSessionEvent,
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
import type { Session, QueueTrack, Track, RoomMode, Listener } from '../types';
import { QueueTrackCard } from '../components/QueueTrackCard';
import { SearchResultItem } from '../components/SearchResultItem';
import { MiniPlayer, MINI_PLAYER_HEIGHT } from '../components/MiniPlayer';
import { SuggestionCard } from '../components/SuggestionCard';
import { PlayedHistory } from '../components/PlayedHistory';
import { OfflineBanner } from '../components/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { FadeIn } from '../components/ui';
import { Skeleton, TrackCardSkeleton } from '../components/ui/Skeleton';
import { QRCodeDisplay } from '../components/QRCodeDisplay';

// ─── Room Mode Label ───────────────────────────────────────

const modeLabel: Record<string, string> = {
  campfire: 'Campfire',
  spotlight: 'Spotlight',
  openFloor: 'Open Floor',
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

  // Guards against double-removal (skip + auto-advance race)
  const isAdvancingRef = useRef(false);
  const skipCooldownRef = useRef(false);
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
      setPlayedHistory((hist) =>
        [finished, ...hist].slice(0, MAX_PLAYED_HISTORY)
      );
      const next = prev.slice(1);
      // Reset guard after a short delay to allow new track to load
      setTimeout(() => { isAdvancingRef.current = false; }, 300);
      return next;
    });
  }, []);

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
          // Backend sends full room state on join — use it to hydrate queue + participants
          onSessionEvent('room-state' as any, (state: any) => {
            if (!mounted) return;
            if (state.queue) setQueue(state.queue);
            if (state.participants) setListeners(state.participants);
            if (state.currentTrack && state.queue?.length === 0) {
              // If there's a current track but queue is empty, put it at front
              setQueue([state.currentTrack]);
            }
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
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, [session?.roomMode, session?.hostId, user?.id, advanceQueue]);

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
      onSessionEvent('participant-joined', () => {})(); // noop, just to ensure type
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

  // ─── Playback engine ──────────────────────────────────

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
    tapMedium();
    // Optimistic update: apply vote locally for instant UI feedback
    const mode = session?.roomMode || 'campfire';
    setQueue((prev) => applyVote(prev, trackId, user.id, direction, mode));
    // Then emit to server — queue-updated from backend will reconcile
    voteTrack(sessionId, trackId, user.id, direction);
  }, [user, sessionId, session?.roomMode]);

  const handleReaction = useCallback((trackId: string, type: 'fire' | 'vibe') => {
    if (!user) return;
    tapLight();
    sendReaction(sessionId, trackId, user.id, type);
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
    // Cooldown: prevent rapid double-taps
    if (skipCooldownRef.current) return;
    // Engine checks if this user is allowed to skip in this mode
    const { skipped } = skipCurrentTrack(queue, user.id, session.hostId, session.roomMode);
    if (!skipped) {
      Alert.alert('Host only', 'Only the host can skip tracks in Spotlight mode.');
      return;
    }
    // Activate cooldown
    skipCooldownRef.current = true;
    setTimeout(() => { skipCooldownRef.current = false; }, 1000);
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

  // ─── Reorder (long-press) ──────────────────────────────
  const [reorderTrackId, setReorderTrackId] = useState<string | null>(null);

  const handleLongPress = useCallback((trackId: string) => {
    tapMedium();
    setReorderTrackId((prev) => (prev === trackId ? null : trackId));
  }, []);

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
    buttons.push({ text: 'Cancel', onPress: () => {} });
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
            message: `Join my Frequen-C room "${session.name}"!\nCode: ${session.joinCode}`,
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
      <View style={{ flex: 1 }}>

        {/* ─── Offline Banner ─────────────────────── */}
        <OfflineBanner visible={!isConnected} />

        {/* ─── Compact Header ───────────────────────── */}
        <View style={styles.header}>
          {/* Left: back + room name */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text.muted} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <TouchableOpacity onPress={isHost ? handleChangeMode : undefined} activeOpacity={isHost ? 0.6 : 1}>
                <Text variant="labelSmall" color={isHost ? colors.action.primary : colors.text.muted}>
                  {modeName}{isHost ? ' ▾' : ''}
                </Text>
              </TouchableOpacity>
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
                <Text variant="labelSmall" color={colors.text.muted}>CODE</Text>
                <Text variant="label" color={colors.action.primary} style={styles.codeValue}>
                  {session.joinCode}
                </Text>
                <Ionicons name="copy-outline" size={12} color={colors.text.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Right: chat + share */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={() => setChatOpen(true)} style={styles.shareBtn}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
              <Text variant="label" color={colors.action.primary}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Inline Search Bar ────────────────────── */}
        <View style={styles.searchBarRow}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search to add a track..."
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

        {/* ─── Queue (Main Content) ─────────────────── */}
        {!showSearchPanel && (
          <FlatList
            data={queue}
            keyExtractor={(item, i) => item.id + '_' + i}
            renderItem={({ item, index }) => (
              <FadeIn delay={Math.min(index * 60, 300)} duration={250}>
                <TouchableOpacity
                  onLongPress={() => handleLongPress(item.id)}
                  activeOpacity={0.95}
                  delayLongPress={400}
                >
                  <QueueTrackCard
                    track={item}
                    isNowPlaying={index === 0}
                    onVote={handleVote}
                    userId={user?.id}
                    isFavorite={isFavorite(item.sourceId || item.id)}
                    onToggleFavorite={handleToggleFavorite}
                    showReorder={reorderTrackId === item.id}
                    onMoveUp={index > 1 ? handleMoveUp : undefined}
                    onMoveDown={index > 0 && index < queue.length - 1 ? handleMoveDown : undefined}
                  />
                </TouchableOpacity>
              </FadeIn>
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

                {/* Room mode indicator */}
                <View style={styles.modeIndicator}>
                  <Text variant="labelSmall" color={colors.text.muted}>
                    {session.roomMode === 'campfire' ? 'Round-robin queue' :
                      session.roomMode === 'spotlight' ? (isHost ? 'You curate the queue' : 'Host curates the queue') :
                      'Votes reorder the queue'}
                  </Text>
                </View>

                <View style={styles.queueHeader}>
                  <Text variant="h3" color={colors.text.primary}>Queue</Text>
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
                <Ionicons name="musical-notes-outline" size={36} color={colors.text.muted} style={{ marginBottom: spacing.sm }} />
                <Text variant="body" color={colors.text.muted} align="center">
                  No tracks in the queue
                </Text>
                <Text variant="labelSmall" color={colors.action.primary} align="center" style={{ marginTop: spacing.xs }}>
                  Tap to search and add tracks
                </Text>
              </TouchableOpacity>
            }
            ListFooterComponent={
              <PlayedHistory history={playedHistory} onRequeue={handleAddTrack} />
            }
          />
        )}

        {/* ─── Mini Player (Fixed Bottom) ───────────── */}
        {currentTrack && (
          <MiniPlayer
            track={currentTrack}
            playback={playback}
            onReact={handleReaction}
            onSkip={handleSkip}
            onPlayPause={handlePlayPause}
            onPress={() => setNowPlayingOpen(true)}
            canSkip={canSkip}
            isFavorite={isFavorite(currentTrack.sourceId || currentTrack.id)}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {/* ─── Join/Leave Toast ─────────────────────── */}
        <JoinLeaveToast messages={toasts} />

        {/* ─── Now Playing Expanded Sheet ─────────────── */}
        <NowPlayingSheet
          visible={nowPlayingOpen}
          track={currentTrack}
          playback={playback}
          onClose={() => setNowPlayingOpen(false)}
          onSkip={handleSkip}
          onReact={handleReaction}
          canSkip={canSkip}
          isFavorite={currentTrack ? isFavorite(currentTrack.sourceId || currentTrack.id) : false}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* ─── Listener Drawer ──────────────────────── */}
        <ListenerDrawer
          visible={listenerDrawerOpen}
          listeners={listeners}
          hostId={session.hostId}
          onClose={() => setListenerDrawerOpen(false)}
        />

        {/* ─── Chat Panel ──────────────────────────── */}
        <ChatPanel
          sessionId={session.id}
          userId={user?.id || ''}
          username={user?.username || ''}
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
        />

      </View>

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

  // Compact header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    paddingRight: spacing.sm,
    paddingTop: 2,
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
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.radius.full,
    backgroundColor: colors.action.primary + '12',
    borderWidth: 1,
    borderColor: colors.action.primary + '25',
  },
  codeValue: {
    letterSpacing: 2,
  },
  shareBtn: {
    paddingLeft: spacing.sm,
    paddingTop: 2,
  },

  // Search bar
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.bg.input,
    borderRadius: spacing.radius.md,
    paddingHorizontal: spacing.inputPadding,
    color: colors.text.primary,
    fontSize: 14,
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
    borderRadius: spacing.radius.lg,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.subtle,
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

  // Room mode indicator
  modeIndicator: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
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
    borderRadius: spacing.radius.xl,
    padding: spacing.xl,
    width: 300,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  qrClose: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
});

export default SessionRoomScreen;
