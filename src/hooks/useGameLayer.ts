/**
 * useGameLayer — Extracted game-layer domain logic from SessionRoomScreen.
 *
 * Covers: Crossfader Duels, Frequency Forecasts, Power Moves (Overdrive,
 * Phase Cancel, Phantom Power), and overlay state for resonance, transient
 * user walk-ons, reverb tails, and phantom boost.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  type DuelState, type ForecastState, type ResonanceState, type TransientState, type ReverbTailEntry,
} from '../components/room';
import type { Session, QueueTrack } from '../types';
import { DEFAULT_BEHAVIORS } from '../types';
import { type PowerMove, type PowerMoveId } from '../features/power-routing/PowerRoutingSheet';
import { type useCV } from './useCV';
import { showToast } from '../components/ui';
import { tapLight, tapMedium, tapHeavy, notifyWarning } from '../utils/haptics';
import { getGlobalLimiter } from '../utils/rateLimiter';
import {
  duelVote, submitForecast, phantomPower, overdrive, phaseCancel,
  startDuel, startForecast, onSessionEvent,
} from '../services/socket';

// ─── Types ──────────────────────────────────────────────────

export type PendingPowerPrompt =
  | { type: 'overdrive'; trackId: string }
  | { type: 'phase_cancel' };

interface GameLayerParams {
  sessionId: string;
  userId: string | undefined;
  user: { id: string; username: string } | null;
  session: Session | null;
  queue: QueueTrack[];
  setQueue: React.Dispatch<React.SetStateAction<QueueTrack[]>>;
  cv: ReturnType<typeof useCV>;
  isHost: boolean;
}

interface GameLayerReturn {
  duel: {
    state: DuelState;
    handleVote: (side: 'a' | 'b') => void;
    handleStart: () => boolean;
    canStart: boolean;
    actionDescription: string;
    dismiss: () => void;
  };
  forecast: {
    state: ForecastState;
    handlePick: (trackId: string) => void;
    handleStart: () => boolean;
    canStart: boolean;
    actionDescription: string;
    dismiss: () => void;
  };
  powerMoves: {
    handleMove: (moveType: PowerMoveId) => void;
    handleConfirm: () => void;
    pendingPrompt: PendingPowerPrompt | null;
    setPendingPrompt: React.Dispatch<React.SetStateAction<PendingPowerPrompt | null>>;
    moves: PowerMove[];
  };
  overlays: {
    resonanceState: ResonanceState;
    setResonanceState: React.Dispatch<React.SetStateAction<ResonanceState>>;
    transientUser: TransientState;
    setTransientUser: React.Dispatch<React.SetStateAction<TransientState>>;
    reverbTails: ReverbTailEntry[];
    setReverbTails: React.Dispatch<React.SetStateAction<ReverbTailEntry[]>>;
    phantomBoost: { active: boolean; trackId: string | null; username: string; trackName: string };
    setPhantomBoost: React.Dispatch<React.SetStateAction<{ active: boolean; trackId: string | null; username: string; trackName: string }>>;
  };
}

// ─── Hook ───────────────────────────────────────────────────

export function useGameLayer({
  sessionId,
  userId,
  user,
  session,
  queue,
  setQueue,
  cv,
  isHost,
}: GameLayerParams): GameLayerReturn {

  // ─── Pending power prompt ───────────────────────────────
  const [pendingPowerPrompt, setPendingPowerPrompt] = useState<PendingPowerPrompt | null>(null);

  // ─── Crossfader Duel state ──────────────────────────────
  const [duelState, setDuelState] = useState<DuelState>({
    active: false,
    trackA: null,
    trackB: null,
    votes: { a: 0, b: 0 },
    timeRemaining: 0,
    totalTime: 0,
    userVote: null,
    lockedVotes: {},
  });

  // ─── Frequency Forecast state ───────────────────────────
  const [forecastState, setForecastState] = useState<ForecastState>({
    active: false, candidates: [], reward: 0, timeRemaining: 0, userPick: null, lastResult: null,
  });

  const duelDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forecastDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duelOptimisticStartRef = useRef(false);
  const forecastOptimisticStartRef = useRef(false);

  // ─── Resonance Event ────────────────────────────────────
  const [resonanceState, setResonanceState] = useState<ResonanceState>({
    active: false, type: 'harmonic', message: '', cvBonus: 0,
  });

  // ─── Transient Enter (user walk-on) ─────────────────────
  const [transientUser, setTransientUser] = useState<TransientState>({
    active: false, username: '',
  });

  // ─── Reverb Tail (ghost presence) ───────────────────────
  const [reverbTails, setReverbTails] = useState<ReverbTailEntry[]>([]);

  // ─── Phantom Power boost (per-track) ────────────────────
  const [phantomBoost, setPhantomBoost] = useState<{
    active: boolean; trackId: string | null; username: string; trackName: string;
  }>({ active: false, trackId: null, username: '', trackName: '' });

  // ─── Duel callbacks ─────────────────────────────────────

  const resetDuelState = useCallback(() => {
    duelOptimisticStartRef.current = false;
    setDuelState({
      active: false,
      trackA: null,
      trackB: null,
      votes: { a: 0, b: 0 },
      timeRemaining: 0,
      totalTime: 0,
      userVote: null,
      lockedVotes: {},
    });
  }, []);

  const dismissDuelOverlay = useCallback(() => {
    if (duelDismissTimerRef.current) {
      clearTimeout(duelDismissTimerRef.current);
      duelDismissTimerRef.current = null;
    }
    resetDuelState();
  }, [resetDuelState]);

  const resetForecastState = useCallback(() => {
    forecastOptimisticStartRef.current = false;
    setForecastState({
      active: false,
      candidates: [],
      reward: 0,
      timeRemaining: 0,
      userPick: null,
      lastResult: null,
    });
  }, []);

  const dismissForecastOverlay = useCallback(() => {
    if (forecastDismissTimerRef.current) {
      clearTimeout(forecastDismissTimerRef.current);
      forecastDismissTimerRef.current = null;
    }
    resetForecastState();
  }, [resetForecastState]);

  const armDuelOverlay = useCallback((trackA: QueueTrack, trackB: QueueTrack, duration: number) => {
    if (duelDismissTimerRef.current) {
      clearTimeout(duelDismissTimerRef.current);
      duelDismissTimerRef.current = null;
    }
    setDuelState((prev) => {
      const sameMatch =
        prev.active &&
        prev.trackA?.id === trackA.id &&
        prev.trackB?.id === trackB.id;

      return {
        active: true,
        trackA,
        trackB,
        votes: sameMatch ? prev.votes : { a: 0, b: 0 },
        timeRemaining: duration,
        totalTime: duration,
        userVote: sameMatch ? prev.userVote : null,
        lockedVotes: sameMatch ? prev.lockedVotes : {},
      };
    });
  }, []);

  const armForecastOverlay = useCallback((candidates: QueueTrack[], reward: number, duration: number) => {
    if (forecastDismissTimerRef.current) {
      clearTimeout(forecastDismissTimerRef.current);
      forecastDismissTimerRef.current = null;
    }
    setForecastState((prev) => {
      const sameCandidateIds =
        prev.active &&
        prev.candidates.length === candidates.length &&
        prev.candidates.every((candidate, index) => candidate.id === candidates[index]?.id);

      return {
        active: true,
        candidates,
        reward,
        timeRemaining: duration,
        userPick: sameCandidateIds ? prev.userPick : null,
        lastResult: null,
      };
    });
  }, []);

  const applyDuelQueueResult = useCallback((winnerId: string, loserId: string) => {
    setQueue((prev) => {
      if (prev.length === 0) return prev;
      const current = prev[0] || null;
      const challengers = prev.slice(1);
      const winner = challengers.find((track) => track.id === winnerId) || null;
      const remaining = challengers.filter((track) => track.id !== winnerId && track.id !== loserId);

      if (current) {
        return winner ? [current, winner, ...remaining] : [current, ...remaining];
      }

      return winner ? [winner, ...remaining] : remaining;
    });
  }, [setQueue]);

  const finalizeDuel = useCallback((
    winner: 'a' | 'b',
    trackA: QueueTrack,
    trackB: QueueTrack,
    votes: { a: number; b: number },
  ) => {
    const winnerTrack = winner === 'a' ? trackA : trackB;
    const loserTrack = winner === 'a' ? trackB : trackA;

    applyDuelQueueResult(winnerTrack.id, loserTrack.id);
    setDuelState((prev) => ({
      ...prev,
      active: true,
      trackA,
      trackB,
      votes,
      timeRemaining: 0,
      totalTime: prev.totalTime || 18,
    }));
    showToast(`${winnerTrack.title} won the duel. ${loserTrack.title} dropped.`, 'success', '!');

    if (duelDismissTimerRef.current) {
      clearTimeout(duelDismissTimerRef.current);
    }
    duelDismissTimerRef.current = setTimeout(() => {
      resetDuelState();
      duelDismissTimerRef.current = null;
    }, 2400);
  }, [applyDuelQueueResult, resetDuelState]);

  // ─── Socket listener effects ────────────────────────────

  useEffect(() => {
    const unsubs = [
      onSessionEvent('duel:start', (data) => {
        armDuelOverlay(data.trackA, data.trackB, data.duration);
        tapLight();
        if (duelOptimisticStartRef.current) {
          duelOptimisticStartRef.current = false;
        } else {
          showToast('Crossfader Duel is live. Lock a side.', 'info', '!');
        }
      }),
      onSessionEvent('duel:vote', (data) => {
        setDuelState((prev) => {
          if (!prev.active || prev.lockedVotes[data.userId]) return prev;
          return {
            ...prev,
            votes: {
              a: prev.votes.a + (data.side === 'a' ? 1 : 0),
              b: prev.votes.b + (data.side === 'b' ? 1 : 0),
            },
            lockedVotes: {
              ...prev.lockedVotes,
              [data.userId]: data.side,
            },
            userVote: data.userId === userId ? data.side : prev.userVote,
          };
        });
      }),
      onSessionEvent('duel:end', (data) => {
        if (duelDismissTimerRef.current) return;
        duelOptimisticStartRef.current = false;
        finalizeDuel(data.winner, data.trackA, data.trackB, data.votes);
      }),
      onSessionEvent('forecast:start', (data) => {
        armForecastOverlay(data.candidates, data.reward, data.duration);
        tapLight();
        if (forecastOptimisticStartRef.current) {
          forecastOptimisticStartRef.current = false;
        } else {
          showToast('Frequency Forecast is live. Lock your prediction.', 'info', '!');
        }
      }),
      onSessionEvent('forecast:result', (data) => {
        if (forecastDismissTimerRef.current) return;
        forecastOptimisticStartRef.current = false;
        setForecastState((prev) => {
          const predicted = data.predictions[userId || ''] || prev.userPick;
          return {
            ...prev,
            timeRemaining: 0,
            lastResult: predicted
              ? {
                  predicted,
                  actual: data.winnerId,
                  correct: predicted === data.winnerId,
                  earned: predicted === data.winnerId ? prev.reward : 0,
                }
              : null,
          };
        });
        forecastDismissTimerRef.current = setTimeout(() => {
          resetForecastState();
          forecastDismissTimerRef.current = null;
        }, 3200);
      }),
    ];

    return () => {
      unsubs.forEach((fn) => fn());
      if (duelDismissTimerRef.current) {
        clearTimeout(duelDismissTimerRef.current);
        duelDismissTimerRef.current = null;
      }
      if (forecastDismissTimerRef.current) {
        clearTimeout(forecastDismissTimerRef.current);
        forecastDismissTimerRef.current = null;
      }
    };
  }, [armDuelOverlay, armForecastOverlay, finalizeDuel, resetForecastState, userId]);

  // Duel countdown timer
  useEffect(() => {
    if (!duelState.active || duelState.timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setDuelState((prev) =>
        prev.active && prev.timeRemaining > 0
          ? { ...prev, timeRemaining: prev.timeRemaining - 1 }
          : prev,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [duelState.active, duelState.timeRemaining]);

  // Duel timeout-finalize
  useEffect(() => {
    if (!duelState.active || duelState.timeRemaining > 0) return;
    if (duelDismissTimerRef.current || !duelState.trackA || !duelState.trackB) return;

    const winner: 'a' | 'b' = duelState.votes.b > duelState.votes.a ? 'b' : 'a';
    finalizeDuel(winner, duelState.trackA, duelState.trackB, duelState.votes);
  }, [
    duelState.active,
    duelState.timeRemaining,
    duelState.trackA,
    duelState.trackB,
    duelState.votes,
    finalizeDuel,
  ]);

  // Forecast countdown timer
  useEffect(() => {
    if (!forecastState.active || forecastState.timeRemaining <= 0) return;
    const timer = setInterval(() => {
      setForecastState((prev) =>
        prev.active && prev.timeRemaining > 0
          ? { ...prev, timeRemaining: prev.timeRemaining - 1 }
          : prev,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [forecastState.active, forecastState.timeRemaining]);

  // Forecast timeout-finalize
  useEffect(() => {
    if (!forecastState.active || forecastState.timeRemaining > 0) return;
    if (forecastState.lastResult || forecastDismissTimerRef.current) return;

    const winnerId = forecastState.candidates[0]?.id || '';
    setForecastState((prev) => ({
      ...prev,
      lastResult: prev.userPick
        ? {
            predicted: prev.userPick,
            actual: winnerId,
            correct: prev.userPick === winnerId,
            earned: prev.userPick === winnerId ? prev.reward : 0,
          }
        : null,
    }));
    forecastDismissTimerRef.current = setTimeout(() => {
      resetForecastState();
      forecastDismissTimerRef.current = null;
    }, 3200);
  }, [forecastState.active, forecastState.timeRemaining, forecastState.lastResult, forecastState.candidates, resetForecastState]);

  // ─── Handlers ───────────────────────────────────────────

  const handleDuelVote = useCallback((side: 'a' | 'b') => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('duelVote')) return;
    if (duelState.userVote) return;
    tapHeavy();
    setDuelState((prev) => ({ ...prev, userVote: side }));
    duelVote(sessionId, user.id, side);
  }, [user, session, sessionId, duelState.userVote]);

  const handleStartDuel = useCallback((): boolean => {
    if (!user || !session) return false;
    const hostCanStartDuel = user.id === session.hostId;
    const duelEnabled = (session.behaviors || DEFAULT_BEHAVIORS).duelEnabled;
    const challengerA = queue[1];
    const challengerB = queue[2];

    if (!hostCanStartDuel) {
      notifyWarning();
      showToast('Only the host can start a duel.', 'warning', '!');
      return false;
    }
    if (!duelEnabled) {
      notifyWarning();
      showToast('Enable Crossfader Duel in room settings first.', 'warning', '!');
      return false;
    }
    if (duelState.active) {
      notifyWarning();
      showToast('A duel is already active in this room.', 'info', '!');
      return false;
    }
    if (!challengerA || !challengerB || queue.length < 3) {
      notifyWarning();
      showToast('Need at least 3 queued tracks to launch a duel.', 'warning', '!');
      return false;
    }

    tapMedium();

    duelOptimisticStartRef.current = true;
    armDuelOverlay(challengerA, challengerB, 18);
    startDuel(sessionId, challengerA.id, challengerB.id, 18);
    showToast('Duel armed. Lock a side.', 'info', '!');
    return true;
  }, [user, session, duelState.active, queue, sessionId, armDuelOverlay]);

  const handleForecastPick = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('forecast')) return;
    tapMedium();
    submitForecast(sessionId, user.id, trackId);
    setForecastState((prev) => ({ ...prev, userPick: trackId }));
  }, [user, session, sessionId]);

  const handleStartForecast = useCallback((): boolean => {
    if (!user || !session) return false;
    const hostCanStartForecast = user.id === session.hostId;
    const forecastEnabled = (session.behaviors || DEFAULT_BEHAVIORS).forecastEnabled;

    if (!hostCanStartForecast) {
      notifyWarning();
      showToast('Only the host can start a forecast.', 'warning', '!');
      return false;
    }
    if (!forecastEnabled) {
      notifyWarning();
      showToast('Enable Frequency Forecast in room settings first.', 'warning', '!');
      return false;
    }
    if (forecastState.active) {
      notifyWarning();
      showToast('A forecast is already in progress.', 'info', '!');
      return false;
    }
    if (queue.length < 2) {
      notifyWarning();
      showToast('Need at least 2 tracks in queue to forecast.', 'warning', '!');
      return false;
    }

    tapMedium();

    forecastOptimisticStartRef.current = true;
    armForecastOverlay(queue.slice(0, Math.min(5, queue.length)), 2, 20);
    startForecast(sessionId);
    showToast('Forecast armed. Lock a prediction.', 'info', '!');
    return true;
  }, [user, session, forecastState.active, queue, sessionId, armForecastOverlay]);

  const handlePhantomPower = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('phantom_power')) {
      notifyWarning();
      showToast('Need 5 CV for Phantom Power.', 'warning', '!');
      return;
    }
    tapHeavy();
    cv.spend('phantom_power');
    const track = queue.find((t) => t.id === trackId);
    setPhantomBoost({
      active: true, trackId,
      username: user.username, trackName: track?.title || '',
    });
    phantomPower(sessionId, trackId, user.id);
  }, [user, session, sessionId, cv, queue]);

  const handleOverdrive = useCallback((trackId: string) => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('overdrive')) {
      notifyWarning();
      showToast('Need 25 CV for Overdrive.', 'warning', '!');
      return;
    }
    setPendingPowerPrompt({ type: 'overdrive', trackId });
  }, [user, session, sessionId, cv]);

  const handlePhaseCancel = useCallback(() => {
    if (!user || !session) return;
    if (!getGlobalLimiter().canDo('cvSpend')) return;
    if (!cv.canUse('phase_cancel')) {
      notifyWarning();
      showToast('Need 15 CV for Phase Cancel.', 'warning', '!');
      return;
    }
    setPendingPowerPrompt({ type: 'phase_cancel' });
  }, [user, session, sessionId, cv]);

  const handlePowerMove = useCallback((moveType: PowerMoveId) => {
    const track = queue[0];
    switch (moveType) {
      case 'overdrive':
        if (track) handleOverdrive(track.id);
        break;
      case 'phase_cancel':
        handlePhaseCancel();
        break;
      case 'phantom_power':
        if (track) handlePhantomPower(track.id);
        break;
    }
  }, [queue, handleOverdrive, handlePhaseCancel, handlePhantomPower]);

  const handleConfirmPowerPrompt = useCallback(() => {
    if (!user || !session || !pendingPowerPrompt) return;
    tapHeavy();
    if (pendingPowerPrompt.type === 'overdrive') {
      cv.spend('overdrive');
      overdrive(sessionId, pendingPowerPrompt.trackId, user.id);
    } else {
      cv.spend('phase_cancel');
      phaseCancel(sessionId, user.id);
    }
    setPendingPowerPrompt(null);
  }, [user, session, pendingPowerPrompt, cv, sessionId]);

  // ─── Derived values ─────────────────────────────────────

  const sessionBehaviors = session?.behaviors || DEFAULT_BEHAVIORS;
  const currentTrack: QueueTrack | null = queue[0] || null;

  const canStartDuel = !!isHost
    && sessionBehaviors.duelEnabled
    && !duelState.active
    && queue.length >= 3;

  const duelActionDescription = !isHost
    ? 'Host-only head-to-head queue battles.'
    : !sessionBehaviors.duelEnabled
      ? 'Enable Crossfader Duel in Room Settings first.'
      : duelState.active
        ? 'A head-to-head battle is already active in this room.'
        : queue.length < 3
          ? 'Need at least 3 queued tracks so two challengers can battle behind the live track.'
          : 'Launch a timed battle between the next two challengers in queue.';

  const canStartForecast = !!isHost
    && sessionBehaviors.forecastEnabled
    && !forecastState.active
    && queue.length >= 2;

  const forecastActionDescription = !isHost
    ? 'Host-only prediction rounds.'
    : !sessionBehaviors.forecastEnabled
      ? 'Enable Frequency Forecast in Room Settings first.'
      : forecastState.active
        ? 'A prediction round is already live in this room.'
        : queue.length < 2
          ? 'Need at least 2 tracks in queue to launch a forecast.'
          : 'Launch a 20-second prediction round for the current queue.';

  const powerRoutingMoves = useMemo<PowerMove[]>(() => {
    const hasTrackTarget = !!currentTrack;
    return [
      {
        id: 'phantom_power',
        name: 'PHANTOM_PWR',
        cost: 5,
        description: hasTrackTarget
          ? 'Inject +5 votes to the active track in this room.'
          : 'Requires an active track in the room.',
        variant: 'acid',
        disabled: !hasTrackTarget,
      },
      {
        id: 'phase_cancel',
        name: 'PHASE_CANCEL',
        cost: 15,
        description: 'Block the next skip attempt. Guarantee your track plays.',
        variant: 'ice',
      },
      {
        id: 'overdrive',
        name: 'OVERDRIVE',
        cost: 25,
        description: hasTrackTarget
          ? 'Force the active room track to the top of the queue.'
          : 'Requires an active track in the room.',
        variant: 'hotPink',
        disabled: !hasTrackTarget,
      },
    ];
  }, [currentTrack]);

  // ─── Return grouped by domain ───────────────────────────

  return {
    duel: {
      state: duelState,
      handleVote: handleDuelVote,
      handleStart: handleStartDuel,
      canStart: canStartDuel,
      actionDescription: duelActionDescription,
      dismiss: dismissDuelOverlay,
    },
    forecast: {
      state: forecastState,
      handlePick: handleForecastPick,
      handleStart: handleStartForecast,
      canStart: canStartForecast,
      actionDescription: forecastActionDescription,
      dismiss: dismissForecastOverlay,
    },
    powerMoves: {
      handleMove: handlePowerMove,
      handleConfirm: handleConfirmPowerPrompt,
      pendingPrompt: pendingPowerPrompt,
      setPendingPrompt: setPendingPowerPrompt,
      moves: powerRoutingMoves,
    },
    overlays: {
      resonanceState,
      setResonanceState,
      transientUser,
      setTransientUser,
      reverbTails,
      setReverbTails,
      phantomBoost,
      setPhantomBoost,
    },
  };
}
