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
import { fontFamily, fontSize } from '../../design/tokens/typography';

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Forecast unavailable';
      setError(message);
      console.warn('[Forecast]', message);
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
        <Text style={styles.headerLabel}>NETWORK FORECAST</Text>
        <TouchableOpacity
          onPress={fetchForecast}
          disabled={loading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Refresh network forecast"
        >
          <Text style={[styles.refreshText, loading && styles.refreshTextDisabled]}>
            {loading ? 'SYNCING...' : 'REFRESH'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {loading && !forecast && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#39FF14" />
          <Text style={styles.loadingText}>READING FREQUENCIES...</Text>
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
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#39FF14',
    display: 'flex',
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
    backgroundColor: '#0A0A0A',
  },
  headerLabel: {
    fontFamily: fontFamily.displayBold,
    fontSize: 20,
    color: '#39FF14',
    textTransform: 'uppercase',
  },
  refreshText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#00E5FF',
    fontWeight: '700',
    backgroundColor: '#111',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  refreshTextDisabled: {
    opacity: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  loadingText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
  },
  errorText: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: '#FF4500',
    padding: 16,
    textTransform: 'uppercase',
  },
  manifesto: {
    fontFamily: fontFamily.mono,
    fontSize: 12,
    color: '#FFFFFF',
    padding: 16,
    lineHeight: 18,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  trackLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: '#666',
    textTransform: 'uppercase',
  },
  trackValue: {
    flex: 1,
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
});
