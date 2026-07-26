/**
 * Socket.io Client — with Mock Mode
 *
 * When USE_MOCKS is true in api.ts, socket operations run locally
 * via an EventEmitter-style callback system. No server needed.
 *
 * When USE_MOCKS is false, real socket.io connects to the backend.
 */

import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './api';
import type { QueueTrack, Participant, Session, Reaction, ChatMessage, Track, RoomBehaviors } from '../types';
import { USE_MOCKS, SOCKET_URL } from './config';
import { logger } from '../utils/logger';

// ─── Mock Event Bus ─────────────────────────────────────────
// Simple pub/sub for local mock events.

type MockHandler = (...args: unknown[]) => void;
const mockListeners: Map<string, Set<MockHandler>> = new Map();

function mockEmit(event: string, ...args: unknown[]) {
  const handlers = mockListeners.get(event);
  if (handlers) {
    handlers.forEach((fn) => fn(...args));
  }
}

function mockOn(event: string, handler: MockHandler) {
  if (!mockListeners.has(event)) mockListeners.set(event, new Set());
  mockListeners.get(event)!.add(handler);
}

function mockOff(event: string, handler: MockHandler) {
  mockListeners.get(event)?.delete(handler);
}

// ─── Socket Health State ─────────────────────────────────────
// Reactive state so UI can respond to connection changes.

export type SocketStatus = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

interface SocketHealthState {
  status: SocketStatus;
  lastError: string | null;
  reconnectAttempt: number;
}

let healthState: SocketHealthState = {
  status: 'disconnected',
  lastError: null,
  reconnectAttempt: 0,
};

type HealthListener = (state: SocketHealthState) => void;
const healthListeners = new Set<HealthListener>();

function setHealth(patch: Partial<SocketHealthState>) {
  healthState = { ...healthState, ...patch };
  healthListeners.forEach((fn) => fn(healthState));
}

/** Subscribe to socket health changes. Returns unsubscribe function. */
export function onHealthChange(listener: HealthListener): () => void {
  healthListeners.add(listener);
  // Immediately fire with current state
  listener(healthState);
  return () => { healthListeners.delete(listener); };
}

/** Get current health snapshot (non-reactive). */
export function getSocketHealth(): SocketHealthState {
  return { ...healthState };
}

// ─── Singleton Socket (real mode only) ──────────────────────

let socket: Socket | null = null;

// ─── Session Event Registry ─────────────────────────────────
// Handlers live in this module-level registry, not just on the socket
// instance. connectSocket()/reconnectSocket() tear the instance down
// (removeAllListeners) and create a fresh one; without the registry,
// every subscriber went permanently deaf after a manual reconnect —
// the RETRY button and foreground recovery delivered a socket nobody
// was listening to (2026-07-25 resilience audit, R2). Every new socket
// instance re-binds the full registry.
type AnySocketHandler = (...args: unknown[]) => void;
const sessionEventRegistry = new Map<string, Set<AnySocketHandler>>();

function bindRegistryToSocket(sock: Socket): void {
  for (const [event, handlers] of sessionEventRegistry) {
    for (const handler of handlers) {
      sock.on(event, handler);
    }
  }
}

// The server drops room membership the moment a socket disconnects (no
// grace period) and socket.io's auto-reconnect restores the TRANSPORT
// but not the room. Remember the active join and re-emit it on every
// (re)connect — otherwise a two-second wifi blip leaves the app looking
// connected while the room is frozen forever and everyone else sees the
// user as having left (2026-07-25 resilience audit, R1).
let activeJoin: { sessionId: string; userId: string; username: string } | null = null;

export async function connectSocket(): Promise<Socket | null> {
  if (USE_MOCKS) {
    logger.info('socket', 'Mock mode — no server connection.');
    setHealth({ status: 'connected', lastError: null, reconnectAttempt: 0 });
    return null;
  }

  // If socket exists and is connected, reuse it
  if (socket?.connected) return socket;

  // If socket exists but is disconnected/broken, tear it down first
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  setHealth({ status: 'connecting', lastError: null, reconnectAttempt: 0 });

  const token = await getStoredToken();

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,  // Exponential backoff caps at 30s
    randomizationFactor: 0.3,     // Jitter to prevent thundering herd
    timeout: 15000,
  });

  bindRegistryToSocket(socket);

  socket.on('connect', () => {
    logger.info('socket', 'Connected', socket?.id);
    setHealth({ status: 'connected', lastError: null, reconnectAttempt: 0 });
    // Rejoin the active room. Covers auto-reconnect (same instance) and
    // manual reconnect (fresh instance) alike; a no-op on first connect
    // because joinSession hasn't run yet. The server re-activates the
    // membership and replies with a fresh room-state, which also
    // drift-corrects playback for guests.
    if (activeJoin) {
      logger.info('socket', `Rejoining session ${activeJoin.sessionId} after reconnect`);
      guardedEmit('join-session', {
        sessionId: activeJoin.sessionId,
        userId: activeJoin.userId,
        username: activeJoin.username,
      });
    }
  });

  socket.on('disconnect', (reason) => {
    logger.info('socket', 'Disconnected', reason);
    const isIntentional = reason === 'io client disconnect';
    setHealth({
      status: isIntentional ? 'disconnected' : 'reconnecting',
      lastError: isIntentional ? null : `Disconnected: ${reason}`,
    });
  });

  socket.on('connect_error', (err) => {
    logger.warn('socket', 'Connection unavailable', err.message);
    setHealth({ status: 'reconnecting', lastError: err.message });
  });

  socket.io.on('reconnect_attempt', (attempt: number) => {
    logger.debug('socket', `Reconnect attempt ${attempt}/15`);
    setHealth({ status: 'reconnecting', reconnectAttempt: attempt });
  });

  socket.io.on('reconnect', () => {
    logger.info('socket', 'Reconnected successfully');
    setHealth({ status: 'connected', lastError: null, reconnectAttempt: 0 });
  });

  socket.io.on('reconnect_failed', () => {
    logger.error('socket', 'All reconnect attempts exhausted');
    setHealth({ status: 'disconnected', lastError: 'Connection lost. Please check your network.' });
  });

  // Wait for the initial connection (or first error) before returning.
  // This ensures callers like useSessionRoom can rely on socket.connected
  // being true before issuing joinSession. Timeout prevents hanging forever.
  const sock = socket;
  await new Promise<void>((resolve) => {
    if (sock.connected) { resolve(); return; }
    const onConnect = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); resolve(); };
    const timer = setTimeout(() => { cleanup(); resolve(); }, 10000);
    function cleanup() {
      sock.off('connect', onConnect);
      sock.off('connect_error', onError);
      clearTimeout(timer);
    }
    sock.once('connect', onConnect);
    sock.once('connect_error', onError);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

/** Force a manual reconnect — use after returning from background or network recovery. */
export async function reconnectSocket(): Promise<Socket | null> {
  if (USE_MOCKS) return null;
  // Tear down the old socket entirely and start fresh
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  return connectSocket();
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  setHealth({ status: 'disconnected', lastError: null, reconnectAttempt: 0 });
}

// ─── Guarded Emit ───────────────────────────────────────────
// All real-mode emits go through this helper. When socket is null (never
// created), the event is dropped with a warning. When socket exists but
// isn't connected yet (handshake in flight, reconnecting), we still call
// socket.emit() — socket.io's built-in buffering queues the event and
// delivers it once the connection completes. This is critical: joinSession
// is called immediately after connectSocket() returns, before the handshake
// finishes, so dropping events here would prevent room membership.

function guardedEmit(event: string, payload: Record<string, unknown>): void {
  if (!socket) {
    logger.warn('socket', `'${event}' dropped — socket is null (not initialized)`);
    return;
  }
  if (!socket.connected) {
    logger.warn('socket', `'${event}' buffered — socket is ${healthState.status}, will send on connect`);
  }
  socket.emit(event, payload);
}

// ─── Session Events ─────────────────────────────────────────

export function joinSession(sessionId: string, userId: string, username: string): void {
  if (USE_MOCKS) {
    logger.debug('socket', `Mock: ${username} joined session ${sessionId}`);
    return;
  }
  activeJoin = { sessionId, userId, username };
  guardedEmit('join-session', { sessionId, userId, username });
}

export function leaveSession(sessionId: string, userId: string): void {
  if (USE_MOCKS) return;
  if (activeJoin?.sessionId === sessionId) activeJoin = null;
  guardedEmit('leave-session', { sessionId });
}

/** Permanently leave a session (removes membership). Use for "Leave Room" button. */
export function quitSession(sessionId: string, userId: string): void {
  if (USE_MOCKS) return;
  if (activeJoin?.sessionId === sessionId) activeJoin = null;
  guardedEmit('quit-session', { sessionId, userId });
}

/**
 * Forget the active room without emitting anything — used when the
 * SERVER ends the session, so reconnects stop trying to rejoin a dead
 * room (the rejoin would only bounce off "Session has ended").
 */
export function clearActiveJoin(): void {
  activeJoin = null;
}

// ─── Queue Events ───────────────────────────────────────────

export function addToQueue(sessionId: string, track: QueueTrack): void {
  if (USE_MOCKS) {
    // Fire the local callback so the UI updates immediately
    mockEmit('track-added', track);
    return;
  }
  guardedEmit('add-to-queue', { sessionId, track });
}

export function voteTrack(
  sessionId: string,
  trackId: string,
  userId: string,
  direction: 1 | -1
): void {
  if (USE_MOCKS) {
    mockEmit('vote-cast', { trackId, userId, direction });
    return;
  }
  guardedEmit('vote-track', { sessionId, trackId, direction });
}

export function skipTrack(sessionId: string, userId?: string): void {
  if (USE_MOCKS) {
    mockEmit('track-skipped', { userId });
    return;
  }
  guardedEmit('skip-track', { sessionId });
}

export function removeTrack(sessionId: string, trackId: string): void {
  if (USE_MOCKS) {
    mockEmit('track-removed', { trackId });
    return;
  }
  guardedEmit('remove-track', { sessionId, trackId });
}

/** Notify backend that the current track finished playing (auto-advance). */
export function trackEnded(sessionId: string): void {
  if (USE_MOCKS) return;
  guardedEmit('track-ended', { sessionId });
}

/** Broadcast host playback state so non-host users see live progress. */
export function emitPlaybackState(sessionId: string, state: 'playing' | 'paused' | 'stopped', position: number): void {
  if (USE_MOCKS) return;
  guardedEmit('playback:state', { sessionId, state, position });
}

// ─── Spotlight Mode Events (approve / reject suggestions) ───

export function approveTrackEvent(sessionId: string, trackId: string, track: QueueTrack): void {
  if (USE_MOCKS) {
    mockEmit('track-approved', { trackId, track });
    return;
  }
  guardedEmit('approve-track', { sessionId, trackId, track });
}

export function rejectTrackEvent(sessionId: string, trackId: string): void {
  if (USE_MOCKS) {
    mockEmit('track-rejected', { trackId });
    return;
  }
  guardedEmit('reject-track', { sessionId, trackId });
}

// ─── End Session (host ends room for everyone) ──────────

export function endSessionEvent(sessionId: string): void {
  if (USE_MOCKS) {
    mockEmit('session-ended', { sessionId });
    return;
  }
  guardedEmit('end-session', { sessionId });
}

// ─── Mode / Behavior Events ─────────────────────────────────

/** Apply a preset template (legacy — maps preset to toggles on server). */
export function changeModeEvent(sessionId: string, newMode: string): void {
  if (USE_MOCKS) {
    mockEmit('mode-changed', { sessionId, roomMode: newMode });
    return;
  }
  guardedEmit('change-mode', { sessionId, roomMode: newMode });
}

/** Update individual behavioral toggles live (host-only). */
export function updateBehaviors(sessionId: string, behaviors: Partial<RoomBehaviors>): void {
  if (USE_MOCKS) {
    mockEmit('behaviors-updated', { sessionId, behaviors });
    return;
  }
  guardedEmit('update-behaviors', { sessionId, behaviors });
}

// ─── Skip-Vote Events ────────────────────────────────────────

/** Toggle a skip vote for the current track (voteRequired rooms only). */
export function voteSkip(sessionId: string): void {
  if (USE_MOCKS) {
    mockEmit('skip-vote-update', { sessionId, votes: 1, threshold: 2, participants: 3, voters: ['mock'] });
    return;
  }
  guardedEmit('vote-skip', { sessionId });
}

// ─── Reaction Events ────────────────────────────────────────

export function sendReaction(
  sessionId: string,
  trackId: string,
  userId: string,
  type: 'fire' | 'vibe' | 'skip'
): void {
  if (USE_MOCKS) {
    mockEmit('reaction-local', { trackId, userId, type });
    return;
  }
  guardedEmit('reaction', { sessionId, trackId, userId, type });
}

// ─── Chat Events ────────────────────────────────────────────

export function sendChatMessage(
  sessionId: string,
  userId: string,
  username: string,
  text: string
): void {
  const msg: ChatMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    sessionId,
    userId,
    username,
    text,
    type: 'message',
    timestamp: new Date().toISOString(),
  };

  if (USE_MOCKS) {
    // Immediate local echo
    mockEmit('chat-message', msg);
    return;
  }
  guardedEmit('chat-message', { sessionId, userId, username, text });
}

// ─── Listener Types ─────────────────────────────────────────

/** Full room state sent by server when joining a session */
export interface RoomState {
  sessionId: string;
  /** Legacy field — kept for backward compat display. */
  roomMode: string;
  /** Granular behavioral toggles — source of truth for all queue/feature logic. */
  behaviors: RoomBehaviors;
  hostId: string;
  hostUsername: string;
  participants: Participant[];
  currentTrack: Track | null;
  queue: QueueTrack[];
  suggestedQueue: QueueTrack[];
  chat: ChatMessage[];
  playback: { state: 'playing' | 'paused' | 'stopped'; position: number; timestamp: number; trackId?: string };
}

export interface SessionSocketEvents {
  'queue-updated': (queue: QueueTrack[]) => void;
  // 'session:current_track_updated' removed — backend emits 'track-changed' (already typed below)
  'session:playback_state_updated': (data: { isPlaying: boolean }) => void;
  'participant-joined': (participant: Participant) => void;
  'participant-left': (data: { userId: string }) => void;
  'participant-updated': (participant: Participant) => void;
  'track-changed': (track: QueueTrack | null) => void;
  'session-updated': (session: Partial<Session>) => void;
  'reaction-received': (data: { trackId: string; userId: string; type: string }) => void;
  'error': (data: { message: string }) => void;
  // Room state (sent on join)
  'room-state': (state: RoomState) => void;
  // Playback sync
  'playback:stateChange': (data: { state: string; position: number; timestamp: number; trackId?: string }) => void;
  'playback:seeked': (data: { position: number; timestamp: number }) => void;
  // Mock-only events (for local state management)
  'track-added': (track: QueueTrack) => void;
  'vote-cast': (data: { trackId: string; userId: string; direction: number; totalVotes: number }) => void;
  'track-skipped': (data: Record<string, never>) => void;
  'track-removed': (data: { trackId: string }) => void;
  // Spotlight mode events
  'track-pending': (data: { track: QueueTrack }) => void;
  'track-approved': (data: { trackId: string; track: QueueTrack }) => void;
  'track-rejected': (data: { trackId: string }) => void;
  // Session ended (host ended the room)
  'session-ended': (data: { sessionId: string }) => void;
  // Mode change events (legacy — preset was applied)
  'mode-changed': (data: { sessionId: string; roomMode: string; behaviors: RoomBehaviors }) => void;
  // Behavioral toggles updated (host changed individual toggles live)
  'behaviors-updated': (data: { sessionId: string; behaviors: RoomBehaviors }) => void;
  // Skip-vote tally update (voteRequired rooms)
  'skip-vote-update': (data: { sessionId: string; votes: number; threshold: number; participants: number; voters: string[] }) => void;
  // Pending queue — full replacement of suggested queue
  'pending-updated': (queue: QueueTrack[]) => void;
  // Chat events
  'chat-message': (message: ChatMessage) => void;
  // CV Economy events
  'cv:earn': (data: { userId: string; amount: number; reason: string }) => void;
  'cv:spend': (data: { userId: string; amount: number; moveType: string }) => void;
  'cv:balance': (data: { userId: string; balance: number }) => void;
  // Resonance events
  'resonance': (data: { type: 'harmonic' | 'octave' | 'feedback'; message: string; cvBonus: number }) => void;
  // Crossfader duel events
  'duel:start': (data: { trackA: QueueTrack; trackB: QueueTrack; duration: number }) => void;
  'duel:vote': (data: { userId: string; side: 'a' | 'b' }) => void;
  'duel:end': (data: { winner: 'a' | 'b'; trackA: QueueTrack; trackB: QueueTrack; votes: { a: number; b: number } }) => void;
  // Forecast events
  'forecast:start': (data: { candidates: QueueTrack[]; reward: number; duration: number }) => void;
  'forecast:result': (data: { winnerId: string; predictions: Record<string, string> }) => void;
  // Presence events (Transient/Reverb Tail)
  'transient:enter': (data: { userId: string; username: string; avatarUrl?: string }) => void;
  'reverb-tail:ghost': (data: { userId: string; username: string; duration: number }) => void;
  // Phantom Power events
  'phantom-power-activated': (data: {
    sessionId: string; trackId: string; trackTitle: string;
    userId: string; username: string; cvSpent: number; voteBoost: number;
  }) => void;
  // Overdrive events
  'overdrive-activated': (data: {
    sessionId: string; trackId: string; trackTitle: string;
    userId: string; username: string; cvSpent: number;
  }) => void;
  // Phase Cancel events
  'phase-cancel-active': (data: {
    sessionId: string; userId: string; username: string; cvSpent: number;
  }) => void;
  'phase-cancel-triggered': (data: {
    sessionId: string; shieldUserId: string; shieldUsername: string;
    blockedUserId: string; voteSkip?: boolean; forced?: boolean;
  }) => void;
}

export function onSessionEvent<K extends keyof SessionSocketEvents>(
  event: K,
  handler: SessionSocketEvents[K]
): () => void {
  if (USE_MOCKS) {
    mockOn(event, handler as MockHandler);
    return () => mockOff(event, handler as MockHandler);
  }
  const anyHandler = handler as AnySocketHandler;
  let handlers = sessionEventRegistry.get(event as string);
  if (!handlers) {
    handlers = new Set();
    sessionEventRegistry.set(event as string, handlers);
  }
  handlers.add(anyHandler);
  socket?.on(event as string, anyHandler);
  return () => {
    sessionEventRegistry.get(event as string)?.delete(anyHandler);
    socket?.off(event as string, anyHandler);
  };
}

// ─── CV Economy Events ─────────────────────────────────────

/** Spend CV on a power move (overdrive, phase_cancel, phantom_power) */
export function spendCV(
  sessionId: string, userId: string, moveType: string, cost: number,
): void {
  if (USE_MOCKS) {
    mockEmit('cv:spend', { userId, amount: cost, moveType });
    return;
  }
  guardedEmit('cv:spend', { sessionId, userId, moveType });
}

/** Trigger a Phantom Power boost (+48V) on a track */
export function phantomPower(sessionId: string, trackId: string, userId: string): void {
  if (USE_MOCKS) {
    mockEmit('cv:spend', { userId, amount: 5, moveType: 'phantom_power' });
    // Simulate the boost being applied
    mockEmit('queue-updated', []); // In real mode, server would send updated queue
    return;
  }
  guardedEmit('phantom-power', { sessionId, trackId, userId });
}

/** Overdrive — force a track to the top of the queue (25 CV) */
export function overdrive(sessionId: string, trackId: string, userId: string): void {
  if (USE_MOCKS) {
    mockEmit('cv:spend', { userId, amount: 25, moveType: 'overdrive' });
    mockEmit('queue-updated', []);
    return;
  }
  guardedEmit('overdrive', { sessionId, trackId, userId });
}

/** Phase Cancel — block the next skip in the session (15 CV) */
export function phaseCancel(sessionId: string, userId: string): void {
  if (USE_MOCKS) {
    mockEmit('cv:spend', { userId, amount: 15, moveType: 'phase_cancel' });
    return;
  }
  guardedEmit('phase-cancel', { sessionId, userId });
}

/** Start a Crossfader Duel between two tracks */
export function startDuel(
  sessionId: string, trackAId: string, trackBId: string, duration: number,
): void {
  if (USE_MOCKS) {
    // Duel start would be server-initiated in production
    return;
  }
  guardedEmit('duel:start', { sessionId, trackAId, trackBId, duration });
}

/** Vote in a Crossfader Duel */
export function duelVote(sessionId: string, userId: string, side: 'a' | 'b'): void {
  if (USE_MOCKS) {
    mockEmit('duel:vote', { userId, side });
    return;
  }
  guardedEmit('duel:vote', { sessionId, userId, side });
}

/** Submit a Frequency Forecast prediction */
export function submitForecast(sessionId: string, userId: string, trackId: string): void {
  if (USE_MOCKS) {
    return;
  }
  guardedEmit('forecast:predict', { sessionId, userId, trackId });
}

/** Start a Frequency Forecast round (host only) */
export function startForecast(sessionId: string): void {
  if (USE_MOCKS) {
    return;
  }
  guardedEmit('forecast:start', { sessionId });
}

/** Send listen heartbeat (called every 60s while in an active session) */
export function listenHeartbeat(sessionId: string): void {
  if (USE_MOCKS) return;
  guardedEmit('listen:heartbeat', { sessionId });
}

export default {
  connect: connectSocket,
  disconnect: disconnectSocket,
  reconnect: reconnectSocket,
  getSocket,
  getSocketHealth,
  onHealthChange,
  joinSession,
  leaveSession,
  quitSession,
  addToQueue,
  voteTrack,
  skipTrack,
  removeTrack,
  voteSkip,
  approveTrackEvent,
  rejectTrackEvent,
  endSessionEvent,
  updateBehaviors,
  changeModeEvent,
  sendReaction,
  sendChatMessage,
  onSessionEvent,
  // Power moves
  phantomPower,
  overdrive,
  phaseCancel,
  startDuel,
  startForecast,
  submitForecast,
  listenHeartbeat,
};
