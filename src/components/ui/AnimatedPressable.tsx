/**
 * AnimatedPressable — Touchable with scale feedback
 *
 * Drop-in replacement for TouchableOpacity that adds
 * a spring-based scale animation on press. Feels alive.
 */

import React, { useRef, useCallback } from 'react';
import {
  Animated, Pressable, ViewStyle, StyleProp,
  GestureResponderEvent, AccessibilityRole, AccessibilityState,
} from 'react-native';
import { tapLight } from '../../utils/haptics';

export interface AnimatedPressableProps {
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  scaleDown?: number; // How much to shrink (default 0.95)
  haptic?: boolean;   // Trigger haptic on press (default true)
  disabled?: boolean;
  children: React.ReactNode;
  // Accessibility
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
}

export function AnimatedPressable({
  onPress,
  onLongPress,
  style,
  scaleDown = 0.95,
  haptic = true,
  disabled = false,
  children,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleDown,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scale, scaleDown]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [scale]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (haptic) tapLight();
      onPress?.(event);
    },
    [haptic, onPress]
  );

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default AnimatedPressable;
