/**
 * SonicLineageCard — Museum-plaque style editorial breakdown
 * of the currently playing track's cultural lineage and sonic texture.
 *
 * Appears under the track info in NowPlayingCard when expanded.
 * Uses Gemini Flash via backend /api/ai/sonic-lineage endpoint.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../ui';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontWeight } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';
import { aiApi } from '../../services/api';

// ─── Types ──────────────────────────────────────────────────

interface SonicLineageCardProps {
  trackTitle: string | null;
  trackArtist: string | null;
}

// ─── Component ──────────────────────────────────────────────

export function SonicLineageCard({ trackTitle, trackArtist }: SonicLineageCardProps) {
  const [lineage, setLineage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const lastTrackRef = useRef<string | null>(null);

  // Reset when track changes
  useEffect(() => {
    const key = `${trackTitle}::${trackArtist}`;
    if (key !== lastTrackRef.current) {
      lastTrackRef.current = key;
      setLineage(null);
      setError(null);
      setExpanded(false);
      expandAnim.setValue(0);
    }
  }, [trackTitle, trackArtist, expandAnim]);

  const fetchLineage = useCallback(async () => {
    if (!trackTitle || !trackArtist) return;
    if (lineage) {
      // Already have it — just toggle expand
      setExpanded((prev) => {
        Animated.spring(expandAnim, {
          toValue: prev ? 0 : 1,
          useNativeDriver: false,
          tension: 80,
          friction: 12,
        }).start();
        return !prev;
      });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await aiApi.sonicLineage(trackTitle, trackArtist);
      setLineage(result.lineage);
      setExpanded(true);
      Animated.spring(expandAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 80,
        friction: 12,
      }).start();
    } catch (err: any) {
      setError(err?.message || 'Unable to read sonic lineage');
      console.warn('[SonicLineage]', err.message);
    } finally {
      setLoading(false);
    }
  }, [trackTitle, trackArtist, lineage, expandAnim]);

  if (!trackTitle || !trackArtist) return null;

  const maxHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 760],
  });

  const contentOpacity = expandAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View style={styles.container}>
      {/* Trigger label */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={fetchLineage}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Show sonic lineage"
      >
        <Text style={styles.sparkle}>✦</Text>
        <Text style={styles.triggerLabel}>
          {loading ? 'READING LINEAGE...' : 'SONIC LINEAGE'}
        </Text>
        {loading && (
          <ActivityIndicator size="small" color={palette.amber} style={{ marginLeft: 8 }} />
        )}
        {!loading && lineage && (
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={palette.slate}
            style={{ marginLeft: 8 }}
          />
        )}
      </TouchableOpacity>

      {/* Expandable content */}
      <Animated.View style={[styles.contentWrapper, { maxHeight, opacity: contentOpacity }]}>
        {lineage && (
          <View style={styles.content}>
            <View style={styles.accentBar} />
            <Text style={styles.lineageText}>
              {lineage}
            </Text>
          </View>
        )}
        {error && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.screenPadding,
    marginBottom: spacing.md,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  sparkle: {
    fontSize: 16,
    color: palette.amber,
    marginRight: 10,
  },
  triggerLabel: {
    fontFamily: fontFamily.displayBold,
    fontWeight: fontWeight.bold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: palette.frost,
    textTransform: 'uppercase' as const,
  },
  contentWrapper: {
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    backgroundColor: 'rgba(8, 10, 16, 0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 96, 0.20)',
    paddingVertical: 16,
    paddingRight: 16,
    marginTop: 6,
  },
  accentBar: {
    width: 2,
    backgroundColor: palette.amber,
    borderRadius: 2,
    marginRight: 14,
    marginLeft: 10,
    opacity: 0.85,
  },
  lineageText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 28,
    color: palette.frost,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: palette.red,
    marginTop: 8,
  },
});

export default SonicLineageCard;
