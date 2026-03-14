import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalWaveformProps {
  trackId?: string | null;
  elapsed: number;
  duration: number;
  progress: number;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function hashSeed(value: string) {
  return value.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 2147483647, 7);
}

export function TacticalWaveform({
  trackId,
  elapsed,
  duration,
  progress,
}: TacticalWaveformProps) {
  const idle = !trackId;
  const bars = useMemo(() => {
    const count = 38;
    const seed = hashSeed(trackId || 'idle-signal');
    return Array.from({ length: count }, (_, index) => {
      const next = Math.abs(Math.sin(seed + index * 1.17));
      return 0.18 + next * 0.82;
    });
  }, [trackId]);

  const activeBars = Math.max(0, Math.round((progress || 0) * bars.length));
  const remaining = Math.max(0, (duration || 0) - (elapsed || 0));

  return (
    <View style={[styles.container, idle && styles.idleContainer]}>
      <View style={styles.waveRow}>
        {bars.map((height, index) => {
          const isActive = index < activeBars;
          const isPeak = isActive && height > 0.78;

          return (
            <View
              key={`wave-${index}`}
              style={[
                styles.bar,
                {
                  height: `${height * 100}%`,
                  backgroundColor: isPeak
                    ? tacticalTokens.colors.orange
                    : isActive
                      ? tacticalTokens.colors.white
                      : '#333333',
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(elapsed)}</Text>
        <Text style={styles.timeText}>-{formatTime(remaining)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tacticalTokens.spacing.md,
    marginHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.xs,
  },
  idleContainer: {
    marginTop: tacticalTokens.spacing.xs,
  },
  waveRow: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  bar: {
    flex: 1,
    minWidth: 4,
  },
  timeRow: {
    marginTop: 2,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.acid,
  },
});

export default TacticalWaveform;
