/**
 * Reaction Bar — 5-emoji fixed reaction set for session rooms.
 *
 * Convergence Strategy §3.3:
 * 🔥 Fire — "this track is heat"
 * ❤️ Heart — "love this"
 * 👏 Clap — "respect"
 * 😂 Laugh — "this is funny/wild"
 * 💀 Skull — "this killed me"
 *
 * 44pt height, 5 emoji buttons evenly spaced.
 * On tap: emoji floats upward from position and fades after 1.5s.
 */

import React, { useCallback, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';

type ReactionType = 'fire' | 'heart' | 'clap' | 'laugh' | 'skull';

interface ReactionBarProps {
  onReact: (type: ReactionType) => void;
  /** Optional: show counts next to each emoji */
  counts?: Partial<Record<ReactionType, number>>;
  /** Disable interaction (e.g., when not in a session) */
  disabled?: boolean;
}

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'fire', emoji: '🔥', label: 'Fire reaction' },
  { type: 'heart', emoji: '❤️', label: 'Heart reaction' },
  { type: 'clap', emoji: '👏', label: 'Clap reaction' },
  { type: 'laugh', emoji: '😂', label: 'Laugh reaction' },
  { type: 'skull', emoji: '💀', label: 'Skull reaction' },
];

function ReactionButton({
  emoji,
  label,
  count,
  onPress,
  disabled,
}: {
  emoji: string;
  label: string;
  count?: number;
  onPress: () => void;
  disabled?: boolean;
}) {
  // Scale animation on press
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Float animation for reaction feedback
  const floatY = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;

  const handlePress = useCallback(() => {
    if (disabled) return;

    // Button press scale
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.3, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    // Float-up feedback
    floatY.setValue(0);
    floatOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(floatY, { toValue: -60, duration: 1200, useNativeDriver: true }),
      Animated.timing(floatOpacity, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]).start();

    onPress();
  }, [disabled, scaleAnim, floatY, floatOpacity, onPress]);

  return (
    <View style={styles.reactionWrapper}>
      {/* Floating emoji feedback */}
      <Animated.View
        style={[
          styles.floatingEmoji,
          { transform: [{ translateY: floatY }, { scale: 1.2 }], opacity: floatOpacity },
        ]}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 24 }}>{emoji}</Text>
      </Animated.View>

      {/* Button */}
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.6}
        disabled={disabled}
        style={styles.reactionBtn}
        accessibilityRole="button"
        accessibilityLabel={count ? `${label}, ${count}` : label}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Text style={{ fontSize: 22 }}>{emoji}</Text>
        </Animated.View>
        {count !== undefined && count > 0 && (
          <Text variant="label" color={palette.silver} style={{ fontSize: 10 }}>
            {count}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export function ReactionBar({ onReact, counts, disabled = false }: ReactionBarProps) {
  return (
    <View style={styles.container}>
      {REACTIONS.map(({ type, emoji, label }) => (
        <ReactionButton
          key={type}
          emoji={emoji}
          label={label}
          count={counts?.[type]}
          onPress={() => onReact(type)}
          disabled={disabled}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 44,
    paddingHorizontal: 16,
  },
  reactionWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  reactionBtn: {
    width: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 1,
  },
  floatingEmoji: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
    zIndex: 10,
  },
});

export default ReactionBar;
