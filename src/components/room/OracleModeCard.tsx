/**
 * OracleModeCard — AI semantic music search.
 *
 * Users describe a mood/feeling/aesthetic. Oracle returns curated text
 * suggestions, then the client attempts to resolve those into real tracks
 * through the active music search providers so patching can feel concrete.
 */

import React, { useCallback, useState, type ReactNode } from 'react';
import {
  View,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Image,
  ScrollView,
} from 'react-native';
import { Text } from '../ui';
import { aiApi, searchApi, type OracleModeResult } from '../../services/api';
import type { Track } from '../../types';
import type { SearchHudSource } from '../../hooks/useSearch';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';

interface Props {
  /** Fallback patch path when Oracle only has a title/artist suggestion */
  onAddTrack: (title: string, artist: string) => void;
  /** Direct patch path when Oracle resolves to a concrete track */
  onAddResolvedTrack?: (track: Track) => void;
  /** Restrict Oracle resolution to the current live provider selection */
  preferredSources?: SearchHudSource[];
}

type OracleResolutionStatus = 'resolving' | 'resolved' | 'unresolved';

interface OracleResolution {
  status: OracleResolutionStatus;
  track?: Track;
}

const ORACLE_PRESETS = [
  'MIDNIGHT DRIVE',
  'BRUTALIST ROMANCE',
  'OPENING SCENE OF A THRILLER',
  'RAIN ON CONCRETE',
];

const MAX_RECENT_PROMPTS = 4;

function suggestionKey(title: string, artist: string, index: number) {
  return `${title}__${artist}__${index}`;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveBestTrackMatch(
  tracks: Track[],
  title: string,
  artist: string,
): Track | undefined {
  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artist);

  return (
    tracks.find(
      (track) =>
        normalize(track.title) === wantedTitle &&
        normalize(track.artist) === wantedArtist,
    ) ||
    tracks.find(
      (track) =>
        normalize(track.title).includes(wantedTitle) &&
        normalize(track.artist).includes(wantedArtist),
    ) ||
    tracks[0]
  );
}

function renderChipLabel(children: ReactNode) {
  return <Text style={styles.promptChipText}>{children}</Text>;
}

export function OracleModeCard({
  onAddTrack,
  onAddResolvedTrack,
  preferredSources,
}: Props) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<OracleModeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, OracleResolution>>({});
  const [recentPrompts, setRecentPrompts] = useState<string[]>([]);

  const resolveSuggestions = useCallback(
    async (tracks: OracleModeResult['tracks']) => {
      const activeSources = preferredSources && preferredSources.length > 0
        ? preferredSources
        : undefined;

      const initialState = Object.fromEntries(
        tracks.map((track, index) => [
          suggestionKey(track.title, track.artist, index),
          { status: 'resolving' as const },
        ]),
      );
      setResolutions(initialState);

      if (preferredSources && preferredSources.length === 0) {
        const unresolvedState = Object.fromEntries(
          tracks.map((track, index) => [
            suggestionKey(track.title, track.artist, index),
            { status: 'unresolved' as const },
          ]),
        );
        setResolutions(unresolvedState);
        return;
      }

      const resolved = await Promise.all(
        tracks.map(async (track, index) => {
          const key = suggestionKey(track.title, track.artist, index);
          try {
            const { tracks: matches } = await searchApi.tracks(
              `${track.title} ${track.artist}`,
              activeSources,
            );
            const match = resolveBestTrackMatch(matches, track.title, track.artist);
            return {
              key,
              resolution: match
                ? { status: 'resolved' as const, track: match }
                : { status: 'unresolved' as const },
            };
          } catch {
            return {
              key,
              resolution: { status: 'unresolved' as const },
            };
          }
        }),
      );

      setResolutions(
        Object.fromEntries(
          resolved.map((entry) => [entry.key, entry.resolution]),
        ),
      );
    },
    [preferredSources],
  );

  const search = useCallback(async () => {
    if (!query.trim() || loading) return;
    const feeling = query.trim();
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setResult(null);
    setResolutions({});

    try {
      const data = await aiApi.oracle(feeling);
      setResult(data);
      setRecentPrompts((prev) =>
        [feeling, ...prev.filter((item) => item !== feeling)].slice(0, MAX_RECENT_PROMPTS),
      );
      void resolveSuggestions(data.tracks);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Oracle unavailable';
      setError(message);
      console.warn('[Oracle]', message);
    } finally {
      setLoading(false);
    }
  }, [loading, query, resolveSuggestions]);

  const renderSuggestionRow = (
    suggestion: OracleModeResult['tracks'][number],
    index: number,
  ) => {
    const key = suggestionKey(suggestion.title, suggestion.artist, index);
    const resolution = resolutions[key];
    const resolvedTrack = resolution?.track;
    const resolvedSource = resolvedTrack?.source?.toUpperCase() || null;
    const noProvidersArmed = !!preferredSources && preferredSources.length === 0;

    let metaText = 'LOCKING LIVE ROUTE';
    if (resolution?.status === 'resolved' && resolvedTrack) {
      metaText = `LOCKED // ${resolvedSource}`;
    } else if (noProvidersArmed) {
      metaText = 'ARM LIVE PROVIDER';
    } else if (resolution?.status === 'unresolved') {
      metaText = 'NO LOCK // SEARCH PATH';
    }

    const handlePatchPress = () => {
      if (noProvidersArmed) return;
      if (resolvedTrack && onAddResolvedTrack) {
        onAddResolvedTrack(resolvedTrack);
        return;
      }
      onAddTrack(suggestion.title, suggestion.artist);
    };

    return (
      <View key={key} style={styles.trackRow}>
        <View style={styles.trackIndex}>
          <Text style={styles.trackIndexText}>{String(index + 1).padStart(2, '0')}</Text>
        </View>

        <View style={styles.trackArt}>
          {resolvedTrack?.albumArt ? (
            <Image source={{ uri: resolvedTrack.albumArt }} style={styles.trackArtImage} />
          ) : (
            <Text style={styles.trackArtFallback}>AI</Text>
          )}
        </View>

        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {suggestion.title.toUpperCase()}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {suggestion.artist}
          </Text>
          <Text style={styles.trackMeta} numberOfLines={1}>
            {metaText}
          </Text>
        </View>

        {resolution?.status === 'resolving' ? (
          <View style={styles.resolvingRail}>
            <ActivityIndicator size="small" color={tacticalTokens.colors.orange} />
          </View>
        ) : (
          <Pressable
            style={[
              styles.addBtn,
              resolution?.status === 'resolved' && styles.addBtnResolved,
              noProvidersArmed && styles.addBtnDisabled,
            ]}
            onPress={handlePatchPress}
            disabled={noProvidersArmed}
            accessibilityRole="button"
            accessibilityLabel={
              resolution?.status === 'resolved'
                ? `Patch resolved match for ${suggestion.title} by ${suggestion.artist}`
                : `Search and patch ${suggestion.title} by ${suggestion.artist}`
            }
          >
            <Text
              style={[
                styles.addBtnText,
                resolution?.status === 'resolved' && styles.addBtnTextResolved,
                noProvidersArmed && styles.addBtnTextDisabled,
              ]}
            >
              {noProvidersArmed ? 'ARM' : resolution?.status === 'resolved' ? 'PATCH' : 'SEARCH'}
            </Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>ORACLE</Text>
        <Text style={styles.headerSub}>DESCRIBE A FEELING, SCENE, OR AESTHETIC.</Text>
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputPrefix}>
          <Text style={styles.inputPrefixText}>AI</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="MUSIC FOR BRUTALIST ARCHITECTURE..."
          placeholderTextColor={tacticalTokens.colors.textDim}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          accessibilityLabel="Describe the mood or feeling you want"
        />
        <Pressable
          style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
          onPress={search}
          disabled={loading || !query.trim()}
          accessibilityRole="button"
          accessibilityLabel="Run oracle search"
        >
          {loading ? (
            <ActivityIndicator size="small" color={tacticalTokens.colors.orange} />
          ) : (
            <Text style={styles.searchBtnText}>EXEC</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.promptRow}
      >
        {recentPrompts.map((item) => (
          <Pressable
            key={`recent-${item}`}
            style={[styles.promptChip, styles.promptChipRecent]}
            onPress={() => setQuery(item)}
          >
            {renderChipLabel(item)}
          </Pressable>
        ))}
        {ORACLE_PRESETS.filter((item) => !recentPrompts.includes(item)).map((item) => (
          <Pressable
            key={`preset-${item}`}
            style={styles.promptChip}
            onPress={() => setQuery(item)}
          >
            {renderChipLabel(item)}
          </Pressable>
        ))}
      </ScrollView>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {result ? (
        <View style={styles.resultsWrap}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsLabel}>CURATED RETURNS</Text>
            <Text style={styles.resultsMeta}>
              {preferredSources && preferredSources.length === 0
                ? 'ENABLE A MUSIC SOURCE TO FIND TRACKS'
                : 'MATCHING RESULTS TO YOUR CONNECTED SERVICES'}
            </Text>
          </View>
          {result.tracks.map(renderSuggestionRow)}
        </View>
      ) : !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>ORACLE READY</Text>
          <Text style={styles.emptyBody}>
            DESCRIBE A MOOD OR VIBE — ORACLE FINDS TRACKS THAT FIT AND QUEUES THEM FOR YOU.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.sm,
    padding: tacticalTokens.spacing.md,
    backgroundColor: tacticalTokens.colors.void,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
  },
  header: {
    marginBottom: tacticalTokens.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    paddingBottom: tacticalTokens.spacing.sm,
  },
  headerLabel: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1,
  },
  headerSub: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    marginTop: 4,
    letterSpacing: 1.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.xs,
    marginBottom: tacticalTokens.spacing.sm,
    alignItems: 'stretch',
  },
  inputPrefix: {
    width: 44,
    minHeight: 52,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputPrefixText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.3,
  },
  input: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    paddingHorizontal: tacticalTokens.spacing.md,
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.void,
    letterSpacing: 0.8,
  },
  searchBtn: {
    minWidth: 72,
    minHeight: 52,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: 'rgba(255, 69, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  searchBtnText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.4,
  },
  promptRow: {
    gap: tacticalTokens.spacing.xs,
    paddingBottom: tacticalTokens.spacing.xs,
  },
  promptChip: {
    minHeight: 28,
    paddingHorizontal: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    justifyContent: 'center',
  },
  promptChipRecent: {
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  promptChipText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1,
  },
  errorText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    marginTop: tacticalTokens.spacing.xs,
    marginBottom: tacticalTokens.spacing.xs,
    letterSpacing: 1.1,
  },
  resultsWrap: {
    marginTop: tacticalTokens.spacing.sm,
  },
  resultsHeader: {
    marginBottom: tacticalTokens.spacing.sm,
  },
  resultsLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.8,
  },
  resultsMeta: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    marginBottom: tacticalTokens.spacing.sm,
  },
  trackIndex: {
    width: 36,
    minHeight: 70,
    borderRightWidth: 1,
    borderRightColor: tacticalTokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.void,
  },
  trackIndexText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  trackArt: {
    width: 48,
    height: 48,
    marginLeft: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackArtImage: {
    width: '100%',
    height: '100%',
  },
  trackArtFallback: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.4,
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  trackTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  trackArtist: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    marginTop: 2,
    letterSpacing: 0.8,
  },
  trackMeta: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    marginTop: 4,
    letterSpacing: 0.9,
  },
  resolvingRail: {
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: tacticalTokens.spacing.sm,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: 'rgba(255, 69, 0, 0.12)',
    minHeight: 40,
    minWidth: 76,
    marginRight: tacticalTokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.md,
  },
  addBtnResolved: {
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: 'rgba(57, 255, 20, 0.10)',
  },
  addBtnDisabled: {
    opacity: 0.45,
  },
  addBtnText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1.4,
  },
  addBtnTextResolved: {
    color: tacticalTokens.colors.acid,
  },
  addBtnTextDisabled: {
    color: tacticalTokens.colors.textDim,
  },
  emptyState: {
    marginTop: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    padding: tacticalTokens.spacing.lg,
    minHeight: 148,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
    marginBottom: tacticalTokens.spacing.xs,
  },
  emptyBody: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textDim,
    lineHeight: 18,
    letterSpacing: 1,
  },
});

export default OracleModeCard;
