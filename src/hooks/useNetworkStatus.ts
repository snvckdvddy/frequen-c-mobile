/**
 * useNetworkStatus — Reactive network connectivity hook.
 *
 * Returns { isConnected, isInternetReachable } from NetInfo.
 * Components can conditionally show offline banners or disable actions.
 */

import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setStatus({
        isConnected: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
      });
    });
    return () => unsubscribe();
  }, []);

  return status;
}

export default useNetworkStatus;
