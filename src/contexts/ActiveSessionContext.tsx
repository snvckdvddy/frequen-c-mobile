/**
 * ActiveSessionContext
 *
 * Tracks whether the user is currently inside a live session room.
 * Read by AddToRoomSheet to decide which UI to show:
 *   - In a session → "Add to [Room Name]?" + Confirm
 *   - Not in a session → "You're not in a room" + Browse Rooms
 *
 * Set on SessionRoomScreen mount, cleared on leave/unmount.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface ActiveSession {
  sessionId: string;
  sessionName: string;
  roomMode: string;
  hostId: string;
}

interface ActiveSessionContextValue {
  activeSession: ActiveSession | null;
  setActiveSession: (session: ActiveSession | null) => void;
  clearActiveSession: () => void;
}

const ActiveSessionContext = createContext<ActiveSessionContextValue>({
  activeSession: null,
  setActiveSession: () => {},
  clearActiveSession: () => {},
});

export function ActiveSessionProvider({ children }: { children: React.ReactNode }) {
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);

  const setActiveSession = useCallback((session: ActiveSession | null) => {
    setActiveSessionState(session);
  }, []);

  const clearActiveSession = useCallback(() => {
    setActiveSessionState(null);
  }, []);

  return (
    <ActiveSessionContext.Provider
      value={{ activeSession, setActiveSession, clearActiveSession }}
    >
      {children}
    </ActiveSessionContext.Provider>
  );
}

export function useActiveSession() {
  return useContext(ActiveSessionContext);
}

export default ActiveSessionContext;
