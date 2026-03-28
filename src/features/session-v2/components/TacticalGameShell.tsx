import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import TacticalGridBackground from './TacticalGridBackground';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalGameShellProps {
  eyebrow: string;
  title: string;
  status?: string;
  accentColor?: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export default function TacticalGameShell({
  eyebrow,
  title,
  status,
  accentColor = tacticalTokens.colors.acid,
  onClose,
  children,
  footer,
}: TacticalGameShellProps) {
  const { width, height } = useWindowDimensions();
  const compact = width <= 420 || height <= 780;

  return (
    <View style={[styles.overlay, compact && styles.overlayCompact]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close game overlay"
      />

      <View style={[styles.panel, compact && styles.panelCompact]}>
        <TacticalGridBackground opacity={0.1} />

        <View style={[styles.header, compact && styles.headerCompact]}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
          </View>

          <View style={styles.headerRight}>
            {status ? (
              <View style={[styles.statusBlock, compact && styles.statusBlockCompact, { borderColor: accentColor }]}>
                <Text style={[styles.statusText, compact && styles.statusTextCompact, { color: accentColor }]}>{status}</Text>
              </View>
            ) : null}

            {onClose ? (
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [styles.closeButton, compact && styles.closeButtonCompact, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Close game overlay"
              >
                <Ionicons name="close" size={18} color={tacticalTokens.colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.rule, compact && styles.ruleCompact, { backgroundColor: accentColor }]} />

        <View style={[styles.body, compact && styles.bodyCompact]}>{children}</View>

        {footer ? <View style={[styles.footer, compact && styles.footerCompact]}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingVertical: tacticalTokens.spacing.xxxl,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.86)',
  },
  overlayCompact: {
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.lg,
    justifyContent: 'flex-start',
  },
  panel: {
    minHeight: 420,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(0,0,0,0.96)',
    overflow: 'hidden',
  },
  panelCompact: {
    minHeight: 420,
    height: '92%',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.md,
    gap: tacticalTokens.spacing.md,
  },
  headerCompact: {
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.sm,
    gap: tacticalTokens.spacing.sm,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: tacticalTokens.spacing.xs,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.textMuted,
    letterSpacing: 1.8,
  },
  title: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
  },
  titleCompact: {
    fontSize: tacticalTokens.fontSize.display - 2,
    lineHeight: tacticalTokens.fontSize.display + 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  statusBlock: {
    minWidth: 74,
    height: 54,
    paddingHorizontal: tacticalTokens.spacing.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.void,
  },
  statusBlockCompact: {
    minWidth: 70,
    height: 50,
  },
  statusText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.label,
    letterSpacing: 1.2,
  },
  statusTextCompact: {
    fontSize: tacticalTokens.fontSize.label,
  },
  closeButton: {
    width: 54,
    height: 54,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonCompact: {
    width: 50,
    height: 50,
  },
  rule: {
    height: 1,
    marginHorizontal: tacticalTokens.spacing.xl,
  },
  ruleCompact: {
    marginHorizontal: tacticalTokens.spacing.lg,
  },
  body: {
    flex: 1,
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.lg,
  },
  bodyCompact: {
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.lg,
  },
  footer: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingBottom: tacticalTokens.spacing.xl,
  },
  footerCompact: {
    paddingHorizontal: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.lg,
  },
  pressed: {
    opacity: 0.84,
  },
});
