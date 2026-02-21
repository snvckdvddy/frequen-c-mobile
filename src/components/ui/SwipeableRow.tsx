/**
 * SwipeableRow — Swipe-left-to-reveal delete action.
 *
 * Convergence Strategy §5.1:
 * Swipe left on queue item → Reveal remove action (Source: Spotify, TIDAL)
 *
 * Uses react-native-gesture-handler Swipeable for native-level
 * gesture handling with proper interop with FlatList.
 */

import React, { useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface SwipeableRowProps {
  children: React.ReactNode;
  /** Called when user confirms the swipe-to-remove action */
  onRemove: () => void;
  /** Whether swipe is enabled (e.g. disabled for now-playing track) */
  enabled?: boolean;
}

export function SwipeableRow({ children, onRemove, enabled = true }: SwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  if (!enabled) {
    return <>{children}</>;
  }

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    // Scale the delete button as user drags
    const scale = dragX.interpolate({
      inputRange: [-100, -50, 0],
      outputRange: [1, 0.8, 0.5],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-80, -40, 0],
      outputRange: [1, 0.6, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.rightAction, { opacity }]}>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => {
            swipeableRef.current?.close();
            onRemove();
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Remove from queue"
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="trash-outline" size={22} color={colors.text.primary} />
            <Text variant="labelSmall" color={colors.text.primary} style={styles.removeLabel}>
              Remove
            </Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  rightAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  removeBtn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.action.destructive,
    width: 80,
    borderTopRightRadius: spacing.radius.md,
    borderBottomRightRadius: spacing.radius.md,
  },
  removeLabel: {
    marginTop: 2,
  },
});

export default SwipeableRow;
