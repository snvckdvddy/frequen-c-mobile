/**
 * TransitionMatrixCard — AI mix analysis between current + next track.
 *
 * Appears below the progress bar in NowPlayingCard when there's a
 * next track in the queue. Tap "✦ MIX" to fetch a
 * pretentious editorial critique of the transition.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { aiApi, type TransitionMatrixResult } from '../../services/api';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontSize } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';

interface Props {
  currentTitle: string | null;
  currentArtist: string | null;
  nextTitle: string | null;
  nextArtist: string | null;
}

export function TransitionMatrixCard({ currentTitle, currentArtist, nextTitle, nextArtist }: Props) {
  const [result, setResult] = useState<TransitionMatrixResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reset when tracks change
  useEffect(() => {
    setResult(null);
    setError(null);
    fadeAnim.setValue(0);
  }, [currentTitle, nextTitle]);

  // Don't render if we don't have both tracks
  if (!currentTitle || !currentArtist || !nextTitle || !nextArtist) return null;

  const analyze = async () => {
    if (loading || result) return;
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.transitionMatrix(currentTitle, currentArtist, nextTitle, nextArtist);
      setResult(data);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true }).start();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Analysis unavailable';
      setError(message);
      console.warn('[TransitionMatrix]', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!result && (
        <TouchableOpacity
          style={styles.triggerBtn}
          onPress={analyze}
          disabled={loading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Analyze mix transition"
        >
          <Text style={[styles.triggerText, loading && styles.triggerTextLoading]}>
            {loading ? '✦ ANALYZING...' : '✦ MIX'}
          </Text>
        </TouchableOpacity>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {result && (
        <Animated.View style={[styles.resultCard, { opacity: fadeAnim }]}>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>{result.rating.toUpperCase()}</Text>
          </View>
          <Text style={styles.critiqueText}>{result.critique}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  triggerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 96, 0.36)',
    backgroundColor: 'rgba(255, 184, 96, 0.10)',
  },
  triggerText: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.sm,
    color: palette.amber,
    letterSpacing: 1.1,
  },
  triggerTextLoading: {
    color: palette.slate,
  },
  errorText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.slate,
    marginTop: spacing.xs,
  },
  resultCard: {
    width: '100%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(24, 14, 4, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 96, 0.26)',
    alignItems: 'flex-start',
  },
  ratingBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 184, 96, 0.18)',
    marginBottom: 8,
  },
  ratingText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.amber,
    letterSpacing: 2,
    fontWeight: '700',
  },
  critiqueText: {
    fontFamily: fontFamily.body,
    fontStyle: 'italic',
    fontSize: fontSize.md,
    color: palette.frost,
    lineHeight: 24,
  },
});
