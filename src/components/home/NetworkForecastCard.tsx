/**
 * NetworkForecastCard — Daily AI "horoscope" for the Frequen-C network.
 *
 * Displays a cryptic, poetic manifesto about the current global mood
 * and a single track suggestion. Fetches once per mount, can refresh.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, ActivityIndicator, StyleSheet } from 'react-native';
import { Text } from '../ui';
import { aiApi, type GlobalForecastResult } from '../../services/api';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontSize } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';

export function NetworkForecastCard() {
  const [forecast, setForecast] = useState<GlobalForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchForecast = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await aiApi.globalForecast();
      setForecast(data);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (err: any) {
      setError(err?.message || 'Forecast unavailable');
      console.warn('[Forecast]', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast();
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>✦ NETWORK FORECAST</Text>
        <TouchableOpacity
          onPress={fetchForecast}
          disabled={loading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh network forecast"
        >
          <Text style={[styles.refreshText, loading && styles.refreshTextDisabled]}>
            {loading ? '...' : 'REFRESH'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {loading && !forecast && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.amber} />
          <Text style={styles.loadingText}>Reading the frequencies...</Text>
        </View>
      )}

      {/* Error */}
      {error && !forecast && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Forecast content */}
      {forecast && (
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.manifesto}>{forecast.manifesto}</Text>
          <View style={styles.trackRow}>
            <Text style={styles.trackLabel}>BROADCAST:</Text>
            <Text style={styles.trackValue} numberOfLines={1}>{forecast.trackSuggestion}</Text>
          </View>
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
    backgroundColor: 'rgba(255, 184, 96, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 184, 96, 0.24)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerLabel: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.sm,
    color: palette.amber,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  refreshText: {
    fontFamily: fontFamily.label,
    fontSize: 11,
    color: palette.silver,
    letterSpacing: 1,
  },
  refreshTextDisabled: {
    opacity: 0.4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.silver,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.red,
  },
  manifesto: {
    fontFamily: fontFamily.body,
    fontStyle: 'italic',
    fontSize: fontSize.lg,
    color: palette.frost,
    lineHeight: 32,
    marginBottom: spacing.md,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  trackLabel: {
    fontFamily: fontFamily.label,
    fontSize: 11,
    color: palette.amber,
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  trackValue: {
    flex: 1,
    fontFamily: fontFamily.display,
    fontSize: fontSize.md,
    color: palette.frost,
  },
});
