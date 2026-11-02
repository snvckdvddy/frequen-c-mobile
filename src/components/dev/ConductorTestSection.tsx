/**
 * ConductorTestSection — Dev Panel harness for the conductor-mode spike.
 *
 * Answers two questions on a real phone before conductor mode (lane 2) is
 * built for real:
 *   1. Does the host's music app accept "play this song" from Frequen-C,
 *      and does it need to come to the foreground to do it?
 *   2. Can Frequen-C tell when a song ends (or the next one starts)?
 *
 * Two logs, because the first device run showed Spotify firing dozens of
 * near-identical session updates per second, which flushed the button
 * results out of a single shared log:
 *   - RESULTS: button outcomes, app-switch detection, what actually played,
 *     track changes and likely song ends. Never flooded.
 *   - EVENTS: the raw session stream, with identical repeats collapsed into
 *     one line and a count.
 * COPY LOG copies both.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';
import { Conductor, MUSIC_APPS, type NowPlaying } from '../../../modules/frequenc-conductor';

const RESULTS_LIMIT = 80;
const EVENTS_LIMIT = 120;
// A song "probably ended" when playback stops within this window of its
// duration. Spotify and YouTube Music report position in coarse steps.
const END_WINDOW_MS = 4000;
// How long after a play command the next new title counts as its result.
const PLAY_RESULT_WINDOW_MS = 15000;
// Known Spotify track URI used to test link-based playback precisely.
const SPOTIFY_TEST_URI = 'spotify:track:4cOdK2wGLETKBW3PvgPWqT';

interface EventLine {
  signature: string;
  text: string;
  count: number;
}

function stamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function shortPackage(packageName: string): string {
  const match = Object.entries(MUSIC_APPS).find(([, pkg]) => pkg === packageName);
  return match ? match[0] : packageName;
}

// Position is bucketed to 2s so steady progress still collapses while a
// real seek or restart shows up as a new line.
function signatureOf(event: NowPlaying): string {
  const bucket = event.positionMs !== null ? Math.floor(event.positionMs / 2000) : -1;
  return [event.packageName, event.state, event.title, event.artist, event.durationMs, bucket].join('|');
}

export function ConductorTestSection() {
  const [hasAccess, setHasAccess] = useState(false);
  const [query, setQuery] = useState('Mr. Brightside The Killers');
  const [results, setResults] = useState<string[]>([]);
  const [events, setEvents] = useState<EventLine[]>([]);
  const lastByPackage = useRef<Record<string, NowPlaying>>({});
  // The most recent play command, so the next new title can be reported
  // as its result (and compared with what was asked for).
  const pendingPlay = useRef<{ label: string; asked: string; at: number } | null>(null);

  const addResult = useCallback((line: string) => {
    setResults((prev) => [`${stamp()} ${line}`, ...prev].slice(0, RESULTS_LIMIT));
  }, []);

  const addEvent = useCallback((signature: string, text: string) => {
    setEvents((prev) => {
      if (prev[0]?.signature === signature) {
        return [{ ...prev[0], count: prev[0].count + 1 }, ...prev.slice(1)];
      }
      return [{ signature, text: `${stamp()} ${text}`, count: 1 }, ...prev].slice(0, EVENTS_LIMIT);
    });
  }, []);

  const refreshAccess = useCallback(() => {
    if (!Conductor) return;
    const granted = Conductor.isNotificationAccessGranted();
    setHasAccess(granted);
    if (granted) Conductor.startWatching();
  }, []);

  // Foreground tracking answers "did the music app have to come to the
  // front?": if Frequen-C goes to the background right after a play
  // button, the command launched the other app.
  useEffect(() => {
    refreshAccess();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') addResult('APP SWITCH: Frequen-C went to the background');
      if (next === 'active') {
        addResult('Frequen-C is back in front');
        refreshAccess();
      }
    });
    return () => sub.remove();
  }, [refreshAccess, addResult]);

  useEffect(() => {
    if (!Conductor) return;
    const sub = Conductor.addListener('onNowPlayingChange', (event) => {
      const prev = lastByPackage.current[event.packageName];
      const app = shortPackage(event.packageName);
      const track = `${event.title ?? '?'} / ${event.artist ?? '?'}`;

      if (event.title && prev?.title !== event.title) {
        const pending = pendingPlay.current;
        if (pending && Date.now() - pending.at < PLAY_RESULT_WINDOW_MS) {
          addResult(`PLAYED [${app}] "${event.title}" after ${pending.label} (asked for: ${pending.asked})`);
          pendingPlay.current = null;
        } else if (prev) {
          addResult(`NEW TRACK [${app}] ${track}`);
        }
      }
      if (
        prev?.state === 'playing' &&
        (event.state === 'paused' || event.state === 'stopped') &&
        prev.durationMs &&
        prev.positionMs !== null &&
        prev.durationMs - prev.positionMs < END_WINDOW_MS
      ) {
        addResult(`ENDED? [${app}] stopped near the end of ${prev.title ?? 'track'}`);
      }
      if (prev?.state === 'playing' && event.state === 'paused' && prev.title === event.title) {
        const at = event.positionMs !== null ? Math.round(event.positionMs / 1000) : '?';
        addResult(`PAUSED [${app}] at ${at}s`);
      }

      const pos = event.positionMs !== null ? Math.round(event.positionMs / 1000) : '?';
      const dur = event.durationMs ? Math.round(event.durationMs / 1000) : '?';
      addEvent(signatureOf(event), `[${app}] ${event.state} ${pos}s/${dur}s ${track}`);
      lastByPackage.current[event.packageName] = event;
    });
    return () => sub.remove();
  }, [addResult, addEvent]);

  const run = useCallback(async (label: string, action: () => Promise<unknown> | unknown, asked?: string) => {
    if (asked) pendingPlay.current = { label, asked, at: Date.now() };
    try {
      await action();
      addResult(`OK ${label}`);
    } catch (err) {
      addResult(`FAIL ${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [addResult]);

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
      onPress: () => run('spotify launch-search', () => Conductor?.playFromSearch(query, null, null, MUSIC_APPS.spotify), query),
    },
    {
      label: 'PLAY IN SPOTIFY (BACKGROUND)',
      detail: 'Same request to Spotify\'s session without opening it. Needs access and Spotify to have played once.',
      icon: 'play-forward-outline',
      onPress: () => run('spotify background-search', () => Conductor?.controllerPlayFromSearch(query, MUSIC_APPS.spotify), query),
    },
    {
      label: 'PLAY SPOTIFY LINK (BACKGROUND)',
      detail: 'Exact track by Spotify link through the session. Tests precise playback.',
      icon: 'link-outline',
      onPress: () => run('spotify background-link', () => Conductor?.controllerPlayFromUri(SPOTIFY_TEST_URI, MUSIC_APPS.spotify), 'Never Gonna Give You Up (link)'),
    },
    {
      label: 'OPEN SPOTIFY LINK (LAUNCH)',
      detail: 'Opens the exact track in Spotify. Note whether it auto-plays.',
      icon: 'open-outline',
      onPress: () => run('spotify launch-link', () => Conductor?.openUri(SPOTIFY_TEST_URI, MUSIC_APPS.spotify), 'Never Gonna Give You Up (link)'),
    },
    {
      label: 'PLAY IN YOUTUBE MUSIC (LAUNCH)',
      detail: 'Same search intent, sent to YouTube Music.',
      icon: 'logo-youtube',
      onPress: () => run('ytm launch-search', () => Conductor?.playFromSearch(query, null, null, MUSIC_APPS.youtubeMusic), query),
    },
    {
      label: 'NEXT TRACK',
      detail: 'Skip in whatever app is playing. Watch for NEW TRACK in results.',
      icon: 'play-skip-forward-outline',
      onPress: () => run('transport next', () => Conductor?.transport('next', null)),
    },
    {
      label: 'SNAPSHOT NOW PLAYING',
      detail: 'Logs every active music session right now.',
      icon: 'radio-outline',
      onPress: () => run('snapshot', () => {
        const sessions = Conductor?.getNowPlaying() ?? [];
        if (sessions.length === 0) addResult('snapshot: no active sessions (access missing or nothing playing)');
        sessions.forEach((s) => addResult(`snapshot [${shortPackage(s.packageName)}] ${s.state} ${s.title ?? '?'} / ${s.artist ?? '?'}`));
      }),
    },
  ];

  const copyAll = () => {
    const eventLines = events.map((e) => (e.count > 1 ? `${e.text} (x${e.count})` : e.text));
    const text = ['RESULTS (newest first)', ...results, '', 'EVENTS (newest first)', ...eventLines].join('\n');
    void Clipboard.setStringAsync(text);
    addResult('log copied to clipboard');
  };

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
        <Text style={styles.key}>RESULTS (NEWEST FIRST)</Text>
        <Pressable
          onPress={copyAll}
          accessibilityRole="button"
          accessibilityLabel="Copy conductor test log"
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
        >
          <Text style={styles.copyText}>COPY LOG</Text>
        </Pressable>
      </View>
      <View style={styles.logBox}>
        {results.length === 0 ? (
          <Text style={styles.logLine}>Nothing yet. Grant access, then try a play button.</Text>
        ) : (
          results.map((line, i) => (
            <Text key={`${i}-${line}`} style={styles.logLine}>{line}</Text>
          ))
        )}
      </View>

      <Text style={[styles.key, styles.eventsLabel]}>EVENTS (REPEATS COLLAPSED)</Text>
      <View style={styles.logBox}>
        {events.length === 0 ? (
          <Text style={styles.logLine}>No session events yet.</Text>
        ) : (
          events.slice(0, 30).map((e, i) => (
            <Text key={`${i}-${e.text}`} style={styles.logLineQuiet}>
              {e.count > 1 ? `${e.text} (x${e.count})` : e.text}
            </Text>
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
  eventsLabel: {
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
    minHeight: 80,
  },
  logLine: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    lineHeight: 16,
    color: tacticalTokens.colors.white,
  },
  logLineQuiet: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    lineHeight: 16,
    color: tacticalTokens.colors.textSoft,
  },
});

export default ConductorTestSection;
