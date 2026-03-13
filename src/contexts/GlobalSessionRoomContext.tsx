import React, { createContext, useContext, useState } from 'react';
import { useSessionRoom } from '../hooks/useSessionRoom';

export type GlobalSessionRoomValue = ReturnType<typeof useSessionRoom> & {
  connectionId: string | null;
  setConnectionId: (id: string | null) => void;
};

const GlobalSessionRoomContext = createContext<GlobalSessionRoomValue | null>(null);

export function GlobalSessionRoomProvider({ children }: { children: React.ReactNode }) {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const roomState = useSessionRoom(connectionId || '');

  return (
    <GlobalSessionRoomContext.Provider value={{ ...roomState, connectionId, setConnectionId }}>
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
