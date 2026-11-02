/**
 * ConductorTestSection — Dev Panel harness for the conductor-mode spike.
 *
 * Answers two questions on a real phone before conductor mode (lane 2) is
 * built for real:
 *   1. Does the host's music app accept "play this song" from Frequen-C,
 *      and does it need to come to the foreground to do it?
 *   2. Can Frequen-C tell when a song ends (or the next one starts)?
 *
 * Every action and every now-playing event lands in one log the operator
 * can copy and paste back for review.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';
import { Conductor, MUSIC_APPS, type NowPlaying } from '../../../modules/frequenc-conductor';

const LOG_LIMIT = 60;
// A song "probably ended" when playback stops within this window of its
// duration. Spotify and YouTube Music report position in coarse steps.
const END_WINDOW_MS = 4000;
// Known Spotify track URI used to test link-based playback precisely.
const SPOTIFY_TEST_URI = 'spotify:track:4cOdK2wGLETKBW3PvgPWqT';

function stamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function shortPackage(packageName: string): string {
  const match = Object.entries(MUSIC_APPS).find(([, pkg]) => pkg === packageName);
  return match ? match[0] : packageName;
}

export function ConductorTestSection() {
  const [hasAccess, setHasAccess] = useState(false);
  const [query, setQuery] = useState('Mr. Brightside The Killers');
  const [log, setLog] = useState<string[]>([]);
  const lastByPackage = useRef<Record<string, NowPlaying>>({});

  const addLog = useCallback((line: string) => {
    setLog((prev) => [`${stamp()} ${line}`, ...prev].slice(0, LOG_LIMIT));
  }, []);

  const refreshAccess = useCallback(() => {
    if (!Conductor) return;
    const granted = Conductor.isNotificationAccessGranted();
    setHasAccess(granted);
    if (granted) Conductor.startWatching();
  }, []);

  // Re-check after the operator returns from the Android settings screen.
  useEffect(() => {
    refreshAccess();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshAccess();
    });
    return () => sub.remove();
  }, [refreshAccess]);

  useEffect(() => {
    if (!Conductor) return;
    const sub = Conductor.addListener('onNowPlayingChange', (event) => {
      const prev = lastByPackage.current[event.packageName];
      const app = shortPackage(event.packageName);
      const track = `${event.title ?? '?'} / ${event.artist ?? '?'}`;

      if (prev && event.title && prev.title !== event.title) {
        addLog(`NEW TRACK [${app}] ${track}`);
      }
      if (
        prev?.state === 'playing' &&
        (event.state === 'paused' || event.state === 'stopped') &&
        prev.durationMs &&
        prev.positionMs !== null &&
        prev.durationMs - prev.positionMs < END_WINDOW_MS
      ) {
        addLog(`ENDED? [${app}] stopped near the end of ${prev.title ?? 'track'}`);
      }
      const pos = event.positionMs !== null ? Math.round(event.positionMs / 1000) : '?';
      const dur = event.durationMs ? Math.round(event.durationMs / 1000) : '?';
      addLog(`event [${app}] ${event.state} ${pos}s/${dur}s ${track}`);
      lastByPackage.current[event.packageName] = event;
    });
    return () => sub.remove();
  }, [addLog]);

  const run = useCallback(async (label: string, action: () => Promise<unknown> | unknown) => {
    try {
      await action();
      addLog(`OK ${label}`);
    } catch (err) {
      addLog(`FAIL ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [addLog]);

  if (!Conductor) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>
          Conductor module isn't in this build. Install the 1.2.0 test APK or newer.
        </Text>
      </View>
    );
  }

  const installed = Object.entries(MUSIC_APPS)
    .filter(([, pkg]) => Conductor?.isPackageInstalled(pkg))
    .map(([name]) => name);

  const actions: Array<{ label: string; detail: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }> = [
    {
      label: 'GRANT NOW-PLAYING ACCESS',
      detail: 'Opens Android settings. Turn on "Frequen-C now playing", then come back.',
      icon: 'key-outline',
      onPress: () => run('open access settings', () => Conductor?.openNotificationAccessSettings()),
    },
    {
      label: 'PLAY IN SPOTIFY (LAUNCH)',
      detail: 'Search intent. Expect Spotify to open and start the song.',
      icon: 'play-outline',
      onPress: () => run(`spotify search "${query}"`, () => Conductor?.playFromSearch(query, null, null, MUSIC_APPS.spotify)),
    },
    {
      label: 'PLAY IN SPOTIFY (BACKGROUND)',
      detail: 'Same request to Spotify\'s session without opening it. Needs access and Spotify to have played once.',
      icon: 'play-forward-outline',
      onPress: () => run(`spotify background "${query}"`, () => Conductor?.controllerPlayFromSearch(query, MUSIC_APPS.spotify)),
    },
    {
      label: 'PLAY SPOTIFY LINK (BACKGROUND)',
      detail: 'Exact track by Spotify link through the session. Tests precise playback.',
      icon: 'link-outline',
      onPress: () => run('spotify uri background', () => Conductor?.controllerPlayFromUri(SPOTIFY_TEST_URI, MUSIC_APPS.spotify)),
    },
    {
      label: 'OPEN SPOTIFY LINK (LAUNCH)',
      detail: 'Opens the exact track in Spotify. Note whether it auto-plays.',
      icon: 'open-outline',
      onPress: () => run('spotify uri launch', () => Conductor?.openUri(SPOTIFY_TEST_URI, MUSIC_APPS.spotify)),
    },
    {
      label: 'PLAY IN YOUTUBE MUSIC (LAUNCH)',
      detail: 'Same search intent, sent to YouTube Music.',
      icon: 'logo-youtube',
      onPress: () => run(`ytm search "${query}"`, () => Conductor?.playFromSearch(query, null, null, MUSIC_APPS.youtubeMusic)),
    },
    {
      label: 'NEXT TRACK',
      detail: 'Skip in whatever app is playing. Watch for NEW TRACK in the log.',
      icon: 'play-skip-forward-outline',
      onPress: () => run('transport next', () => Conductor?.transport('next', null)),
    },
    {
      label: 'SNAPSHOT NOW PLAYING',
      detail: 'Logs every active music session right now.',
      icon: 'radio-outline',
      onPress: () => run('snapshot', () => {
        const sessions = Conductor?.getNowPlaying() ?? [];
        if (sessions.length === 0) addLog('snapshot: no active sessions (access missing or nothing playing)');
        sessions.forEach((s) => addLog(`snapshot [${shortPackage(s.packageName)}] ${s.state} ${s.title ?? '?'} / ${s.artist ?? '?'}`));
      }),
    },
  ];

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.key}>NOW-PLAYING ACCESS</Text>
          <Text style={[styles.value, hasAccess && styles.valueGood]}>{hasAccess ? 'GRANTED' : 'NOT GRANTED'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>MUSIC APPS FOUND</Text>
          <Text style={styles.value}>{installed.length ? installed.join(', ') : 'none'}</Text>
        </View>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Song and artist to test"
        placeholderTextColor={tacticalTokens.colors.textDim}
        style={styles.input}
        accessibilityLabel="Test song and artist"
      />

      {actions.map((action) => (
        <Pressable
          key={action.label}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <View style={styles.actionHeader}>
            <Ionicons name={action.icon} size={16} color={tacticalTokens.colors.acid} />
            <Text style={styles.actionLabel}>{action.label}</Text>
          </View>
          <Text style={styles.actionDetail}>{action.detail}</Text>
        </Pressable>
      ))}

      <View style={styles.logHeader}>
        <Text style={styles.key}>LOG (NEWEST FIRST)</Text>
        <Pressable
          onPress={() => {
            void Clipboard.setStringAsync(log.join('\n'));
            addLog('log copied to clipboard');
          }}
          accessibilityRole="button"
          accessibilityLabel="Copy conductor test log"
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Text style={styles.copyText}>COPY LOG</Text>
        </Pressable>
      </View>
      <View style={styles.logBox}>
        {log.length === 0 ? (
          <Text style={styles.logLine}>Nothing yet. Grant access, then try a play button.</Text>
        ) : (
          log.map((line, i) => (
            <Text key={`${i}-${line}`} style={styles.logLine}>{line}</Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matteGhost,
    padding: tacticalTokens.spacing.md,
    marginBottom: tacticalTokens.spacing.sm,
  },
  cardText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textMuted,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: tacticalTokens.spacing.sm,
  },
  key: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.white,
  },
  valueGood: {
    color: tacticalTokens.colors.acid,
  },
  input: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    color: tacticalTokens.colors.white,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.body,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.sm,
  },
  action: {
    marginBottom: tacticalTokens.spacing.sm,
    padding: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  actionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.acid,
    letterSpacing: 1.2,
  },
  actionDetail: {
    marginTop: 6,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    lineHeight: 16,
    color: tacticalTokens.colors.textSoft,
  },
  pressed: {
    opacity: 0.72,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tacticalTokens.spacing.md,
    marginBottom: tacticalTokens.spacing.sm,
  },
  copyButton: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.acid,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: 6,
  },
  copyText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.acid,
    letterSpacing: 1.2,
  },
  logBox: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matteGhost,
    padding: tacticalTokens.spacing.sm,
    minHeight: 120,
  },
  logLine: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    lineHeight: 16,
    color: tacticalTokens.colors.white,
  },
});

export default ConductorTestSection;
