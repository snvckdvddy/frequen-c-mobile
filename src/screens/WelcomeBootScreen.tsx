/**
 * WelcomeBootScreen
 *
 * Shown ONCE after a successful registration (gated by the in-memory
 * `welcomeBootState` flag set by RegisterScreen). Returning users on
 * subsequent app launches go straight to Tabs — they don't see this.
 *
 * Purpose: first-impression brand moment + concrete next-action prompt.
 * Earlier versions of this screen had decorative-only "FREQUENCY CODE"
 * boxes that looked tappable but weren't, plus a "CROSSFADER DUEL" tab
 * that previewed an unbuilt feature, plus an "AWAITING FREQUENCY
 * OVERRIDE..." log line that was a literal lie. All cut. The boot
 * terminal aesthetic is preserved (3 trimmed log lines) because that's
 * the brand identity, but it's now flanked by real onboarding content
 * with two clear CTAs.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { SafeScreen } from '../components/ui';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface WelcomeBootScreenProps {
  /** Primary action — navigate to Profile so the user can patch a music service. */
  onConnectService: () => void;
  /** Secondary action — drop the user on HomeScreen to browse live rooms. */
  onBrowseRooms: () => void;
}

function MonoText(props: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text {...props} />;
}

function LogLine({
  text,
  tone = 'muted',
}: {
  text: string;
  tone?: 'muted' | 'success';
}) {
  return (
    <View style={styles.logLine}>
      <MonoText style={styles.logPrefix}>&gt;</MonoText>
      <MonoText
        style={[
          styles.logText,
          tone === 'success' && styles.logTextSuccess,
        ]}
      >
        {text}
      </MonoText>
    </View>
  );
}

export function WelcomeBootScreen({ onConnectService, onBrowseRooms }: WelcomeBootScreenProps) {
  const { user } = useAuth();

  const userTag = useMemo(
    () => (user?.username || 'NEW_NODE').toUpperCase().replace(/\s+/g, '_'),
    [user?.username],
  );

  // Boot log: 3 lines instead of the prior 5. The trimmed set keeps the
  // brand-aesthetic moment without padding the user's first-impression
  // with fake status text. The "READY" close-out is the natural handoff
  // to the welcome content below.
  const bootLines = useMemo(
    () => [
      { text: 'ESTABLISHING SECURE HANDSHAKE...', tone: 'muted' as const },
      { text: `AUTH VALID (${userTag})`, tone: 'success' as const },
      { text: 'READY', tone: 'success' as const },
    ],
    [userTag],
  );

  const [typingLineIndex, setTypingLineIndex] = useState(0);
  const [typingCharCount, setTypingCharCount] = useState(0);
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    setTypingLineIndex(0);
    setTypingCharCount(0);
    setTypingDone(false);
  }, [userTag]);

  useEffect(() => {
    if (typingDone) return;
    const currentLine = bootLines[typingLineIndex];
    if (!currentLine) {
      setTypingDone(true);
      return;
    }

    const lineComplete = typingCharCount >= currentLine.text.length;
    const timeout = setTimeout(() => {
      if (!lineComplete) {
        setTypingCharCount((count) => count + 1);
        return;
      }
      if (typingLineIndex >= bootLines.length - 1) {
        setTypingDone(true);
        return;
      }
      setTypingLineIndex((index) => index + 1);
      setTypingCharCount(0);
    }, lineComplete ? 140 : 14);

    return () => clearTimeout(timeout);
  }, [bootLines, typingCharCount, typingDone, typingLineIndex]);

  const revealAllBootLines = () => {
    setTypingLineIndex(bootLines.length - 1);
    setTypingCharCount(bootLines[bootLines.length - 1]?.text.length ?? 0);
    setTypingDone(true);
  };

  return (
    <SafeScreen>
      <VoidSurface style={{ flex: 1 }}>
        <View style={styles.screen}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <TacticalGridBackground opacity={0.45} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Boot terminal — brand-aesthetic moment. Tap to skip the
                typing animation if it's still in progress. */}
            <Pressable
              onPress={typingDone ? undefined : revealAllBootLines}
              disabled={typingDone}
              accessibilityRole="button"
              accessibilityLabel={typingDone ? 'Boot sequence complete' : 'Skip boot sequence'}
              style={({ pressed }) => [
                styles.terminal,
                pressed && !typingDone && styles.pressed,
              ]}
            >
              <View style={styles.terminalHeader}>
                <MonoText style={styles.terminalTitle}>SYS_BOOT</MonoText>
                <MonoText style={styles.terminalStatus}>
                  {typingDone ? 'AUTH OK_' : 'BOOTING_'}
                </MonoText>
              </View>

              <View style={styles.logStack}>
                {bootLines.map((line, index) => {
                  if (typingDone || index < typingLineIndex) {
                    return <LogLine key={line.text} text={line.text} tone={line.tone} />;
                  }
                  if (index > typingLineIndex) {
                    return null;
                  }
                  const visibleText = line.text.slice(0, typingCharCount);
                  return (
                    <LogLine
                      key={line.text}
                      text={`${visibleText}${typingDone ? '' : '_'}`}
                      tone={line.tone}
                    />
                  );
                })}
              </View>
            </Pressable>

            {/* Welcome content — the actual onboarding payload. */}
            <View style={styles.welcomeCard}>
              <MonoText style={styles.welcomeEyebrow}>SYS.FREQ // ONLINE</MonoText>
              <View accessibilityRole="header">
                <MonoText style={styles.welcomeTitle}>WELCOME, {userTag}</MonoText>
              </View>
              <MonoText style={styles.welcomeBody}>
                Frequen-C is a collaborative music room. Connect a service to
                queue tracks together, or jump into a room someone&apos;s
                already hosting.
              </MonoText>
            </View>

            {/* Two clear CTAs — primary "connect" path, secondary "browse" path.
                Both are persistent until the user picks one (no auto-skip). */}
            <View style={styles.actions}>
              <Pressable
                onPress={onConnectService}
                accessibilityRole="button"
                accessibilityLabel="Connect a music service"
                style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
              >
                <MonoText style={styles.primaryActionText}>CONNECT A SERVICE</MonoText>
              </Pressable>

              <Pressable
                onPress={onBrowseRooms}
                accessibilityRole="button"
                accessibilityLabel="Browse live rooms"
                style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
              >
                <MonoText style={styles.secondaryActionText}>BROWSE ROOMS</MonoText>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </VoidSurface>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.xl,
    gap: tacticalTokens.spacing.lg,
  },

  // Boot terminal — preserved brand aesthetic, slimmer footprint
  terminal: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.md,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    paddingBottom: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: tacticalTokens.colors.ice,
  },
  terminalTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.ice,
  },
  terminalStatus: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.acid,
    letterSpacing: 1.4,
  },
  logStack: {
    gap: tacticalTokens.spacing.xs,
  },
  logLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tacticalTokens.spacing.sm,
  },
  logPrefix: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    lineHeight: 20,
  },
  logText: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textMuted,
    lineHeight: 19,
    letterSpacing: 1.1,
  },
  logTextSuccess: {
    color: tacticalTokens.colors.acid,
  },

  // Welcome card — the human-readable handoff
  welcomeCard: {
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingTop: tacticalTokens.spacing.lg,
  },
  welcomeEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.6,
    marginBottom: tacticalTokens.spacing.sm,
  },
  welcomeTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
    marginBottom: tacticalTokens.spacing.md,
  },
  welcomeBody: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    lineHeight: 22,
    letterSpacing: 0.8,
  },

  // Action stack — primary then secondary
  actions: {
    gap: tacticalTokens.spacing.sm,
    marginTop: 'auto',
    paddingTop: tacticalTokens.spacing.lg,
  },
  primaryAction: {
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.ice,
  },
  primaryActionText: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label + 4,
    color: tacticalTokens.colors.void,
    letterSpacing: 1.2,
  },
  secondaryAction: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  secondaryActionText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.4,
  },

  pressed: {
    opacity: 0.7,
  },
});
