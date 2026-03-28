/**
 * GameLayerOverlays — Layer 3-4 game/economy/environment overlays.
 *
 * Renders: CrossfaderDuel, FrequencyForecast, ResonanceEvent,
 * TransientEnter, ReverbTail, MasterBounce.
 * Extracted from SessionRoomScreen for modularity.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CrossfaderDuel } from '../CrossfaderDuel';
import { FrequencyForecast } from '../FrequencyForecast';
import { ResonanceEvent } from '../ResonanceEvent';
import { TransientEnter } from '../TransientEnter';
import { ReverbTail } from '../ReverbTail';
import { MasterBounce } from '../MasterBounce';
import type { QueueTrack, Track, RoomMode, RoomBehaviors } from '../../types';

// ─── Duel State ─────────────────────────────────────────
export interface DuelState {
  active: boolean;
  trackA: QueueTrack | null;
  trackB: QueueTrack | null;
  votes: { a: number; b: number };
  timeRemaining: number;
  totalTime: number;
  userVote: 'a' | 'b' | null;
  lockedVotes: Record<string, 'a' | 'b'>;
}

// ─── Forecast State ─────────────────────────────────────
export interface ForecastState {
  active: boolean;
  candidates: QueueTrack[];
  reward: number;
  timeRemaining: number;
  userPick: string | null;
  lastResult: { predicted: string; actual: string; correct: boolean; earned: number } | null;
}

// ─── Resonance State ────────────────────────────────────
export interface ResonanceState {
  active: boolean;
  type: 'harmonic' | 'octave' | 'feedback';
  message: string;
  cvBonus: number;
}

// ─── Transient State ────────────────────────────────────
export interface TransientState {
  active: boolean;
  username: string;
}

// ─── Reverb Tail Entry ──────────────────────────────────
export interface ReverbTailEntry {
  userId: string;
  username: string;
  duration: number;
  active: boolean;
}

interface GameLayerOverlaysProps {
  // Crossfader Duel
  duelState: DuelState;
  onDuelVote: (pick: 'a' | 'b') => void;
  onDuelEnd: () => void;

  // Frequency Forecast
  forecastState: ForecastState;
  onForecastPick: (trackId: string) => void;
  onForecastDismiss: () => void;

  // Resonance Event
  resonanceState: ResonanceState;
  onResonanceComplete: () => void;

  // Transient Enter
  transientUser: TransientState;
  onTransientComplete: () => void;

  // Reverb Tails
  reverbTails: ReverbTailEntry[];
  onReverbDecayed: (userId: string) => void;

  // Master Bounce (session end receipt)
  bounceVisible: boolean;
  sessionName: string;
  roomMode: RoomMode;
  behaviors: RoomBehaviors;
  hostUsername: string;
  durationSeconds: number;
  tracksPlayed: QueueTrack[];
  participantCount: number;
  cvEarned: number;
  endedAt: string;
  onBounceDismiss: () => void;
}

export function GameLayerOverlays({
  duelState,
  onDuelVote,
  onDuelEnd,
  forecastState,
  onForecastPick,
  onForecastDismiss,
  resonanceState,
  onResonanceComplete,
  transientUser,
  onTransientComplete,
  reverbTails,
  onReverbDecayed,
  bounceVisible,
  sessionName,
  roomMode,
  behaviors,
  hostUsername,
  durationSeconds,
  tracksPlayed,
  participantCount,
  cvEarned,
  endedAt,
  onBounceDismiss,
}: GameLayerOverlaysProps) {
  // Determine if any game overlay is actively showing something.
  // When true, we use 'box-none' so the overlay container itself won't
  // block touches but its active children still can.
  // When false, 'none' ensures a completely pass-through layer.
  const anyActive =
    (duelState.active && duelState.trackA != null && duelState.trackB != null) ||
    forecastState.active ||
    resonanceState.active ||
    transientUser.active ||
    reverbTails.length > 0 ||
    bounceVisible;

  if (!anyActive) {
    return null;
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* ─── Layer 3: Crossfader Duel (overlay) ──────── */}
      {duelState.active && duelState.trackA && duelState.trackB && (
        <View style={StyleSheet.absoluteFill}>
          <CrossfaderDuel
            trackA={duelState.trackA}
            trackB={duelState.trackB}
            votes={duelState.votes}
            timeRemaining={duelState.timeRemaining}
            totalTime={duelState.totalTime}
            userVote={duelState.userVote}
            onVote={onDuelVote}
            onDuelEnd={onDuelEnd}
          />
        </View>
      )}

      {/* ─── Layer 3: Frequency Forecast (overlay) ───── */}
      {forecastState.active && (
        <View style={StyleSheet.absoluteFill}>
          <FrequencyForecast
            candidates={forecastState.candidates}
            reward={forecastState.reward}
            timeRemaining={forecastState.timeRemaining}
            userPick={forecastState.userPick}
            onPredict={onForecastPick}
            lastResult={forecastState.lastResult}
            onDismiss={onForecastDismiss}
          />
        </View>
      )}

      {/* ─── Layer 3: Resonance Event ────────────────── */}
      <ResonanceEvent
        type={resonanceState.type}
        message={resonanceState.message}
        cvBonus={resonanceState.cvBonus}
        active={resonanceState.active}
        duration={3000}
        onComplete={onResonanceComplete}
      />

      {/* ─── Layer 4: Transient Enter ────────────────── */}
      <TransientEnter
        username={transientUser.username}
        active={transientUser.active}
        onComplete={onTransientComplete}
      />

      {/* ─── Layer 4: Reverb Tails ────────────────────── */}
      {reverbTails.map((tail) => (
        <ReverbTail
          key={tail.userId}
          username={tail.username}
          duration={tail.duration}
          active={tail.active}
          onDecayed={() => onReverbDecayed(tail.userId)}
        />
      ))}

      {/* ─── Master Bounce Receipt (session end) ──────── */}
      {bounceVisible && (
        <MasterBounce
          sessionName={sessionName}
          roomMode={roomMode}
          behaviors={behaviors}
          hostUsername={hostUsername}
          durationSeconds={durationSeconds}
          tracksPlayed={tracksPlayed}
          participantCount={participantCount}
          cvEarned={cvEarned}
          endedAt={endedAt}
          visible
          onDismiss={onBounceDismiss}
        />
      )}
    </View>
  );
}

export default GameLayerOverlays;
