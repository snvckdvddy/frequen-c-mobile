import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TacticalGridBackground from './TacticalGridBackground';
import { tacticalTokens } from '../theme/tacticalTokens';

interface TacticalActionPromptAction {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: 'default' | 'danger';
}

interface TacticalActionPromptProps {
  visible: boolean;
  eyebrow: string;
  title: string;
  description: string;
  onClose: () => void;
  actions: TacticalActionPromptAction[];
}

export function TacticalActionPrompt({
  visible,
  eyebrow,
  title,
  description,
  onClose,
  actions,
}: TacticalActionPromptProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close action prompt"
        />
        <View style={styles.sheet}>
          <TacticalGridBackground opacity={0.84} />
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close prompt"
                style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              >
                <Ionicons name="close" size={18} color={tacticalTokens.colors.white} />
              </Pressable>
            </View>

            <View style={styles.actionList}>
              {actions.map((action) => {
                const danger = action.tone === 'danger';
                return (
                  <Pressable
                    key={action.label}
                    onPress={action.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    accessibilityHint={action.description}
                    style={({ pressed }) => [
                      styles.actionButton,
                      danger && styles.actionButtonDanger,
                      pressed && styles.actionPressed,
                    ]}
                  >
                    <View style={styles.actionHeader}>
                      <Ionicons
                        name={action.icon}
                        size={18}
                        color={danger ? tacticalTokens.colors.orange : tacticalTokens.colors.acid}
                      />
                      <Text style={[styles.actionLabel, danger && styles.actionLabelDanger]}>
                        {action.label}
                      </Text>
                    </View>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </Pressable>
                );
              })}
            </View>
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
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  sheet: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingTop: tacticalTokens.spacing.lg,
    paddingBottom: tacticalTokens.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tacticalTokens.spacing.sm,
    marginBottom: tacticalTokens.spacing.lg,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 2,
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.display,
    color: tacticalTokens.colors.white,
  },
  description: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 22,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: tacticalTokens.colors.void,
  },
  closeButtonPressed: {
    borderColor: tacticalTokens.colors.ice,
    backgroundColor: '#141414',
  },
  actionList: {
    gap: tacticalTokens.spacing.sm,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
  },
  actionButtonDanger: {
    borderColor: tacticalTokens.colors.orange,
    backgroundColor: '#1A120D',
  },
  actionPressed: {
    opacity: 0.82,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tacticalTokens.spacing.sm,
  },
  actionLabel: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: tacticalTokens.fontSize.label,
    color: tacticalTokens.colors.white,
  },
  actionLabelDanger: {
    color: tacticalTokens.colors.orange,
  },
  actionDescription: {
    marginTop: tacticalTokens.spacing.xs,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: tacticalTokens.fontSize.sys,
    color: tacticalTokens.colors.textSoft,
    letterSpacing: 1,
    lineHeight: 20,
  },
});

export default TacticalActionPrompt;
