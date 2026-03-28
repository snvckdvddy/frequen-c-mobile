import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeScreen } from '../components/ui';
import { VoidSurface } from '../design/components';
import { useAuth } from '../contexts/AuthContext';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';

interface WelcomeBootScreenProps {
  onContinue: () => void;
}

function MonoText(props: { children: React.ReactNode; style?: any; numberOfLines?: number }) {
  return <Text {...props} />;
}

function LogLine({
  text,
  tone = 'muted',
}: {
  text: string;
  tone?: 'muted' | 'success' | 'guide';
}) {
  return (
    <View style={styles.logLine}>
      <MonoText style={styles.logPrefix}>&gt;</MonoText>
      <MonoText
        style={[
          styles.logText,
          tone === 'success' && styles.logTextSuccess,
          tone === 'guide' && styles.logTextGuide,
        ]}
      >
        {text}
      </MonoText>
    </View>
  );
}

export function WelcomeBootScreen({ onContinue }: WelcomeBootScreenProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'boot' | 'duel'>('boot');

  const handleCode = useMemo(() => {
    const normalized = (user?.username || 'FREQ')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return normalized.slice(0, 2).padEnd(2, 'X').split('');
  }, [user?.username]);
  const frequencyCode = useMemo(
    () => [handleCode[0] || '', handleCode[1] || '', '—', ''],
    [handleCode],
  );
  const activeCodeIndex = 2;

  const userTag = (user?.username || 'NEW_NODE').toUpperCase().replace(/\s+/g, '_');
  const bootActive = activeTab === 'boot';
  const bootLines = useMemo(
    () => [
      { text: 'ESTABLISHING SECURE HANDSHAKE...', tone: 'muted' as const },
      { text: 'CONNECTED TO AUDIO NODE 04', tone: 'success' as const },
      { text: 'VERIFYING USER TOKENS...', tone: 'muted' as const },
      { text: `AUTH VALID (${userTag})`, tone: 'success' as const },
      { text: 'AWAITING FREQUENCY OVERRIDE...', tone: 'muted' as const },
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
    if (!bootActive || typingDone) return;
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
    }, lineComplete ? 170 : 18);

    return () => clearTimeout(timeout);
  }, [bootActive, bootLines, typingCharCount, typingDone, typingLineIndex]);

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
            <TacticalGridBackground opacity={0.58} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.devBar}>
              <Pressable
                onPress={() => setActiveTab('boot')}
                accessibilityRole="button"
                accessibilityLabel="Show initiate boot onboarding"
                style={({ pressed }) => [
                  styles.devButton,
                  bootActive && styles.devButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <MonoText style={[styles.devButtonText, bootActive && styles.devButtonTextActive]}>
                  [ INITIATE BOOT ]
                </MonoText>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('duel')}
                accessibilityRole="button"
                accessibilityLabel="Show crossfader duel preview"
                style={({ pressed }) => [
                  styles.devButton,
                  !bootActive && styles.devButtonActive,
                  pressed && styles.pressed,
                ]}
              >
                <MonoText style={[styles.devButtonText, !bootActive && styles.devButtonTextActive]}>
                  [ CROSSFADER DUEL ]
                </MonoText>
              </Pressable>
            </View>

            <View style={styles.terminal}>
              {bootActive ? (
                <>
                  <View style={styles.terminalHeader}>
                    <MonoText style={styles.terminalTitle}>SYS_BOOT</MonoText>
                    <MonoText style={styles.terminalStatus}>AWAITING INPUT_</MonoText>
                  </View>

                  <Pressable
                    onPress={typingDone ? undefined : revealAllBootLines}
                    disabled={typingDone}
                    style={({ pressed }) => [styles.logArea, pressed && !typingDone && styles.pressed]}
                  >
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
                </>
                ) : (
                <>
                  <View style={styles.terminalHeader}>
                    <MonoText style={styles.terminalTitle}>SIGNAL_DUEL</MonoText>
                    <MonoText style={styles.terminalStatus}>HOLDING_PATTERN_</MonoText>
                  </View>

                  <View style={styles.duelTeaser}>
                    <MonoText style={styles.duelEyebrow}>WORLD BUILDING // MODE PREVIEW</MonoText>
                    <MonoText style={styles.duelTitle}>CROSSFADER DUEL</MonoText>
                    <MonoText style={styles.duelCopy}>
                      A live head-to-head vote battle where the room drags a shared crossfader toward the track it wants to keep.
                    </MonoText>
                    <MonoText style={styles.duelCopyMuted}>
                      Not active in this onboarding slice yet. Patch into Home Grid first, then return when the mode comes online.
                    </MonoText>
                  </View>
                </>
              )}

              <View style={styles.inputZone}>
                {bootActive ? (
                  <>
                    <MonoText style={styles.inputLabel}>YOUR FREQUENCY CODE:</MonoText>
                    <View style={styles.codeRow}>
                      {frequencyCode.map((character, index) => (
                        <View
                          key={`${character}-${index}`}
                          style={[
                            styles.codeBox,
                            index === activeCodeIndex && styles.codeBoxActive,
                          ]}
                        >
                          <MonoText
                            style={[
                              styles.codeText,
                              character === '—' && styles.codeTextPlaceholder,
                              !character && styles.codeTextEmpty,
                            ]}
                          >
                            {character}
                          </MonoText>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.summaryRail} />
                )}

                <Pressable
                  onPress={onContinue}
                  accessibilityRole="button"
                  accessibilityLabel="Patch into the app"
                  style={({ pressed }) => [styles.patchButton, pressed && styles.pressed]}
                >
                  <MonoText style={styles.patchButtonText}>PATCH IN</MonoText>
                </Pressable>
              </View>
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
  },
  devBar: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.xs,
    marginBottom: tacticalTokens.spacing.sm,
  },
  devButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: tacticalTokens.spacing.sm,
  },
  devButtonActive: {
    backgroundColor: tacticalTokens.colors.white,
    borderColor: tacticalTokens.colors.white,
  },
  devButtonText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.2,
  },
  devButtonTextActive: {
    color: tacticalTokens.colors.void,
  },
  terminal: {
    flex: 1,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.lg,
    minHeight: 748,
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    paddingBottom: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.lg,
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
  logArea: {
    minHeight: 430,
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
  logTextGuide: {
    color: tacticalTokens.colors.guide,
  },
  duelTeaser: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
    minHeight: 232,
  },
  duelEyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 9,
    color: tacticalTokens.colors.guide,
    letterSpacing: 1.3,
  },
  duelTitle: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.title - 2,
    color: tacticalTokens.colors.white,
  },
  duelCopy: {
    marginTop: tacticalTokens.spacing.md,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    lineHeight: 17,
    letterSpacing: 1,
  },
  duelCopyMuted: {
    marginTop: tacticalTokens.spacing.md,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    lineHeight: 17,
    letterSpacing: 1,
  },
  inputZone: {
    marginTop: 'auto',
    paddingTop: tacticalTokens.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderGhost,
    borderStyle: 'dashed',
  },
  summaryRail: {
    minHeight: 116,
    marginBottom: tacticalTokens.spacing.lg,
  },
  inputLabel: {
    marginBottom: tacticalTokens.spacing.sm,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.4,
  },
  codeRow: {
    flexDirection: 'row',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.xl,
  },
  codeBox: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxActive: {
    borderColor: tacticalTokens.colors.ice,
    shadowColor: tacticalTokens.colors.ice,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  codeText: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: 26,
    color: tacticalTokens.colors.white,
  },
  codeTextPlaceholder: {
    color: tacticalTokens.colors.ice,
  },
  codeTextEmpty: {
    color: 'transparent',
  },
  patchButton: {
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.ice,
    marginBottom: 0,
  },
  patchButtonText: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label + 4,
    color: tacticalTokens.colors.void,
  },
  pressed: {
    opacity: 0.82,
  },
});
