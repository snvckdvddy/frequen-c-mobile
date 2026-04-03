/**
 * useCV — Control Voltage economy hook.
 *
 * Manages CV balance state, listens for earn/spend events
 * via Socket.io, and exposes power move triggers.
 */

import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CVTransaction {
  amount: number;
  reason: string;
  timestamp: number;
}

export interface CVPowerMove {
  type: 'overdrive' | 'phase_cancel' | 'phantom_power';
  cost: number;
  cooldownMs: number;
}

export const CV_POWER_MOVES: Record<string, CVPowerMove> = {
  overdrive:     { type: 'overdrive',     cost: 25, cooldownMs: 600_000 },  // 10 min
  phase_cancel:  { type: 'phase_cancel',  cost: 15, cooldownMs: 300_000 },  // 5 min
  phantom_power: { type: 'phantom_power', cost: 5,  cooldownMs: 60_000 },   // 1 min
};

export const CV_EARN_RATES = {
  listen_minute: 1,
  track_played: 5,
  vote_reaction: 3,
  session_complete: 10,
  resonance_bonus: 5,
  forecast_correct: 2,
} as const;

const CV_STORAGE_KEY = '@frequenc/cv_balance';

export function useCV(initialBalance: number = 50) {
  const [balance, setBalance] = useState(initialBalance);
  const [history, setHistory] = useState<CVTransaction[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);

  // Restore persisted balance on mount
  useEffect(() => {
    AsyncStorage.getItem(CV_STORAGE_KEY).then((stored) => {
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0) setBalance(parsed);
      }
    }).catch(() => {}).finally(() => {
      setHydrated(true);
    });
  }, []);

  // Persist balance changes (skip until hydrated to avoid overwriting with initialBalance)
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(CV_STORAGE_KEY, String(balance)).catch(() => {});
  }, [balance, hydrated]);

  /** Earn CV — called when server emits cv:earn */
  const earn = useCallback((amount: number, reason: string) => {
    setBalance((prev) => prev + amount);
    setHistory((prev) => [
      { amount, reason, timestamp: Date.now() },
      ...prev.slice(0, 49), // keep last 50
    ]);
  }, []);

  /** Spend CV — returns true if successful, false if insufficient */
  const spend = useCallback((moveType: string): boolean => {
    const move = CV_POWER_MOVES[moveType];
    if (!move) return false;

    // Check balance
    if (balance < move.cost) return false;

    // Check cooldown
    const cooldownExpires = cooldowns[moveType] || 0;
    if (Date.now() < cooldownExpires) return false;

    // Deduct and set cooldown
    setBalance((prev) => prev - move.cost);
    setCooldowns((prev) => ({
      ...prev,
      [moveType]: Date.now() + move.cooldownMs,
    }));
    setHistory((prev) => [
      { amount: -move.cost, reason: moveType, timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);

    return true;
  }, [balance, cooldowns]);

  /** Check if a power move is available (balance + cooldown) */
  const canUse = useCallback((moveType: string): boolean => {
    const move = CV_POWER_MOVES[moveType];
    if (!move) return false;
    if (balance < move.cost) return false;
    const cooldownExpires = cooldowns[moveType] || 0;
    return Date.now() >= cooldownExpires;
  }, [balance, cooldowns]);

  /** Get remaining cooldown in ms for a move (0 = ready) */
  const getCooldownRemaining = useCallback((moveType: string): number => {
    const expires = cooldowns[moveType] || 0;
    return Math.max(0, expires - Date.now());
  }, [cooldowns]);

  /** Sync balance from server (e.g., on session join) */
  const syncBalance = useCallback((serverBalance: number) => {
    setBalance(serverBalance);
  }, []);

  return {
    balance,
    history,
    earn,
    spend,
    canUse,
    getCooldownRemaining,
    syncBalance,
  };
}

export default useCV;
