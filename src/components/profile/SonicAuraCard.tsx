import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aiApi, type SonicAuraInput, type SonicAuraResult } from '../../services/api';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';
import { notifyError, notifySuccess, tapLight, tapMedium } from '../../utils/haptics';

interface Props {
  roomsHosted: number;
  duelWinRate: number;
  topArtists: string[];
}

function MonoText(props: { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text {...props} />;
}

export function SonicAuraCard({ roomsHosted, duelWinRate, topArtists }: Props) {
  const [aura, setAura] = useState<SonicAuraResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  const generate = async () => {
    if (loading) return;
    tapMedium();
    setLoading(true);
    setError(null);
    try {
      const input: SonicAuraInput = { roomsHosted, duelWinRate, topArtists };
      const result = await aiApi.sonicAura(input);
      setAura(result);
      notifySuccess();
      fade.setValue(0);
      Animated.spring(fade, { toValue: 1, useNativeDriver: true }).start();
    } catch (err: unknown) {
      notifyError();
      setError(err instanceof Error ? err.message : 'AURA READING UNAVAILABLE');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <MonoText style={[styles.mono, styles.eyebrow]}>SYS.FREQ // ORACLE BUS</MonoText>
          <MonoText style={[styles.display, styles.title]}>SONIC AURA</MonoText>
        </View>
        <View style={styles.badge}>
          <Ionicons name="sparkles-outline" size={14} color={tacticalTokens.colors.ice} />
        </View>
      </View>

      {!aura && !loading ? (
        <Pressable onPress={() => void generate()} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <MonoText style={[styles.monoBold, styles.ctaText]}>READ PROFILE AURA</MonoText>
        </Pressable>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={tacticalTokens.colors.ice} />
          <MonoText style={[styles.mono, styles.loadingCopy]}>ANALYZING SIGNAL HISTORY...</MonoText>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorRail}>
          <Ionicons name="warning-outline" size={16} color={tacticalTokens.colors.orange} />
          <MonoText style={[styles.mono, styles.errorText]}>{error.toUpperCase()}</MonoText>
        </View>
      ) : null}

      {aura ? (
        <Animated.View style={[styles.result, { opacity: fade }]}>
          <View style={styles.resultBadge}>
            <MonoText style={[styles.monoBold, styles.resultName]}>{aura.auraName.toUpperCase()}</MonoText>
          </View>
          <MonoText style={[styles.mono, styles.resultCopy]}>{aura.reading}</MonoText>
          <Pressable onPress={() => { tapLight(); void generate(); }} style={({ pressed }) => [styles.regen, pressed && styles.pressed]}>
            <MonoText style={[styles.monoBold, styles.regenText]}>RE-RUN ORACLE</MonoText>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    padding: 16,
  },
  mono: { fontFamily: tacticalTokens.fonts.mono },
  monoBold: { fontFamily: tacticalTokens.fonts.monoBold },
  display: { fontFamily: tacticalTokens.fonts.display },
  pressed: { opacity: 0.82 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    color: tacticalTokens.colors.ice,
    letterSpacing: 2,
  },
  title: {
    marginTop: 2,
    fontSize: 24,
    color: tacticalTokens.colors.white,
  },
  badge: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#04161A',
    alignItems: 'center',
    paddingVertical: 12,
  },
  ctaText: {
    fontSize: 12,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.8,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  loadingCopy: {
    fontSize: 10,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.3,
  },
  errorRail: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 10,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.2,
  },
  result: {
    marginTop: 16,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#04161A',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resultName: {
    fontSize: 12,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.6,
  },
  resultCopy: {
    marginTop: 12,
    fontSize: 12,
    color: tacticalTokens.colors.textSoft,
    lineHeight: 22,
    letterSpacing: 0.6,
  },
  regen: {
    marginTop: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.matte,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  regenText: {
    fontSize: 10,
    color: tacticalTokens.colors.white,
    letterSpacing: 1.4,
  },
});

export default SonicAuraCard;
