import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSessionRoom } from '../hooks/useSessionRoom';
import { useAuth } from './AuthContext';
import { PlaybackWebView } from '../components/PlaybackWebView';
import { useHostPlaybackEngine } from '../hooks/useHostPlaybackEngine';
import { stop as stopPlayback } from '../services/playbackEngine';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const HOST_KEEP_AWAKE_TAG = 'frequenc-host-session';

export type GlobalSessionRoomValue = ReturnType<typeof useSessionRoom> & {
  connectionId: string | null;
  setConnectionId: (id: string | null) => void;
};

const GlobalSessionRoomContext = createContext<GlobalSessionRoomValue | null>(null);

export function GlobalSessionRoomProvider({ children }: { children: React.ReactNode }) {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const roomState = useSessionRoom(connectionId || '');
  const { user } = useAuth();

  // Mount the hidden PlaybackWebView when the current user is the session host.
  // This must live at the provider level (not SessionRoomScreen) so the WebView
  // persists across tab navigation — audio keeps playing while browsing Library, etc.
  const isHost = Boolean(user?.id && roomState.session?.hostId === user.id);

  // Host playback wiring lives HERE for the same reason: audio follows
  // the SESSION, not the screen. When this hook lived in
  // SessionRoomScreen, its unmount cleanup stopped the engine — the
  // 2026-07-25 "music stops when the host goes Home" finding.
  useHostPlaybackEngine({
    isHost,
    queue: roomState.queue,
    sessionId: connectionId || '',
    setPlayback: roomState.setPlayback,
    advanceQueue: roomState.advanceQueue,
    lastfmConnected: Boolean(user?.connectedServices?.lastfm?.connected),
  });

  // The engine now outlives every screen, so session teardown is the
  // one remaining place audio must stop: leaving or ending a room
  // clears connectionId. (session-ended also stops it via the socket
  // handler; both calls are idempotent.)
  useEffect(() => {
    if (!connectionId) stopPlayback();
  }, [connectionId]);

  // A locked screen suspends the WebView's JavaScript, which ends the
  // party at the current track (no FINISH event, no auto-advance).
  // Until a real foreground-service audio path exists, keep the HOST's
  // screen awake while their session is live. Guests are unaffected;
  // hosts at a party are usually docked or plugged in.
  useEffect(() => {
    if (!isHost || !connectionId) return;
    activateKeepAwakeAsync(HOST_KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(HOST_KEEP_AWAKE_TAG);
    };
  }, [isHost, connectionId]);

  return (
    <GlobalSessionRoomContext.Provider value={{ ...roomState, connectionId, setConnectionId }}>
      <PlaybackWebView enabled={isHost} />
      {children}
    </GlobalSessionRoomContext.Provider>
  );
}

export function useGlobalSessionRoom() {
  const context = useContext(GlobalSessionRoomContext);
  if (!context) {
    throw new Error('useGlobalSessionRoom must be used within a GlobalSessionRoomProvider');
  }
  return context;
}
