import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { Track } from '../../types';
import TacticalGridBackground from '../session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../session-v2/theme/tacticalTokens';

type SourceKey = 'spotify' | 'soundcloud';

const SOURCE_META: Record<SourceKey, { label: string; color: string }> = {
  spotify: { label: 'SPT', color: '#1DB954' },
  soundcloud: { label: 'SC', color: '#FF5500' },
};

function getSourceKey(track: Track): SourceKey | null {
  if (track.source === 'spotify') return 'spotify';
  if (track.source === 'soundcloud') return 'soundcloud';
  return null;
}

export interface SearchHudOverlayProps {
  visible: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  results: Track[];
  isSearching: boolean;
  queuedTrackIds: string[];
  onClose: () => void;
  onPatchTrack: (track: Track) => void;
}

export function SearchHudOverlay({
  visible,
  query,
  onQueryChange,
  results,
  isSearching,
  queuedTrackIds,
  onClose,
  onPatchTrack,
}: SearchHudOverlayProps) {
  const [sources, setSources] = useState<Record<SourceKey, boolean>>({
    spotify: true,
    soundcloud: true,
  });
  const [patchedId, setPatchedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return results.filter((t) => {
      const key = getSourceKey(t);
      if (!key) return true;
      return sources[key];
    });
  }, [results, sources]);

  const toggleSource = (key: SourceKey) => {
    setSources((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePatch = (track: Track) => {
    if (patchedId) return;
    setPatchedId(track.id);
    setTimeout(() => {
      onPatchTrack(track);
      setPatchedId(null);
    }, 300);
  };

  const renderRow = ({ item }: { item: Track }) => {
    const sourceKey = getSourceKey(item);
    const source = sourceKey ? SOURCE_META[sourceKey] : null;
    const inQueue = queuedTrackIds.includes(item.id) || (item.sourceId ? queuedTrackIds.includes(item.sourceId) : false);
    const isPatched = patchedId === item.id;

    return (
      <Pressable
        onPress={() => (inQueue ? null : handlePatch(item))}
        disabled={inQueue || !!patchedId}
        style={({ pressed }) => [
          styles.trackRow,
          inQueue && styles.trackRowDisabled,
          isPatched && styles.trackRowPatched,
          pressed && !inQueue && !isPatched && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={inQueue ? `${item.title} already in queue` : `Patch ${item.title} by ${item.artist}`}
      >
        <View style={styles.trackArt}>
          {item.albumArt ? <Image source={{ uri: item.albumArt }} style={styles.trackArtImg} /> : null}
        </View>

        <View style={styles.trackBody}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {item.title.toUpperCase()}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>

        {source ? (
          <View style={[styles.sourceBadge, { borderColor: source.color }]}>
            <Text style={[styles.sourceBadgeText, { color: source.color }]}>{source.label}</Text>
          </View>
        ) : null}

        <View style={styles.costCell}>
          <Text style={[styles.costText, (isPatched || !inQueue) && styles.costTextActive]}>
            {inQueue ? 'IN QUEUE' : isPatched ? 'PATCHED ✓' : '-5V'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
        <TacticalGridBackground opacity={0.35} />

        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.hTitle}>PATCH TRACK</Text>
              <Text style={styles.hSub}>SEARCHING GLOBAL DATABASES</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={18} color={tacticalTokens.colors.textDim} />
            </Pressable>
          </View>

          <View style={styles.inputZone}>
            <View style={styles.searchBar}>
              <View style={styles.cursor} />
              <TextInput
                value={query}
                onChangeText={onQueryChange}
                placeholder="TYPE TO SEARCH"
                placeholderTextColor={tacticalTokens.colors.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                selectionColor={tacticalTokens.colors.white}
                style={styles.searchInput}
                returnKeyType="search"
              />
            </View>

            <View style={styles.sourceRow}>
              {(['spotify', 'soundcloud'] as const).map((key) => {
                const meta = SOURCE_META[key];
                const active = sources[key];
                return (
                  <Pressable
                    key={key}
                    onPress={() => toggleSource(key)}
                    style={({ pressed }) => [
                      styles.sourceBtn,
                      active && { borderColor: meta.color, backgroundColor: `${meta.color}22` },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.sourceDot, { backgroundColor: active ? meta.color : tacticalTokens.colors.textDim }]} />
                    <Text style={[styles.sourceText, active && { color: meta.color }]}>{`[ ${meta.label} ]`}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsLabel}>TOP RESULTS ( -5V COST )</Text>
          </View>

          {isSearching ? (
            <View style={styles.loading}>
              <ActivityIndicator color={tacticalTokens.colors.acid} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(t) => t.id}
              renderItem={renderRow}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.results}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>NO MATCHES // REFINE QUERY</Text>
                </View>
              }
            />
          )}

          <View style={styles.keyboardMock}>
            <Text style={styles.keyboardMockText}>[ SYSTEM KEYBOARD ACTIVE ]</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: tacticalTokens.spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  panel: {
    height: '88%',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: tacticalTokens.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  hTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: 22,
    color: tacticalTokens.colors.ice,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hSub: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tacticalTokens.radius.sharp,
  },
  inputZone: {
    padding: tacticalTokens.spacing.xl,
    gap: tacticalTokens.spacing.md,
  },
  searchBar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.md,
    gap: tacticalTokens.spacing.sm,
  },
  cursor: {
    width: 10,
    height: 20,
    backgroundColor: tacticalTokens.colors.white,
  },
  searchInput: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: 18,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingVertical: 0,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
  },
  sourceBtn: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  sourceDot: {
    width: 6,
    height: 6,
  },
  sourceText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.4,
  },
  resultsHeader: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.sm,
  },
  resultsLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 2,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    paddingBottom: tacticalTokens.spacing.xs,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xl,
  },
  trackRow: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    flexDirection: 'row',
    alignItems: 'center',
    padding: tacticalTokens.spacing.sm,
    gap: tacticalTokens.spacing.md,
    marginTop: tacticalTokens.spacing.sm,
  },
  trackRowDisabled: {
    opacity: 0.55,
  },
  trackRowPatched: {
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: 'rgba(57, 255, 20, 0.10)',
  },
  trackArt: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    overflow: 'hidden',
  },
  trackArtImg: {
    width: '100%',
    height: '100%',
  },
  trackBody: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: 14,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
  },
  trackArtist: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
  },
  sourceBadge: {
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: tacticalTokens.radius.sharp,
  },
  sourceBadgeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  costCell: {
    width: 76,
    alignItems: 'flex-end',
  },
  costText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.1,
  },
  costTextActive: {
    color: tacticalTokens.colors.ice,
  },
  empty: {
    marginTop: tacticalTokens.spacing.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: tacticalTokens.colors.border,
    padding: tacticalTokens.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 2,
  },
  keyboardMock: {
    height: 120,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.border,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardMockText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 2,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
});

export default SearchHudOverlay;
