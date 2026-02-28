/**
 * SonicAestheticCard — Queue vibe analysis + track suggestion.
 *
 * Triggered by "ANALYZE" button in the queue area.
 * Sends the current queue to Gemini Flash, gets back:
 *   - Editorial 1-sentence "Sonic Aesthetic" description
 *   - One curated track suggestion with ADD button
 *
 * Renders as a dismissible card above the queue list.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontWeight, letterSpacing as ls } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';
import { aiApi, type SonicAestheticResult, type QueueTrackInput } from '../../services/api';

// ─── Types ──────────────────────────────────────────────────

interface SonicAestheticCardProps {
  queue: QueueTrackInput[];
  onAddSuggestion: (title: string, artist: string) => void;
}

// ─── Analyze Button (exported for use in queue header) ──────

export function AnalyzeButton({
  onPress,
  loading,
  compact = false,
}: {
  onPress: () => void;
  loading: boolean;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.analyzeBtn, compact && styles.analyzeBtnCompact]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Analyze queue vibe"
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.amber} />
      ) : (
        <Text style={styles.sparkle}>✦</Text>
      )}
      <Text style={[styles.analyzeBtnText, compact && styles.analyzeBtnTextCompact]}>
        {loading ? 'ANALYZING...' : 'ANALYZE'}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Result Card (can be controlled externally) ─────────────

export function SonicAestheticResultCard({
  result,
  onAddSuggestion,
  onDismiss,
}: {
  result: SonicAestheticResult;
  onAddSuggestion: (title: string, artist: string) => void;
  onDismiss?: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.cardTitle}>SONIC AESTHETIC</Text>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={18} color={palette.slate} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.description}>
        "{result.aestheticDescription}"
      </Text>

      <View style={styles.suggestion}>
        <View style={styles.suggestionMeta}>
          <Text style={styles.suggestionLabel}>ORACLE SUGGESTION</Text>
          <Text style={styles.suggestionTrack}>{result.nextTrack}</Text>
          <Text style={styles.suggestionArtist}>{result.nextArtist}</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => onAddSuggestion(result.nextTrack, result.nextArtist)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${result.nextTrack} to queue`}
        >
          <Text style={styles.addBtnText}>ADD</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main Card ──────────────────────────────────────────────

export function SonicAestheticCard({ queue, onAddSuggestion }: SonicAestheticCardProps) {
  const [result, setResult] = useState<SonicAestheticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const analyze = useCallback(async () => {
    if (queue.length === 0) return;
    setLoading(true);
    setError(null);
    setDismissed(false);

    try {
      const data = await aiApi.sonicAesthetic(queue);
      setResult(data);
      fadeAnim.setValue(0);
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 10,
      }).start();
    } catch (err: any) {
      setError(err?.message || 'Unable to analyze sonic aesthetic');
      console.warn('[SonicAesthetic]', err.message);
    } finally {
      setLoading(false);
    }
  }, [queue, fadeAnim]);

  const dismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
      setResult(null);
    });
  }, [fadeAnim]);

  const handleAdd = useCallback(() => {
    if (result) {
      onAddSuggestion(result.nextTrack, result.nextArtist);
    }
  }, [result, onAddSuggestion]);

  return (
    <>
      {/* Analyze button — always visible in queue header */}
      <AnalyzeButton onPress={analyze} loading={loading} />

      {/* Error */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Result card */}
      {result && !dismissed && (
        <Animated.View
          style={[
            styles.cardAnimatedWrap,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              }],
            },
          ]}
        >
          <SonicAestheticResultCard result={result} onAddSuggestion={handleAdd} onDismiss={dismiss} />
        </Animated.View>
      )}
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 96, 0.26)',
    backgroundColor: 'rgba(255, 184, 96, 0.10)',
  },
  analyzeBtnCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  analyzeBtnText: {
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: palette.amber,
    textTransform: 'uppercase' as const,
  },
  analyzeBtnTextCompact: {
    fontSize: 10,
    letterSpacing: 1,
  },
  sparkle: {
    fontSize: 14,
    color: palette.amber,
  },
  cardAnimatedWrap: {
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: 'rgba(10, 12, 16, 0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 96, 0.22)',
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    fontSize: 12,
    letterSpacing: 1.3,
    color: palette.frost,
    textTransform: 'uppercase' as const,
  },
  description: {
    fontFamily: fontFamily.body,
    fontSize: 18,
    lineHeight: 28,
    color: palette.frost,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
  },
  suggestionMeta: {
    flex: 1,
  },
  suggestionLabel: {
    fontFamily: fontFamily.mono,
    fontWeight: fontWeight.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: palette.slate,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  suggestionTrack: {
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    color: palette.frost,
  },
  suggestionArtist: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    color: palette.silver,
    marginTop: 2,
  },
  addBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: palette.silver,
    backgroundColor: 'transparent',
  },
  addBtnText: {
    fontFamily: fontFamily.label,
    fontWeight: fontWeight.bold,
    fontSize: 11,
    letterSpacing: ls.wide,
    color: palette.frost,
  },
  errorContainer: {
    marginTop: spacing.sm,
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    color: palette.red,
  },
});

export default SonicAestheticCard;
