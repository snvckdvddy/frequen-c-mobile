import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ADSRTransition, SafeScreen, showToast } from '../components/ui';
import { VoidSurface } from '../design/components';
import { ManualPanel } from '../components/manual/ManualPanel';
import { joinSessionScreenManual, MANUAL_SCREEN_IDS } from '../content/manual';
import { useFirstTimeVisit } from '../hooks/useFirstTimeVisit';
import { QRScanner } from '../components/QRScanner';
import { useManualMode } from '../hooks/useManualMode';
import { sessionApi } from '../services/api';
import TacticalGridBackground from '../features/session-v2/components/TacticalGridBackground';
import { tacticalTokens } from '../features/session-v2/theme/tacticalTokens';
import { notifyError, notifyWarning, tapLight, tapMedium } from '../utils/haptics';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function JoinSessionScreen() {
  const navigation = useNavigation<{ replace: (screen: string, params: Record<string, string>) => void; goBack: () => void }>();
  const route = useRoute<RouteProp<{ JoinSession: { joinCode?: string } }, 'JoinSession'>>();
  const { readManual, manualReady } = useManualMode();
  const { autoShow: firstTimeAutoShow, dismiss: dismissFirstTime, ready: firstTimeReady } =
    useFirstTimeVisit(MANUAL_SCREEN_IDS.joinSession);
  const showManual = manualReady && firstTimeReady && (readManual || firstTimeAutoShow);
  const [code, setCode] = useState(route.params?.joinCode || '');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const normalizedCode = useMemo(() => code.trim().toUpperCase(), [code]);

  const handleJoin = useCallback(async (joinCode?: string) => {
    const finalCode = (joinCode || normalizedCode).trim().toUpperCase();
    if (!finalCode) {
      notifyWarning();
      setInlineError('ASK THE HOST FOR A ROOM CODE.');
      showToast('Enter a room code to patch in.', 'warning', '!');
      return;
    }

    tapMedium();
    setLoading(true);
    setInlineError(null);
    try {
      const { session } = await sessionApi.join(finalCode);
      navigation.replace('SessionRoom', { sessionId: session.id });
    } catch (err: unknown) {
      notifyError();
      // Surface the server's message when it has one — "That party has
      // ended." blames nobody, while the generic copy blamed the user
      // for typing a code that was valid an hour ago.
      const raw = err instanceof Error ? err.message : '';
      const message = (raw || 'Check the code and try again.').toUpperCase();
      setInlineError(message);
      showToast(raw || 'Signal not found. Check the join code.', 'error', '!');
    } finally {
      setLoading(false);
    }
  }, [navigation, normalizedCode]);

  const handleQRScanned = useCallback((scannedCode: string) => {
    setShowScanner(false);
    setCode(scannedCode.toUpperCase());
    void handleJoin(scannedCode);
  }, [handleJoin]);

  if (showScanner) {
    return <QRScanner onCodeScanned={handleQRScanned} onClose={() => setShowScanner(false)} />;
  }

  return (
    <ADSRTransition preset="modalReveal" slideFrom="bottom" slideDistance={30}>
      <SafeScreen>
        <VoidSurface style={{ flex: 1 }}>
          <View style={styles.screen}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <TacticalGridBackground opacity={0.58} />
            </View>

            <View style={styles.content}>
              <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                  <Text style={styles.eyebrow}>SYS.FREQ // JOIN BUS</Text>
                  <Text style={styles.title}>PATCH INTO ROOM</Text>
                  <Text style={styles.subtitle}>
                    Enter a room code or scan a tactical QR handoff to connect.
                  </Text>
                </View>
                <Pressable
                  onPress={() => navigation.goBack()}
                  accessibilityRole="button"
                  accessibilityLabel="Close join screen"
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close" size={20} color={tacticalTokens.colors.white} />
                </Pressable>
              </View>

              {showManual ? (
                <ManualPanel
                  {...joinSessionScreenManual}
                  variant="compact"
                  style={styles.manualRailInline}
                  onDismiss={!readManual ? dismissFirstTime : undefined}
                />
              ) : null}

              <View style={styles.panel}>
                <SectionLabel>JOIN CODE</SectionLabel>
                <View style={styles.inputFrame}>
                  <View style={styles.inputPrefix} />
                  <TextInput
                    style={styles.input}
                    placeholder="HDBNDJD"
                    placeholderTextColor={tacticalTokens.colors.textMuted}
                    value={code}
                    onChangeText={(text) => setCode(text.toUpperCase())}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    returnKeyType="go"
                    onSubmitEditing={() => void handleJoin()}
                    accessibilityLabel="Room join code"
                    selectionColor={tacticalTokens.colors.ice}
                  />
                </View>
                <Text style={styles.helperText}>
                  PATCH DIRECT WITH THE ROOM CODE. SCANNED CODES AUTO-ROUTE HERE.
                </Text>

                {inlineError ? (
                  <View style={styles.errorRail}>
                    <Ionicons name="alert-circle-outline" size={16} color={tacticalTokens.colors.orange} />
                    <Text style={styles.errorText}>{inlineError}</Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => void handleJoin()}
                    accessibilityRole="button"
                    accessibilityLabel="Patch into room"
                    disabled={loading}
                    style={({ pressed }) => [
                      styles.primaryAction,
                      loading && styles.disabledAction,
                      pressed && !loading && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryActionText}>{loading ? 'PATCHING...' : 'PATCH IN'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      tapLight();
                      setShowScanner(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Scan QR code"
                    style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
                  >
                    <Ionicons name="qr-code-outline" size={18} color={tacticalTokens.colors.ice} />
                    <Text style={styles.secondaryActionText}>SCAN QR</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.infoPanel}>
                <SectionLabel>SIGNAL NOTES</SectionLabel>
                <Text style={styles.infoLine}>JOIN CODES ARE CASE-INSENSITIVE BUT DISPLAY IN UPPERCASE.</Text>
                <Text style={styles.infoLine}>PRIVATE ROOMS REQUIRE THE EXACT HOST CODE OR QR HANDOFF.</Text>
              </View>
            </View>
          </View>
        </VoidSurface>
      </SafeScreen>
    </ADSRTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.lg,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.ice,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
  },
  subtitle: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
  },
  manualRailInline: {
    marginTop: -tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.sm,
  },
  panel: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(6, 6, 6, 0.92)',
    padding: tacticalTokens.spacing.lg,
  },
  sectionLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.8,
    marginBottom: tacticalTokens.spacing.sm,
  },
  inputFrame: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.white,
    backgroundColor: tacticalTokens.colors.void,
    paddingHorizontal: tacticalTokens.spacing.md,
  },
  inputPrefix: {
    width: 14,
    height: 30,
    backgroundColor: tacticalTokens.colors.white,
    marginRight: tacticalTokens.spacing.md,
  },
  input: {
    flex: 1,
    color: tacticalTokens.colors.white,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label + 4,
    letterSpacing: 1.4,
    paddingVertical: 0,
  },
  helperText: {
    marginTop: tacticalTokens.spacing.sm,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1.1,
    lineHeight: 16,
  },
  errorRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.md,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.orange,
    letterSpacing: 1,
  },
  actionRow: {
    gap: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.lg,
  },
  primaryAction: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: tacticalTokens.colors.orange,
  },
  primaryActionText: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.void,
    letterSpacing: 1.2,
  },
  secondaryAction: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#081218',
  },
  secondaryActionText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.micro,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.3,
  },
  infoPanel: {
    marginTop: tacticalTokens.spacing.lg,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: 'rgba(8, 8, 8, 0.78)',
    padding: tacticalTokens.spacing.md,
  },
  infoLine: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1.1,
    lineHeight: 18,
    marginBottom: tacticalTokens.spacing.xs,
  },
  disabledAction: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
});

export default JoinSessionScreen;
