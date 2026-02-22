/**
 * useSocketHealth — React hook for socket connection state.
 *
 * Exposes { status, lastError, reconnectAttempt } so any
 * component can render connection-aware UI (banners, spinners, etc.).
 */

import { useState, useEffect } from 'react';
import { onHealthChange, getSocketHealth, type SocketStatus } from '../services/socket';

export interface SocketHealth {
  status: SocketStatus;
  lastError: string | null;
  reconnectAttempt: number;
  isConnected: boolean;
}

export function useSocketHealth(): SocketHealth {
  const [health, setHealth] = useState(() => {
    const h = getSocketHealth();
    return { ...h, isConnected: h.status === 'connected' };
  });

  useEffect(() => {
    const unsub = onHealthChange((state) => {
      setHealth({ ...state, isConnected: state.status === 'connected' });
    });
    return unsub;
  }, []);

  return health;
}

export default useSocketHealth;
