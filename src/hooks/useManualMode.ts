import { useCallback, useEffect, useState } from 'react';

let manualFlag = false;
const listeners = new Set<(next: boolean) => void>();

function broadcast(next: boolean) {
  manualFlag = next;
  listeners.forEach((listener) => listener(next));
}

export function useManualMode() {
  const [readManual, setReadManualState] = useState(manualFlag);

  useEffect(() => {
    const listener = (next: boolean) => setReadManualState(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setReadManual = useCallback((next: boolean) => {
    broadcast(next);
  }, []);

  return { readManual, setReadManual, manualReady: true };
}

export default useManualMode;
