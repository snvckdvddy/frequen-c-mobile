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
import type { QueueTrack, Participant, Session, Reaction, ChatMessage, Track } from '../types';
import { USE_MOCKS, SOCKET_URL } from './config';

// ─── Mock Event Bus ─────────────────────────────────────────
// Simple pub/sub for local mock events.

type MockHandler = (...args: any[]) => void;
const mockListeners: Map<string, Set<MockHandler>> = new Map();

function mockEmit(event: string, ...args: any[]) {
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

export async function connectSocket(): Promise<Socket | null> {
  if (USE_MOCKS) {
    console.log('[Socket] Mock mode — no server connection.');
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
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,  // Exponential backoff caps at 30s
    randomizationFactor: 0.3,     // Jitter to prevent thundering herd
    timeout: 15000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
    setHealth({ status: 'connected', lastError: null, reconnectAttempt: 0 });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    const isIntentional = reason === 'io client disconnect';
    setHealth({
      status: isIntentional ? 'disconnected' : 'reconnecting',
      lastError: isIntentional ? null : `Disconnected: ${reason}`,
    });
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    setHealth({ status: 'reconnecting', lastError: err.message });
  });

  socket.io.on('reconnect_attempt', (attempt: number) => {
    console.log(`[Socket] Reconnect attempt ${attempt}/15`);
    setHealth({ status: 'reconnecting', reconnectAttempt: attempt });
  });

  socket.io.on('reconnect', () => {
    console.log('[Socket] Reconnected successfully');
    setHealth({ status: 'connected', lastError: null, reconnectAttempt: 0 });
  });

  socket.io.on('reconnect_failed', () => {
    console.error('[Socket] All reconnect attempts exhausted');
    setHealth({ status: 'disconnected', lastError: 'Connection lost. Please check your network.' });
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

// ─── Session Events ─────────────────────────────────────────

export function joinSession(sessionId: string, userId: string, username: string): void {
  if (USE_MOCKS) {
    console.log(`[Socket:Mock] ${username} joined session ${sessionId}`);
    return;
  }
  socket?.emit('join-session', { sessionId, userId, username });
}

export function leaveSession(sessionId: string, userId: string): void {
  if (USE_MOCKS) return;
  socket?.emit('leave-session', { sessionId, userId });
}

/** Permanently leave a session (removes membership). Use for "Leave Room" button. */
export function quitSession(sessionId: string, userId: string): void {
  if (USE_MOCKS) return;
  socket?.emit('quit-session', { sessionId, userId });
}

// ─── Queue Events ───────────────────────────────────────────

export function addToQueue(sessionId: string, track: QueueTrack): void {
  if (USE_MOCKS) {
    // Fire the local callback so the UI updates immediately
    mockEmit('track-added', track);
    return;
  }
  socket?.emit('add-to-queue', { sessionId, track });
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
  socket?.emit('vote-track', {
    sessionId,
    trackId,
    userId,
    direction: direction === 1 ? 'up' : 'down',
  });
}

export function skipTrack(sessionId: string, userId?: string): void {
  if (USE_MOCKS) {
    mockEmit('track-skipped', { userId });
    return;
  }
  socket?.emit('skip-track', { sessionId, userId });
}

/** Notify backend that the current track finished playing (auto-advance). */
export function trackEnded(sessionId: string): void {
  if (USE_MOCKS) return;
  socket?.emit('track-ended', { sessionId });
}

// ─── Spotlight Mode Events (approve / reject suggestions) ───

export function approveTrackEvent(sessionId: string, trackId: string, track: QueueTrack): void {
  if (USE_MOCKS) {
    mockEmit('track-approved', { trackId, track });
    return;
  }
  socket?.emit('approve-track', { sessionId, trackId, track });
}

export function rejectTrackEvent(sessionId: string, trackId: string): void {
  if (USE_MOCKS) {
    mockEmit('track-rejected', { trackId });
    return;
  }
  socket?.emit('reject-track', { sessionId, trackId });
}

// ─── End Session (host ends room for everyone) ──────────

export function endSessionEvent(sessionId: string): void {
  if (USE_MOCKS) {
    mockEmit('session-ended', { sessionId });
    return;
  }
  socket?.emit('end-session', { sessionId });
}

// ─── Mode Change Events ─────────────────────────────────────

export function changeModeEvent(sessionId: string, newMode: string): void {
  if (USE_MOCKS) {
    mockEmit('mode-changed', { sessionId, roomMode: newMode });
    return;
  }
  socket?.emit('change-mode', { sessionId, roomMode: newMode });
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
  socket?.emit('reaction', { sessionId, trackId, userId, type });
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
  socket?.emit('chat-message', { sessionId, userId, username, text });
}

// ─── Listener Types ─────────────────────────────────────────

/** Full room state sent by server when joining a session */
export interface RoomState {
  sessionId: string;
  roomMode: string;
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
  'vote-cast': (data: { trackId: string; userId: string; direction: 1 | -1 }) => void;
  'track-skipped': (data: Record<string, never>) => void;
  'reaction-local': (data: { trackId: string; userId: string; type: string }) => void;
  // Spotlight mode events
  'track-pending': (data: { track: QueueTrack }) => void;
  'track-approved': (data: { trackId: string; track: QueueTrack }) => void;
  'track-rejected': (data: { trackId: string }) => void;
  // Session ended (host ended the room)
  'session-ended': (data: { sessionId: string }) => void;
  // Mode change events
  'mode-changed': (data: { sessionId: string; roomMode: string }) => void;
  // Pending queue (Spotlight mode) — full replacement of suggested queue
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
}

export function onSessionEvent<K extends keyof SessionSocketEvents>(
  event: K,
  handler: SessionSocketEvents[K]
): () => void {
  if (USE_MOCKS) {
    mockOn(event, handler as MockHandler);
    return () => mockOff(event, handler as MockHandler);
  }
  socket?.on(event as string, handler as any);
  return () => {
    socket?.off(event as string, handler as any);
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
  socket?.emit('cv:spend', { sessionId, userId, moveType });
}

/** Trigger a Phantom Power boost (+48V) on a track */
export function phantomPower(sessionId: string, trackId: string, userId: string): void {
  if (USE_MOCKS) {
    mockEmit('cv:spend', { userId, amount: 5, moveType: 'phantom_power' });
    // Simulate the boost being applied
    mockEmit('queue-updated', []); // In real mode, server would send updated queue
    return;
  }
  socket?.emit('phantom-power', { sessionId, trackId, userId });
}

/** Overdrive — force a track to the top of the queue (25 CV) */
export function overdrive(sessionId: string, trackId: string, userId: string): void {
  if (USE_MOCKS) {
    mockEmit('cv:spend', { userId, amount: 25, moveType: 'overdrive' });
    mockEmit('queue-updated', []);
    return;
  }
  socket?.emit('overdrive', { sessionId, trackId, userId });
}

/** Phase Cancel — block the next skip in the session (15 CV) */
export function phaseCancel(sessionId: string, userId: string): void {
  if (USE_MOCKS) {
    mockEmit('cv:spend', { userId, amount: 15, moveType: 'phase_cancel' });
    return;
  }
  socket?.emit('phase-cancel', { sessionId, userId });
}

/** Start a Crossfader Duel between two tracks */
export function startDuel(
  sessionId: string, trackAId: string, trackBId: string, duration: number,
): void {
  if (USE_MOCKS) {
    // Duel start would be server-initiated in production
    return;
  }
  socket?.emit('duel:start', { sessionId, trackAId, trackBId, duration });
}

/** Vote in a Crossfader Duel */
export function duelVote(sessionId: string, userId: string, side: 'a' | 'b'): void {
  if (USE_MOCKS) {
    mockEmit('duel:vote', { userId, side });
    return;
  }
  socket?.emit('duel:vote', { sessionId, userId, side });
}

/** Submit a Frequency Forecast prediction */
export function submitForecast(sessionId: string, userId: string, trackId: string): void {
  if (USE_MOCKS) {
    return;
  }
  socket?.emit('forecast:predict', { sessionId, userId, trackId });
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
  approveTrackEvent,
  rejectTrackEvent,
  endSessionEvent,
  sendReaction,
  sendChatMessage,
  onSessionEvent,
};
