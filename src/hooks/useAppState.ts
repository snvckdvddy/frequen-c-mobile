/**
 * useAppState — Handles background/foreground transitions.
 *
 * When app returns to foreground:
 * 1. Reconnects socket if it was lost.
 * 2. Optionally re-joins the active session to get fresh state.
 *
 * This prevents the "stale socket" problem where the user
 * backgrounds the app, socket dies, and they come back to
 * a frozen room with no events flowing.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { reconnectSocket, getSocketHealth } from '../services/socket';
import { logger } from '../utils/logger';

interface UseAppStateOptions {
  /** Called when app returns to foreground. Use to re-join session, refetch state, etc. */
  onForeground?: () => void;
  /** Called when app goes to background. Use to pause timers, save state, etc. */
  onBackground?: () => void;
}

export function useAppState(options: UseAppStateOptions = {}) {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const { onForeground, onBackground } = options;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const prevState = appStateRef.current;

      // Foreground return: inactive/background → active
      if (prevState.match(/inactive|background/) && nextState === 'active') {
        logger.info('appState', 'Returned to foreground');

        // Reconnect socket if it's not currently connected
        const health = getSocketHealth();
        if (health.status !== 'connected') {
          logger.info('appState', 'Socket not connected, reconnecting...');
          await reconnectSocket();
        }

        onForeground?.();
      }

      // Backgrounding: active → background
      if (prevState === 'active' && nextState.match(/inactive|background/)) {
        logger.debug('appState', 'Going to background');
        onBackground?.();
      }

      appStateRef.current = nextState;
    });

    return () => subscription.remove();
  }, [onForeground, onBackground]);
}

export default useAppState;
