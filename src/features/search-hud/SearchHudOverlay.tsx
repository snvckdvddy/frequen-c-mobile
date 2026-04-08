import React, { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Track, ConnectedServices } from '../../types';
import { OracleModeCard } from '../../components/room/OracleModeCard';
import { ServiceSelectorPills } from '../../components/library/ServiceSelectorPills';
import { PlaylistList } from '../../components/library/PlaylistList';
import { PlaylistTrackList } from '../../components/library/PlaylistTrackList';
import { useLibraryBrowse } from '../../hooks/useLibraryBrowse';
import TacticalGridBackground from '../session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../session-v2/theme/tacticalTokens';
import type { SearchHudSource } from '../../hooks/useSearch';
import type { SearchDiagnostics, SearchProviderState } from '../../services/api';
import { getTierForSource } from '../../services/adapters/musicServiceAdapter';
import { palette, withAlpha } from '@/design/tokens/materials';

type SearchMode = 'database' | 'oracle';
type HudTab = 'search' | 'library';

// Order matches the tier model in musicServiceAdapter.ts so the search-source
// filter renders providers in the same priority the routing layer uses:
//   Tier 1 → Apple Music, SoundCloud
//   Tier 2 → Tidal
//   Tier 3 → Spotify (Restricted Beta — Feb 2026 Dev Mode 5-user cap)
// Keeping this aligned with the Library tab's ServiceSelectorPills means a
// user scanning the screen sees the same provider order in both tabs.
const PROVIDER_ORDER: SearchHudSource[] = ['appleMusic', 'soundcloud', 'tidal', 'spotify'];

const PROVIDER_META: Record<SearchHudSource, { label: string; color: string }> = {
  spotify: { label: 'SPT', color: '#1DB954' },
  soundcloud: { label: 'SC', color: '#FF5500' },
  appleMusic: { label: 'APL', color: '#F5F5F7' },
  tidal: { label: 'TDL', color: '#D8FFF7' },
};

function getSourceKey(track: Track): SearchHudSource | null {
  if (track.source === 'spotify') return 'spotify';
  if (track.source === 'soundcloud') return 'soundcloud';
  if (track.source === 'tidal') return 'tidal';
  if (track.source === 'appleMusic') return 'appleMusic';
  return null;
}

function getAvailabilitySources(track: Track): SearchHudSource[] {
  const sources = track.availableSources || [track.source];
  return sources.filter(
    (source): source is SearchHudSource =>
      source === 'spotify' || source === 'soundcloud' || source === 'tidal' || source === 'appleMusic',
  );
}

export interface SearchHudOverlayProps {
  visible: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  sources: Record<SearchHudSource, boolean>;
  onSourcesChange: Dispatch<SetStateAction<Record<SearchHudSource, boolean>>>;
  results: Track[];
  fallbackUsed?: boolean;
  providerStates: Record<SearchHudSource, SearchProviderState>;
  diagnostics?: SearchDiagnostics | null;
  isSearching: boolean;
  queuedTrackIds: string[];
  onClose: () => void;
  onPatchTrack: (track: Track) => void;
  onAddSuggestion?: (title: string, artist: string) => void;
  /** Connected services for library browsing (optional — hides Library tab if absent) */
  connectedServices?: ConnectedServices;
}

export function SearchHudOverlay({
  visible,
  query,
  onQueryChange,
  sources,
  onSourcesChange,
  results,
  fallbackUsed = false,
  providerStates,
  diagnostics,
  isSearching,
  queuedTrackIds,
  onClose,
  onPatchTrack,
  onAddSuggestion,
  connectedServices,
}: SearchHudOverlayProps) {
  const [hudTab, setHudTab] = useState<HudTab>('search');
  const [searchMode, setSearchMode] = useState<SearchMode>('database');
  const [patchedId, setPatchedId] = useState<string | null>(null);
  const activeSourceCount = Object.values(sources).filter(Boolean).length;

  // ─── Library tab (via shared hook) ─────────────────────────
  const library = useLibraryBrowse({
    connectedServices,
    enableCache: false, // in-session browsing doesn't need disk cache
  });
  const isDevRuntime = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

  const filtered = useMemo(() => {
    return results.filter((t) => {
      const key = getSourceKey(t);
      if (!key) return true;
      return sources[key];
    });
  }, [results, sources]);

  const providerIssues = useMemo(() => {
    if (!diagnostics || !query.trim()) {
      return [] as Array<{ source: SearchHudSource; message: string }>;
    }

    return (PROVIDER_ORDER)
      .filter((source) => sources[source] && diagnostics.providers[source].state === 'error')
      .map((source) => {
        const diagnostic = diagnostics.providers[source];
        let message = diagnostic.message || 'Search unavailable.';

        if (diagnostic.code === 'APP_SUBSCRIPTION_REQUIRED') {
          message = 'Spotify Development Mode is blocking search. The app owner account needs Premium, or the app needs Extended Access.';
        } else if (diagnostic.code === 'TOKEN_EXPIRED') {
          message = `${PROVIDER_META[source].label} token expired. Reconnect this provider.`;
        } else if (diagnostic.code === 'UPSTREAM_AUTH_ERROR' || diagnostic.code === 'ENDPOINT_AUTH_ERROR') {
          message = `${PROVIDER_META[source].label} rejected the stored auth during live search.`;
        } else if (diagnostic.code === 'BACKEND_CONFIG_MISSING') {
          message = `${PROVIDER_META[source].label} backend config is incomplete.`;
        } else if (diagnostic.code === 'NETWORK_ERROR') {
          message = `${PROVIDER_META[source].label} search could not reach the backend.`;
        }

        return { source, message };
      });
  }, [diagnostics, query, sources]);

  const getProviderStatusLabel = (key: SearchHudSource) => {
    if (!sources[key]) {
      return 'OFF';
    }

    if (!query.trim()) {
      if (providerStates[key] === 'unpatched') {
        return 'UNPATCHED';
      }
      if (providerStates[key] === 'error') {
        return 'UNAVAILABLE';
      }
      return diagnostics?.authSnapshot[key]?.connected ? 'CONNECTED' : 'READY';
    }

    if (providerStates[key] === 'unpatched') {
      return 'UNPATCHED';
    }

    if (providerStates[key] === 'off') {
      return 'READY';
    }

    const state = providerStates[key];
    if (state === 'direct') return 'DIRECT';
    if (state === 'empty') return 'NO MATCH';
    if (state === 'error') {
      const diagnosticCode = diagnostics?.providers[key]?.code;
      if (diagnosticCode === 'APP_SUBSCRIPTION_REQUIRED') return 'BLOCKED';
      if (diagnosticCode === 'TOKEN_EXPIRED') return 'RECONNECT';
      return 'UNAVAILABLE';
    }
    return 'READY';
  };

  useEffect(() => {
    if (!isDevRuntime || !query.trim() || searchMode !== 'database') {
      return;
    }

    console.log(`[SearchTruth][hud] ${JSON.stringify({
      query,
      renderedLabels: Object.fromEntries(PROVIDER_ORDER.map((k) => [k, getProviderStatusLabel(k)])),
      providerStates,
      diagnostics,
    })}`);
  }, [diagnostics, isDevRuntime, providerStates, query, searchMode, sources.spotify, sources.soundcloud, sources.tidal, sources.appleMusic]);

  const toggleSource = (key: SearchHudSource) => {
    onSourcesChange((prev) => ({ ...prev, [key]: !prev[key] }));
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
    const isOpenCatalog = item.resultOrigin === 'open' || getSourceKey(item) === null;
    const availabilitySources = getAvailabilitySources(item);
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
        accessibilityLabel={inQueue ? `${item.title} already in queue` : `Add ${item.title} by ${item.artist}`}
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

        <View style={styles.trackRail}>
          {availabilitySources.length > 0 || isOpenCatalog ? (
            <View style={styles.tagCluster}>
              {availabilitySources.map((availabilitySource) => {
                const meta = PROVIDER_META[availabilitySource];
                return (
                  <View
                    key={`${item.id}-${availabilitySource}`}
                    style={[styles.tagBadge, { borderColor: meta.color, backgroundColor: `${meta.color}10` }]}
                  >
                    <Text style={[styles.tagBadgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                );
              })}
              {isOpenCatalog ? (
                <View style={styles.originChip}>
                  <Text style={styles.originChipText}>OPEN</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.tagClusterSpacer} />
          )}
          <Text style={[styles.costText, styles.costTextActive]}>
            {inQueue ? 'IN QUEUE' : isPatched ? 'ADDED ✓' : 'ADD'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TacticalGridBackground opacity={0.12} />

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

          {/* Top-level HUD tab: SEARCH / LIBRARY */}
          <View style={styles.hudTabRow}>
            {(['search', 'library'] as const).map((tab) => {
              const active = hudTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setHudTab(tab)}
                  style={({ pressed }) => [
                    styles.hudTabBtn,
                    active && styles.hudTabBtnActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.hudTabText, active && styles.hudTabTextActive]}>
                    {tab.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ─── Library Tab Content ───────────────────── */}
          {hudTab === 'library' && (
            <View style={styles.libraryContent}>
              <ServiceSelectorPills
                connectedServices={library.connectedSources}
                selectedService={library.selectedService}
                onSelectService={library.selectService}
              />
              {library.connectedSources.length === 0 ? (
                <View style={styles.libraryEmpty}>
                  <Text style={styles.libraryEmptyText}>NO SERVICES CONNECTED</Text>
                  <Text style={styles.libraryEmptySubtext}>CONNECT A PROVIDER IN SETTINGS</Text>
                </View>
              ) : library.selectedPlaylist ? (
                <PlaylistTrackList
                  playlist={library.selectedPlaylist}
                  tracks={library.tracks}
                  loading={library.tracksLoading}
                  onTrackPress={onPatchTrack}
                  onBack={library.clearPlaylist}
                />
              ) : (
                <PlaylistList
                  playlists={library.playlists}
                  loading={library.playlistsLoading}
                  onSelectPlaylist={library.selectPlaylist}
                />
              )}
            </View>
          )}

          {/* ─── Search Tab Content ────────────────────── */}
          {hudTab === 'search' && (
          <>
          <View style={styles.inputZone}>
            <View style={styles.modeRow}>
              {([
                ['database', 'DATABASE'],
                ['oracle', 'ORACLE'],
              ] as const).map(([mode, label]) => {
                const active = searchMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setSearchMode(mode)}
                    style={({ pressed }) => [
                      styles.modeBtn,
                      active && styles.modeBtnActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {searchMode === 'database' ? (
              <>
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

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sourceRow}
                >
                  {PROVIDER_ORDER.map((key) => {
                    const meta = PROVIDER_META[key];
                    const active = sources[key];
                    // Tier 3 sources (currently just Spotify) carry a "BETA" chip
                    // so the Restricted Beta status reads up front, not after a
                    // failed search. Same single source of truth as the Library
                    // tab pills — getTierForSource from musicServiceAdapter.
                    const isRestrictedBeta = getTierForSource(key) === 3;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => toggleSource(key)}
                        style={({ pressed }) => [
                          styles.providerBtn,
                          styles.providerBtnLive,
                          active && { borderColor: meta.color, backgroundColor: `${meta.color}22` },
                          (providerStates[key] === 'error' ||
                            providerStates[key] === 'unpatched') &&
                            styles.providerBtnOffline,
                          pressed && styles.pressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isRestrictedBeta
                            ? `${meta.label} source filter, restricted beta`
                            : `${meta.label} source filter`
                        }
                      >
                        <View style={styles.providerBtnTop}>
                          <View
                            style={[
                              styles.sourceDot,
                              { backgroundColor: active ? meta.color : tacticalTokens.colors.textDim },
                            ]}
                          />
                          <Text style={[styles.sourceText, active && { color: meta.color }]}>
                            {`[ ${meta.label} ]`}
                          </Text>
                          {isRestrictedBeta && (
                            <View style={styles.tierBadge}>
                              <Text style={styles.tierBadgeText}>BETA</Text>
                            </View>
                          )}
                        </View>
                        <Text
                          style={[
                            styles.providerStateText,
                            (providerStates[key] === 'error' ||
                              providerStates[key] === 'unpatched') &&
                              styles.providerStateTextOffline,
                          ]}
                        >
                          {getProviderStatusLabel(key)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <View style={styles.oracleWrap}>
                <OracleModeCard
                  preferredSources={(Object.entries(sources) as Array<[SearchHudSource, boolean]>)
                    .filter(([, enabled]) => enabled)
                    .map(([source]) => source)}
                  onAddResolvedTrack={onPatchTrack}
                  onAddTrack={(title, artist) => {
                    onAddSuggestion?.(title, artist);
                  }}
                />
              </View>
            )}
          </View>

          {searchMode === 'database' && (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsLabel}>TOP RESULTS</Text>
              </View>

              {fallbackUsed && query.trim().length > 0 && filtered.length > 0 ? (
                <View style={styles.fallbackBanner}>
                  <Text style={styles.fallbackBannerText}>
                    {filtered.some((track) => track.resultOrigin === 'direct')
                      ? 'DIRECT + OPEN CATALOG RESULTS'
                      : 'OPEN CATALOG FALLBACK ACTIVE'}
                  </Text>
                </View>
              ) : null}

              {providerIssues.map((issue) => (
                <View key={issue.source} style={styles.issueBanner}>
                  <Text style={styles.issueBannerText}>{issue.message}</Text>
                </View>
              ))}

              {isDevRuntime && query.trim().length > 0 && diagnostics ? (
                <View style={styles.debugPanel}>
                  <Text style={styles.debugTitle}>TRUTH PATH</Text>
                  {PROVIDER_ORDER.map((source) => {
                    const providerDebug = diagnostics.providers[source];
                    return (
                      <Text key={source} style={styles.debugLine}>
                        {`${PROVIDER_META[source].label} CONN:${providerDebug.connected ? 'Y' : 'N'} HTTP:${providerDebug.httpStatus ?? '-'} UP:${providerDebug.upstreamStatus ?? '-'} STATE:${providerDebug.state.toUpperCase()} CODE:${providerDebug.code}`}
                      </Text>
                    );
                  })}
                </View>
              ) : null}

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
                      <Text style={styles.emptyText}>
                        {activeSourceCount === 0
                          ? 'TURN ON AT LEAST ONE MUSIC SOURCE ABOVE'
                          : 'NO MATCHES — TRY A DIFFERENT SEARCH'}
                      </Text>
                    </View>
                  }
                />
              )}
            </>
          )}
          </>
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
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  panel: {
    height: '90%',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: '#030303',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: tacticalTokens.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    backgroundColor: '#050505',
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
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.md,
    gap: tacticalTokens.spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
  },
  modeBtn: {
    flex: 1,
    minHeight: 38,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.white,
  },
  modeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.4,
  },
  modeTextActive: {
    color: tacticalTokens.colors.void,
  },
  searchBar: {
    minHeight: 48,
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
    gap: tacticalTokens.spacing.xs,
    paddingRight: tacticalTokens.spacing.sm,
  },
  providerBtn: {
    minHeight: 40,
    minWidth: 78,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.xs + 2,
    paddingVertical: tacticalTokens.spacing.xs - 1,
    justifyContent: 'center',
    gap: 2,
  },
  providerBtnLive: {
    backgroundColor: tacticalTokens.colors.matte,
  },
  providerBtnOffline: {
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  providerBtnTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tacticalTokens.spacing.xs,
  },
  sourceDot: {
    width: 5,
    height: 5,
  },
  sourceText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 9,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  providerStateText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 6.5,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  providerStateTextOffline: {
    color: tacticalTokens.colors.textDim,
  },
  resultsHeader: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xs + 2,
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
  fallbackBanner: {
    marginHorizontal: tacticalTokens.spacing.xl,
    marginBottom: tacticalTokens.spacing.xs + 2,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.xs + 2,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  fallbackBannerText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 8,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 0.9,
  },
  issueBanner: {
    marginHorizontal: tacticalTokens.spacing.xl,
    marginBottom: tacticalTokens.spacing.xs + 2,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.xs + 2,
    borderWidth: 1,
    borderColor: '#5C3024',
    backgroundColor: 'rgba(92, 48, 36, 0.26)',
  },
  issueBannerText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 8,
    color: '#F8C5B3',
    letterSpacing: 0.6,
  },
  debugPanel: {
    marginHorizontal: tacticalTokens.spacing.xl,
    marginBottom: tacticalTokens.spacing.xs + 2,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.xs + 2,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: '#060606',
    gap: 2,
  },
  debugTitle: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 8,
    color: tacticalTokens.colors.acid,
    letterSpacing: 1,
  },
  debugLine: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 7,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 0.6,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oracleWrap: {
    minHeight: 320,
  },
  results: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xl,
  },
  trackRow: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.xs - 1,
    gap: tacticalTokens.spacing.xs + 2,
    marginTop: tacticalTokens.spacing.xs + 1,
  },
  trackRowDisabled: {
    opacity: 0.55,
  },
  trackRowPatched: {
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: 'rgba(57, 255, 20, 0.10)',
  },
  trackArt: {
    width: 38,
    height: 38,
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
    fontSize: 11,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
  },
  trackArtist: {
    marginTop: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 7,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 0.4,
  },
  trackRail: {
    width: 72,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingVertical: 1,
  },
  tagCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 3,
    minHeight: 15,
  },
  tagClusterSpacer: {
    minHeight: 15,
  },
  tagBadge: {
    borderWidth: 1,
    minWidth: 20,
    paddingHorizontal: 3,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagBadgeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 6,
    letterSpacing: 0.7,
  },
  // ─── Tier 3 "Restricted Beta" status chip ──────────────────
  // Distinct from tagBadge above: tagBadge is a *data* chip (which
  // providers a track is on); tierBadge is a *status* chip (this
  // provider has restricted availability). Same monoBold font for
  // typographic cohesion within the tactical aesthetic, but rounded
  // corners + cross-app orange accent so the tier signal reads
  // independently of any per-provider brand color.
  tierBadge: {
    marginLeft: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: withAlpha(palette.orange, 0.45),
    backgroundColor: withAlpha(palette.orange, 0.18),
  },
  tierBadgeText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 8,
    letterSpacing: 0.6,
    color: palette.orange,
  },
  originChip: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
    minWidth: 24,
    paddingHorizontal: 3,
    paddingVertical: 1,
    alignItems: 'center',
  },
  originChipText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 5.5,
    letterSpacing: 0.6,
    color: tacticalTokens.colors.textMuted,
  },
  costText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 8,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 0.9,
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
    height: 72,
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

  // ─── HUD Tab Toggle (Search / Library) ─────
  hudTabRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.xs,
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.xs,
  },
  hudTabBtn: {
    flex: 1,
    minHeight: 34,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudTabBtnActive: {
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: 'rgba(90, 200, 200, 0.12)',
  },
  hudTabText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 11,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.6,
  },
  hudTabTextActive: {
    color: tacticalTokens.colors.ice,
  },

  // ─── Library Tab ──────────────────────────────
  libraryContent: {
    flex: 1,
    paddingTop: tacticalTokens.spacing.sm,
  },
  libraryEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tacticalTokens.spacing.xl * 2,
  },
  libraryEmptyText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 11,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 2,
  },
  libraryEmptySubtext: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 9,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1,
    marginTop: tacticalTokens.spacing.xs,
  },
});

export default SearchHudOverlay;
