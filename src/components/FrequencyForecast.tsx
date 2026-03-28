import React, { useMemo, useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { QueueTrack } from '../types';
import TacticalGameShell from '../features/session-v2/components/TacticalGameShell';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface FrequencyForecastProps {
  candidates: QueueTrack[];
  reward: number;
  timeRemaining: number;
  userPick?: string | null;
  onPredict: (trackId: string) => void;
  lastResult?: {
    predicted: string;
    actual: string;
    correct: boolean;
    earned: number;
  } | null;
  onDismiss?: () => void;
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${safe}s`;
}

export function FrequencyForecast({
  candidates,
  reward,
  timeRemaining,
  userPick = null,
  onPredict,
  lastResult,
  onDismiss,
}: FrequencyForecastProps) {
  const { width, height } = useWindowDimensions();
  const compact = width <= 420 || height <= 780;
  const [selectedId, setSelectedId] = useState<string | null>(userPick || candidates[0]?.id || null);

  useEffect(() => {
    if (userPick) {
      setSelectedId(userPick);
      return;
    }
    if (!selectedId && candidates[0]?.id) {
      setSelectedId(candidates[0].id);
    }
  }, [candidates, selectedId, userPick]);

  const lockedId = userPick || null;
  const status = lastResult ? 'RESULT' : formatCountdown(timeRemaining);
  const selectedTrack = candidates.find((track) => track.id === selectedId) || null;
  const actualTrack = lastResult ? candidates.find((track) => track.id === lastResult.actual) || null : null;
  const predictedTrack = lastResult ? candidates.find((track) => track.id === lastResult.predicted) || null : null;

  const headerHint = useMemo(() => {
    if (lastResult) {
      return lastResult.correct
        ? `SIGNAL CONFIRMED // +${lastResult.earned} CV`
        : 'SIGNAL MISSED // NO CV AWARDED';
    }
    if (lockedId) {
      const lockedTrack = candidates.find((track) => track.id === lockedId);
      return lockedTrack
        ? `LOCKED TO ${lockedTrack.title.toUpperCase()}`
        : 'SIGNAL LOCKED';
    }
    return 'LOCK THE TRACK YOU THINK WINS THE NEXT ROUND';
  }, [candidates, lastResult, lockedId]);

  const handleLock = () => {
    if (lockedId || !selectedTrack) return;
    onPredict(selectedTrack.id);
  };

  return (
    <TacticalGameShell
      eyebrow="SYS.FREQ // GAME BUS"
      title="FREQUENCY FORECAST"
      status={status}
      accentColor={tacticalTokens.colors.orange}
      onClose={onDismiss}
      footer={
        !lastResult ? (
          <Pressable
            onPress={handleLock}
            disabled={!selectedTrack || !!lockedId}
            style={({ pressed }) => [
              styles.lockButton,
              compact && styles.lockButtonCompact,
              (!!lockedId || !selectedTrack) && styles.lockButtonDisabled,
              pressed && !lockedId && selectedTrack && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Lock forecast signal"
          >
            <Text style={[styles.lockButtonText, compact && styles.lockButtonTextCompact]}>{lockedId ? 'SIGNAL LOCKED' : 'LOCK SIGNAL'}</Text>
          </Pressable>
        ) : undefined
      }
    >
      <View style={[styles.metaRow, compact && styles.metaRowCompact]}>
        <View style={[styles.rewardBlock, compact && styles.rewardBlockCompact]}>
          <Text style={[styles.rewardLabel, compact && styles.rewardLabelCompact]}>CV REWARD</Text>
          <Text style={[styles.rewardValue, compact && styles.rewardValueCompact]}>+{reward}</Text>
        </View>
        <Text style={[styles.hintText, compact && styles.hintTextCompact]}>{headerHint}</Text>
      </View>

      {!lastResult ? (
        <>
          <View style={[styles.progressTrack, compact && styles.progressTrackCompact]}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(0, Math.min(100, (timeRemaining / 20) * 100))}%` },
              ]}
            />
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={[styles.listContent, compact && styles.listContentCompact]}
            showsVerticalScrollIndicator={false}
          >
            {candidates.map((track, index) => {
              const selected = selectedId === track.id;
              const locked = lockedId === track.id;
              return (
                <Pressable
                  key={track.id}
                  onPress={() => {
                    if (lockedId) return;
                    setSelectedId(track.id);
                  }}
                  disabled={!!lockedId}
                  style={({ pressed }) => [
                    styles.candidateRow,
                    compact && styles.candidateRowCompact,
                    selected && styles.candidateRowSelected,
                    locked && styles.candidateRowLocked,
                    pressed && !lockedId && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${track.title} by ${track.artist}`}
                >
                  <View style={[styles.candidateStrip, compact && styles.candidateStripCompact]}>
                    <Text style={[styles.candidateStripText, compact && styles.candidateStripTextCompact]}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>

                  <View style={[styles.candidateBody, compact && styles.candidateBodyCompact]}>
                    <Text style={[styles.candidateTitle, compact && styles.candidateTitleCompact]} numberOfLines={1}>
                      {track.title.toUpperCase()}
                    </Text>
                    <Text style={[styles.candidateArtist, compact && styles.candidateArtistCompact]} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>

                  <View style={[styles.candidateState, compact && styles.candidateStateCompact]}>
                    <Text style={[styles.candidateStateText, compact && styles.candidateStateTextCompact, locked && styles.candidateStateTextActive]}>
                      {locked ? 'LOCKED' : selected ? 'ARMED' : 'OPEN'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : (
        <View style={styles.resultBlock}>
          <View style={styles.resultCard}>
            <Text style={styles.resultEyebrow}>PREDICTED</Text>
            <Text style={styles.resultTitle} numberOfLines={1}>
              {(predictedTrack?.title || 'NO LOCK').toUpperCase()}
            </Text>
            <Text style={styles.resultMeta} numberOfLines={1}>
              {(predictedTrack?.artist || 'UNRESOLVED').toUpperCase()}
            </Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultEyebrow}>ACTUAL WINNER</Text>
            <Text style={[styles.resultTitle, styles.resultTitleAccent]} numberOfLines={1}>
              {(actualTrack?.title || 'UNRESOLVED').toUpperCase()}
            </Text>
            <Text style={styles.resultMeta} numberOfLines={1}>
              {(actualTrack?.artist || 'SYSTEM').toUpperCase()}
            </Text>
          </View>
        </View>
      )}
    </TacticalGameShell>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.md,
  },
  metaRowCompact: {
    gap: tacticalTokens.spacing.xs + 2,
    marginBottom: tacticalTokens.spacing.sm,
  },
  rewardBlock: {
    width: 74,
    minHeight: 60,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: `${tacticalTokens.colors.orange}10`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.sm,
  },
  rewardBlockCompact: {
    width: 70,
    minHeight: 56,
  },
  rewardLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys - 1,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1,
  },
  rewardLabelCompact: {
    fontSize: tacticalTokens.fontSize.sys - 1,
  },
  rewardValue: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label + 2,
    color: tacticalTokens.colors.orange,
  },
  rewardValueCompact: {
    fontSize: tacticalTokens.fontSize.label + 1,
  },
  hintText: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 0.9,
    paddingTop: 2,
  },
  hintTextCompact: {
    fontSize: tacticalTokens.fontSize.small,
    lineHeight: 20,
    letterSpacing: 0.6,
  },
  progressTrack: {
    height: 4,
    marginBottom: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  progressTrackCompact: {
    marginBottom: tacticalTokens.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: tacticalTokens.colors.orange,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: tacticalTokens.spacing.xs + 2,
    gap: tacticalTokens.spacing.xs + 2,
  },
  listContentCompact: {
    gap: tacticalTokens.spacing.xs,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 62,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  candidateRowCompact: {
    minHeight: 60,
  },
  candidateRowSelected: {
    borderColor: tacticalTokens.colors.orange,
  },
  candidateRowLocked: {
    backgroundColor: '#13110C',
  },
  candidateStrip: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  candidateStripCompact: {
    width: 24,
  },
  candidateStripText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  candidateStripTextCompact: {
    fontSize: tacticalTokens.fontSize.sys,
  },
  candidateBody: {
    flex: 1,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.xs + 2,
    minWidth: 0,
  },
  candidateBodyCompact: {
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.xs,
  },
  candidateTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.body + 1,
    color: tacticalTokens.colors.white,
  },
  candidateTitleCompact: {
    fontSize: tacticalTokens.fontSize.body + 1,
  },
  candidateArtist: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
  },
  candidateArtistCompact: {
    fontSize: tacticalTokens.fontSize.sys,
  },
  candidateState: {
    width: 72,
    borderLeftWidth: 1,
    borderLeftColor: tacticalTokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.xs,
  },
  candidateStateCompact: {
    width: 64,
  },
  candidateStateText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1,
  },
  candidateStateTextCompact: {
    fontSize: tacticalTokens.fontSize.sys,
  },
  candidateStateTextActive: {
    color: tacticalTokens.colors.orange,
  },
  resultBlock: {
    gap: tacticalTokens.spacing.md,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  resultEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.6,
  },
  resultTitle: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  resultTitleAccent: {
    color: tacticalTokens.colors.orange,
  },
  resultMeta: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
  },
  lockButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: tacticalTokens.colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockButtonCompact: {
    minHeight: 46,
  },
  lockButtonDisabled: {
    backgroundColor: `${tacticalTokens.colors.orange}22`,
  },
  lockButtonText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.body,
    color: tacticalTokens.colors.void,
    letterSpacing: 1.2,
  },
  lockButtonTextCompact: {
    fontSize: tacticalTokens.fontSize.body,
  },
  pressed: {
    opacity: 0.84,
  },
});
