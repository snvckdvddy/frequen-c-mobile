import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { tacticalTokens } from '../session-v2/theme/tacticalTokens';

export type PowerMoveId = 'phantom_power' | 'phase_cancel' | 'overdrive';

export interface PowerMove {
  id: PowerMoveId;
  name: string;
  cost: number;
  description: string;
  variant: 'acid' | 'ice' | 'hotPink';
  disabled?: boolean;
}

const DEFAULT_MOVES: PowerMove[] = [
  {
    id: 'phantom_power',
    name: 'PHANTOM_PWR',
    cost: 5,
    description: 'Inject +5 votes to a track. Help a shy friend survive Open Floor.',
    variant: 'acid',
  },
  {
    id: 'phase_cancel',
    name: 'PHASE_CANCEL',
    cost: 15,
    description: 'Block the next skip attempt. Guarantee your track plays.',
    variant: 'ice',
  },
  {
    id: 'overdrive',
    name: 'OVERDRIVE',
    cost: 25,
    description: 'Force your track to the top of the queue. High risk, high heat.',
    variant: 'hotPink',
  },
];

function getVariantColors(variant: PowerMove['variant']) {
  switch (variant) {
    case 'acid':
      return { accent: tacticalTokens.colors.acid, bg: 'rgba(57, 255, 20, 0.10)' };
    case 'ice':
      return { accent: tacticalTokens.colors.ice, bg: 'rgba(0, 229, 255, 0.10)' };
    case 'hotPink':
      return { accent: tacticalTokens.colors.hotPink, bg: 'rgba(255, 45, 85, 0.12)' };
  }
}

export interface PowerRoutingSheetProps {
  visible: boolean;
  voltage: number;
  onClose: () => void;
  onExecute?: (moveId: PowerMoveId) => void;
  moves?: PowerMove[];
}

export function PowerRoutingSheet({
  visible,
  voltage,
  onClose,
  onExecute,
  moves = DEFAULT_MOVES,
}: PowerRoutingSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.topRule} />
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>POWER ROUTING</Text>
              <Text style={styles.headerVoltage}>{String(voltage).padStart(3, '0')}V</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Text style={styles.closeGlyph}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.content}>
            {moves.map((move) => {
              const c = getVariantColors(move.variant);
              const canAfford = voltage >= move.cost;
              const isDisabled = move.disabled || !canAfford;
              return (
                <View
                  key={move.id}
                  style={[
                    styles.move,
                    move.id === 'overdrive' && styles.moveOverdrive,
                    isDisabled && styles.moveDisabled,
                    { borderColor: move.id === 'overdrive' ? c.accent : tacticalTokens.colors.border },
                  ]}
                >
                  <View style={[styles.costBox, { borderColor: c.accent, backgroundColor: c.bg }]}>
                    <Text style={[styles.costText, { color: c.accent }]}>-{String(move.cost).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.moveBody}>
                    <Text style={[styles.moveName, { color: c.accent }]}>{move.name}</Text>
                    <Text style={styles.moveDesc}>{move.description}</Text>
                  </View>
                  <Pressable
                    onPress={() => onExecute?.(move.id)}
                    disabled={isDisabled}
                    style={({ pressed }) => [
                      styles.execBtn,
                      { backgroundColor: isDisabled ? '#1A1A1A' : c.accent },
                      pressed && !isDisabled && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Execute ${move.name}`}
                    accessibilityState={{ disabled: isDisabled }}
                  >
                    <Text style={[styles.execText, { color: isDisabled ? tacticalTokens.colors.textDim : tacticalTokens.colors.void }]}>
                      EXEC
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: tacticalTokens.colors.overlay,
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    height: '75%',
    backgroundColor: tacticalTokens.colors.void,
    borderTopWidth: 2,
    borderTopColor: tacticalTokens.colors.ice,
  },
  topRule: {
    height: 0,
  },
  header: {
    paddingHorizontal: tacticalTokens.spacing.xl,
    paddingVertical: tacticalTokens.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: tacticalTokens.colors.border,
    backgroundColor: '#0A0A0A',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: 14,
    color: tacticalTokens.colors.white,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headerVoltage: {
    marginTop: 6,
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 32,
    color: tacticalTokens.colors.ice,
    letterSpacing: 1.2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.void,
    borderRadius: tacticalTokens.radius.sharp,
  },
  closeGlyph: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 18,
    color: tacticalTokens.colors.textDim,
  },
  content: {
    padding: tacticalTokens.spacing.xl,
    gap: tacticalTokens.spacing.md,
  },
  move: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tacticalTokens.colors.matte,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.border,
    padding: tacticalTokens.spacing.lg,
    gap: tacticalTokens.spacing.lg,
    overflow: 'hidden',
  },
  moveOverdrive: {
    borderLeftWidth: 6,
    borderLeftColor: tacticalTokens.colors.hotPink,
  },
  moveDisabled: {
    opacity: 0.52,
  },
  costBox: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tacticalTokens.colors.void,
  },
  costText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 14,
  },
  moveBody: {
    flex: 1,
    minWidth: 0,
  },
  moveName: {
    fontFamily: tacticalTokens.fonts.display,
    fontSize: 16,
    letterSpacing: 0.8,
  },
  moveDesc: {
    marginTop: 4,
    fontFamily: tacticalTokens.fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: tacticalTokens.colors.textDim,
    letterSpacing: 0.6,
  },
  execBtn: {
    minWidth: 56,
    paddingHorizontal: tacticalTokens.spacing.md,
    paddingVertical: tacticalTokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tacticalTokens.radius.sharp,
  },
  execText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
});

export default PowerRoutingSheet;
