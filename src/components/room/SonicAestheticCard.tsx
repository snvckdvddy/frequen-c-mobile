/**
 * SonicAestheticCard — Queue vibe analysis + track suggestion.
 *
 * Used in both legacy queue surfaces and the active Session V2 queue path.
 * The AI suggestion is resolved against real track search results before
 * offering a direct patch action when possible.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Track } from '../../types';
import { Text } from '../ui';
import { aiApi, searchApi, type QueueTrackInput, type SonicAestheticResult } from '../../services/api';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';
import { theme } from '../../theme/theme';


interface SonicAestheticCardProps {
  queue: QueueTrackInput[];
  onAddSuggestion?: (title: string, artist: string) => void;
  onAddResolvedTrack?: (track: Track) => void;
}

function sourceLabel(source?: string) {
  switch (source) {
    case 'spotify':
      return 'SPT';
    case 'soundcloud':
      return 'SC';
    case 'apple':
      return 'APL';
    case 'tidal':
      return 'TDL';
    default:
      return 'LIVE';
  }
}

function buildQuery(result: SonicAestheticResult) {
  return `${result.nextTrack} ${result.nextArtist}`.trim();
}

async function resolveSuggestedTrack(result: SonicAestheticResult): Promise<Track | null> {
  const { tracks } = await searchApi.tracks(buildQuery(result));
  return tracks[0] || null;
}

export function AnalyzeButton({
  onPress,
  loading,
  compact = false,
  disabled = false,
}: {
  onPress: () => void;
  loading: boolean;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.analyzeBtn,
        compact && styles.analyzeBtnCompact,
        disabled && styles.analyzeBtnDisabled,
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.72}
      accessibilityRole="button"
      accessibilityLabel="Analyze queue vibe"
    >
      {loading ? (
        <ActivityIndicator size="small" color={tacticalTokens.colors.orange} />
      ) : (
        <Text style={[styles.analyzeSparkle, disabled && styles.analyzeSparkleDisabled]}>AI</Text>
      )}
      <Text
        style={[
          styles.analyzeBtnText,
          compact && styles.analyzeBtnTextCompact,
          disabled && styles.analyzeBtnTextDisabled,
        ]}
      >
        {loading ? 'SCANNING...' : 'SONIC AESTHETIC'}
      </Text>
    </TouchableOpacity>
  );
}

export function SonicAestheticResultCard({
  result,
  resolvedTrack,
  resolving,
  onAddSuggestion,
  onAddResolvedTrack,
  onDismiss,
}: {
  result: SonicAestheticResult;
  resolvedTrack?: Track | null;
  resolving?: boolean;
  onAddSuggestion?: (title: string, artist: string) => void;
  onAddResolvedTrack?: (track: Track) => void;
  onDismiss?: () => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const statusText = resolving
    ? 'LOCKING ROUTE...'
    : resolvedTrack
      ? `LOCKED TO ${sourceLabel(resolvedTrack.source)}`
      : 'DIRECT MATCH NOT LOCKED';

  const actionLabel = resolving ? 'LOCK' : resolvedTrack ? 'PATCH' : 'SEARCH';

  const handleAction = () => {
    if (resolvedTrack && onAddResolvedTrack) {
      onAddResolvedTrack(resolvedTrack);
      return;
    }
    onAddSuggestion?.(result.nextTrack, result.nextArtist);
  };

  const actionDisabled = resolving || (!resolvedTrack && !onAddSuggestion);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.cardEyebrow}>SYS.FREQ // AI CURATION</Text>
          <Text style={styles.cardTitle}>SONIC AESTHETIC</Text>
        </View>
        <View style={styles.cardHeaderActions}>
          <Pressable
            onPress={() => setDetailOpen((prev) => !prev)}
            style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={detailOpen ? 'Hide sonic aesthetic details' : 'Open sonic aesthetic details'}
          >
            <Text style={styles.detailButtonText}>{detailOpen ? 'HIDE' : 'DETAIL'}</Text>
          </Pressable>
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss sonic aesthetic"
            >
              <Ionicons name="close" size={16} color={tacticalTokens.colors.white} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.description} numberOfLines={1}>
        {result.aestheticDescription}
      </Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>ROUTE</Text>
        <Text style={styles.statusValue}>{statusText}</Text>
      </View>

      {detailOpen ? (
        <View style={styles.detailPanel}>
          <Text style={styles.detailLabel}>FULL PROFILE</Text>
          <Text style={styles.detailDescription}>{result.aestheticDescription}</Text>
        </View>
      ) : null}

      <View style={styles.suggestion}>
        <View style={styles.suggestionMeta}>
          <Text style={styles.suggestionLabel}>NEXT PATCH</Text>
          <Text style={styles.suggestionTrack} numberOfLines={1}>
            {result.nextTrack.toUpperCase()}
          </Text>
          <Text style={styles.suggestionArtist} numberOfLines={1}>
            {result.nextArtist}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, actionDisabled && styles.addBtnDisabled]}
          onPress={handleAction}
          disabled={actionDisabled}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${result.nextTrack} by ${result.nextArtist}`}
        >
          <Text style={[styles.addBtnText, actionDisabled && styles.addBtnTextDisabled]}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function SonicAestheticCard({
  queue,
  onAddSuggestion,
  onAddResolvedTrack,
}: SonicAestheticCardProps) {
  const [result, setResult] = useState<SonicAestheticResult | null>(null);
  const [resolvedTrack, setResolvedTrack] = useState<Track | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const ready = queue.length >= 2;

  const analyze = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setResolving(false);
    setResolvedTrack(null);
    setResult(null);
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

      setResolving(true);
      try {
        const match = await resolveSuggestedTrack(data);
        setResolvedTrack(match);
      } catch (resolveErr: unknown) {
        console.warn('[SonicAesthetic:Resolve]', resolveErr instanceof Error ? resolveErr.message : String(resolveErr));
      } finally {
        setResolving(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to profile room aesthetic';
      setError(message);
      console.warn('[SonicAesthetic]', message);
    } finally {
      setLoading(false);
    }
  }, [fadeAnim, queue, ready]);

  const dismiss = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setDismissed(true);
      setResult(null);
      setResolvedTrack(null);
    });
  }, [fadeAnim]);

  const handleAddSuggestion = useCallback(() => {
    if (!result) return;
    if (resolvedTrack && onAddResolvedTrack) {
      onAddResolvedTrack(resolvedTrack);
      return;
    }
    onAddSuggestion?.(result.nextTrack, result.nextArtist);
  }, [onAddResolvedTrack, onAddSuggestion, resolvedTrack, result]);

  // ── Compact idle: just the button. Expands only when a result exists. ──
  if (!result || dismissed) {
    return (
      <View style={styles.compactRow}>
        <AnalyzeButton onPress={analyze} loading={loading} disabled={!ready} compact />
        {error ? (
          <Text style={styles.compactError} numberOfLines={1}>{error.toUpperCase()}</Text>
        ) : null}
      </View>
    );
  }

  // ── Expanded: result card with dismiss ──
  return (
    <Animated.View
      style={[
        styles.cardAnimatedWrap,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0],
              }),
            },
          ],
        },
      ]}
    >
      <SonicAestheticResultCard
        result={result}
        resolvedTrack={resolvedTrack}
        resolving={resolving}
        onAddSuggestion={handleAddSuggestion}
        onAddResolvedTrack={resolvedTrack && onAddResolvedTrack ? onAddResolvedTrack : undefined}
        onDismiss={dismiss}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  analyzeBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: 'rgba(255, 69, 0, 0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyzeBtnCompact: {
    minHeight: 30,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  analyzeBtnDisabled: {
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matte,
  },
  analyzeSparkle: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.5,
  },
  analyzeSparkleDisabled: {
    color: tacticalTokens.colors.textDim,
  },
  analyzeBtnText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.3,
  },
  analyzeBtnTextCompact: {
    fontSize: tacticalTokens.fontSize.sys,
  },
  analyzeBtnTextDisabled: {
    color: tacticalTokens.colors.textDim,
  },
  cardAnimatedWrap: {
    marginTop: theme.spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  cardEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.8,
  },
  cardTitle: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.white,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  detailButton: {
    minWidth: 68,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
    paddingHorizontal: 10,
  },
  detailButtonText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.2,
  },
  pressed: {
    opacity: 0.76,
  },
  description: {
    marginTop: theme.spacing.sm,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.body,
    lineHeight: 20,
    color: tacticalTokens.colors.textSoft,
  },
  detailPanel: {
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
    padding: theme.spacing.md,
  },
  detailLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.6,
  },
  detailDescription: {
    marginTop: theme.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.body,
    lineHeight: 22,
    color: tacticalTokens.colors.textSoft,
  },
  statusRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderGhost,
    paddingTop: theme.spacing.sm,
  },
  statusLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.8,
  },
  statusValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  suggestion: {
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matteGhost,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  suggestionMeta: {
    flex: 1,
  },
  suggestionLabel: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.8,
  },
  suggestionTrack: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  suggestionArtist: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.ice,
  },
  addBtn: {
    minWidth: 82,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: 'rgba(255, 69, 0, 0.10)',
  },
  addBtnDisabled: {
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matte,
  },
  addBtnText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.3,
  },
  addBtnTextDisabled: {
    color: tacticalTokens.colors.textDim,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  compactError: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.2,
  },
});

export default SonicAestheticCard;
