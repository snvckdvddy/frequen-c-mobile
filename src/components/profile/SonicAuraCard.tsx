/**
 * SonicAuraCard — AI-generated "aura reading" for the user's profile.
 *
 * Analyzes user stats (rooms hosted, duel win rate, top artists)
 * and generates a pretentious editorial reading of their sonic identity.
 */

import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { aiApi, type SonicAuraResult, type SonicAuraInput } from '../../services/api';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontSize } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';

interface Props {
  /** User stats for the aura reading */
  roomsHosted: number;
  duelWinRate: number;
  topArtists: string[];
}

export function SonicAuraCard({ roomsHosted, duelWinRate, topArtists }: Props) {
  const [aura, setAura] = useState<SonicAuraResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const generate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const input: SonicAuraInput = { roomsHosted, duelWinRate, topArtists };
      const data = await aiApi.sonicAura(input);
      setAura(data);
      fadeAnim.setValue(0);
      Animated.spring(fadeAnim, { toValue: 1, useNativeDriver: true }).start();
    } catch (err: any) {
      setError(err?.message || 'Aura reading unavailable');
      console.warn('[SonicAura]', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.headerLabel}>✦ SONIC AURA</Text>

      {/* Not yet generated — show trigger */}
      {!aura && !loading && (
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={generate}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Generate your sonic aura reading"
        >
          <Text style={styles.generateBtnText}>READ SONIC AURA</Text>
        </TouchableOpacity>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.amber} />
          <Text style={styles.loadingText}>Analyzing your frequency...</Text>
        </View>
      )}

      {/* Error */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Aura result */}
      {aura && (
        <Animated.View style={[styles.auraContent, { opacity: fadeAnim }]}>
          <View style={styles.auraBadge}>
            <Text style={styles.auraName}>{aura.auraName.toUpperCase()}</Text>
          </View>
          <Text style={styles.auraReading}>{aura.reading}</Text>

          {/* Regenerate */}
          <TouchableOpacity
            style={styles.regenBtn}
            onPress={generate}
            activeOpacity={0.7}
          >
            <Text style={styles.regenText}>RE-READ</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: 'rgba(4, 18, 30, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(90, 200, 200, 0.24)',
  },
  headerLabel: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.sm,
    color: palette.frost,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  generateBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(90, 200, 200, 0.34)',
    backgroundColor: 'rgba(0, 50, 78, 0.34)',
  },
  generateBtnText: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.sm,
    color: palette.ice,
    letterSpacing: 1.3,
    fontWeight: '700',
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.md,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.slate,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    color: palette.red,
    textAlign: 'center',
  },
  auraContent: {
    alignItems: 'center',
  },
  auraBadge: {
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(90, 200, 200, 0.14)',
    marginBottom: spacing.sm,
  },
  auraName: {
    fontFamily: fontFamily.label,
    fontSize: fontSize.md,
    color: palette.ice,
    letterSpacing: 1.8,
    fontWeight: '700',
    textAlign: 'center',
  },
  auraReading: {
    fontFamily: fontFamily.body,
    fontStyle: 'italic',
    fontSize: fontSize.md,
    color: palette.frost,
    lineHeight: 25,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  regenBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(90, 200, 200, 0.34)',
    backgroundColor: 'rgba(90, 200, 200, 0.08)',
  },
  regenText: {
    fontFamily: fontFamily.label,
    fontSize: 10,
    color: palette.ice,
    letterSpacing: 1,
  },
});
