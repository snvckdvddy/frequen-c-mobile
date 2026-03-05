/**
 * OracleModeCard — AI semantic music search.
 *
 * Users describe a mood/feeling/aesthetic and Oracle returns 3 curated
 * track recommendations. Renders inline in the QueueSheet search area.
 */

import React, { useState } from 'react';
import {
  View, TouchableOpacity, TextInput, ActivityIndicator,
  StyleSheet, Keyboard,
} from 'react-native';
import { Text } from '../ui';
import { aiApi, type OracleModeResult } from '../../services/api';
import { palette } from '../../design/tokens/materials';
import { fontFamily, fontSize } from '../../design/tokens/typography';
import { spacing } from '../../theme/spacing';

interface Props {
  /** Called when user taps ADD on a suggested track */
  onAddTrack: (title: string, artist: string) => void;
}

export function OracleModeCard({ onAddTrack }: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<OracleModeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim() || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await aiApi.oracle(query.trim());
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Oracle unavailable');
      console.warn('[Oracle]', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Oracle header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>✦ ORACLE</Text>
        <Text style={styles.headerSub}>Describe a feeling or aesthetic.</Text>
      </View>

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="music for brutalist architecture..."
          placeholderTextColor={palette.slate}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel="Describe the mood or feeling you want"
        />
        <TouchableOpacity
          style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
          onPress={search}
          disabled={loading || !query.trim()}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color={palette.amber} />
          ) : (
            <Text style={styles.searchBtnText}>→</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Results */}
      {result && result.tracks.map((track, i) => (
        <View key={`${track.title}-${i}`} style={styles.trackRow}>
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => onAddTrack(track.title, track.artist)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${track.title} by ${track.artist}`}
          >
            <Text style={styles.addBtnText}>ADD</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 16, 18, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(90, 200, 200, 0.22)',
  },
  header: {
    marginBottom: spacing.sm,
  },
  headerLabel: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.sm,
    color: palette.frost,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  headerSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.slate,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  input: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderColor: palette.chromeBorder,
    paddingHorizontal: 12,
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.frost,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(90, 200, 200, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  searchBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize['2xl'],
    color: palette.ice,
    letterSpacing: 0,
    fontWeight: '700',
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: palette.red,
    marginBottom: spacing.xs,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.chromeBorder,
  },
  trackInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  trackTitle: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    color: palette.frost,
    fontWeight: '700',
  },
  trackArtist: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: palette.silver,
    marginTop: 2,
  },
  addBtn: {
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.ice,
    backgroundColor: 'rgba(90, 200, 200, 0.08)',
  },
  addBtnText: {
    fontFamily: fontFamily.label,
    fontSize: 10,
    color: palette.ice,
    letterSpacing: 1,
    fontWeight: '700',
  },
});
