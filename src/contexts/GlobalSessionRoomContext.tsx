import React, { createContext, useContext, useState } from 'react';
import { useSessionRoom } from '../hooks/useSessionRoom';
import { useAuth } from './AuthContext';
import { PlaybackWebView } from '../components/PlaybackWebView';

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
