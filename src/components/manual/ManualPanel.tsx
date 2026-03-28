import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle, useWindowDimensions } from 'react-native';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';

interface ManualStep {
  tag: string;
  text: string;
}

interface ManualCallout {
  label: string;
  value: string;
}

interface ManualPanelProps {
  title: string;
  subtitle?: string;
  steps: ManualStep[];
  accent?: string;
  footer?: string;
  callouts?: ManualCallout[];
  contextLabel?: string;
  variant?: 'hero' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export function ManualPanel({
  title,
  subtitle,
  steps,
  accent = tacticalTokens.colors.guide,
  footer,
  callouts,
  contextLabel = 'MANUAL // ACTIVE',
  variant = 'hero',
  style,
}: ManualPanelProps) {
  const { width } = useWindowDimensions();
  const compact = variant === 'compact';
  const singleColumnCallouts = compact || width < 420;

  return (
    <View style={[styles.panel, compact && styles.panelCompact, { borderColor: accent }, style]}>
      <View style={[styles.topRule, { backgroundColor: accent }]} />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={[styles.eyebrow, { color: accent }]}>{contextLabel}</Text>
          <View style={[styles.statusChip, { borderColor: accent }]}>
            <Text style={[styles.statusChipText, { color: accent }]}>GUIDED</Text>
          </View>
        </View>
        <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text> : null}
      </View>

      <View style={[styles.stepStack, compact && styles.stepStackCompact]}>
        {steps.map((step) => (
          <View key={`${step.tag}-${step.text}`} style={[styles.stepRow, compact && styles.stepRowCompact]}>
            <View style={[styles.stepTick, { backgroundColor: accent }]} />
            <View style={[styles.stepTag, compact && styles.stepTagCompact, { borderColor: accent }]}>
              <Text style={[styles.stepTagText, { color: accent }]}>{step.tag}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepText, compact && styles.stepTextCompact]}>{step.text}</Text>
            </View>
          </View>
        ))}
      </View>

      {callouts?.length ? (
        <View
          style={[
            styles.calloutGrid,
            compact && styles.calloutGridCompact,
            singleColumnCallouts && styles.calloutGridSingle,
          ]}
        >
          {callouts.map((callout) => (
            <View
              key={`${callout.label}-${callout.value}`}
              style={[
                styles.calloutCard,
                singleColumnCallouts && styles.calloutCardSingle,
                { borderColor: accent },
              ]}
            >
              <View style={styles.calloutHeader}>
                <View style={[styles.calloutDot, { backgroundColor: accent }]} />
                <Text style={[styles.calloutLabel, { color: accent }]}>{callout.label}</Text>
              </View>
              <Text style={[styles.calloutValue, compact && styles.calloutValueCompact]}>{callout.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {footer ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{footer}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    padding: tacticalTokens.spacing.lg,
    marginBottom: tacticalTokens.spacing.lg,
    overflow: 'hidden',
  },
  panelCompact: {
    padding: tacticalTokens.spacing.md,
    marginBottom: tacticalTokens.spacing.md,
  },
  topRule: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  header: {
    marginBottom: tacticalTokens.spacing.md,
    paddingBottom: tacticalTokens.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.borderGhost,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 2,
  },
  statusChip: {
    minHeight: 26,
    paddingHorizontal: tacticalTokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.matte,
  },
  statusChipText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.3,
  },
  title: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  titleCompact: {
    fontSize: tacticalTokens.fontSize.body,
  },
  subtitle: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  subtitleCompact: {
    lineHeight: 17,
  },
  stepStack: {
    gap: tacticalTokens.spacing.sm,
  },
  stepStackCompact: {
    gap: tacticalTokens.spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tacticalTokens.spacing.sm,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.sm,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.borderGhost,
    backgroundColor: tacticalTokens.colors.matteGhost,
  },
  stepRowCompact: {
    paddingVertical: tacticalTokens.spacing.xs,
  },
  stepTick: {
    width: 3,
    alignSelf: 'stretch',
  },
  stepBody: {
    flex: 1,
    paddingTop: 2,
  },
  stepTag: {
    minWidth: 54,
    minHeight: 28,
    paddingHorizontal: tacticalTokens.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.matte,
  },
  stepTagCompact: {
    minWidth: 48,
  },
  stepTagText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.2,
  },
  stepText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.small,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1,
    lineHeight: 18,
  },
  stepTextCompact: {
    lineHeight: 17,
  },
  calloutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tacticalTokens.spacing.sm,
    marginTop: tacticalTokens.spacing.md,
  },
  calloutGridCompact: {
    marginTop: tacticalTokens.spacing.sm,
  },
  calloutGridSingle: {
    flexDirection: 'column',
  },
  calloutCard: {
    minWidth: 112,
    flexGrow: 1,
    borderWidth: 1,
    backgroundColor: tacticalTokens.colors.matteGhost,
    paddingHorizontal: tacticalTokens.spacing.sm,
    paddingVertical: tacticalTokens.spacing.sm,
  },
  calloutCardSingle: {
    width: '100%',
    minWidth: 0,
    flexGrow: 0,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.xs,
  },
  calloutDot: {
    width: 6,
    height: 6,
  },
  calloutLabel: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: tacticalTokens.fontSize.sys,
    letterSpacing: 1.3,
  },
  calloutValue: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1,
    lineHeight: 17,
  },
  calloutValueCompact: {
    color: tacticalTokens.colors.guideSoft,
  },
  footer: {
    marginTop: tacticalTokens.spacing.md,
    paddingTop: tacticalTokens.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: tacticalTokens.colors.borderGhost,
  },
  footerText: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.guideSoft,
    letterSpacing: 1.1,
  },
});

export default ManualPanel;
