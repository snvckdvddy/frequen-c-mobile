/**
 * ConnectionBanner — Socket health status bar.
 *
 * Shows at the top of the session room when the connection
 * is lost, reconnecting, or has an error. Auto-hides when
 * connected. Includes a manual retry button.
 *
 * Styled like a signal indicator — fits the radio/audio theme.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Text } from './ui';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useSocketHealth } from '../hooks/useSocketHealth';
import { reconnectSocket } from '../services/socket';

export function ConnectionBanner() {
  const { status, lastError, reconnectAttempt, isConnected } = useSocketHealth();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Show/hide animation
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isConnected, slideAnim]);

  // Pulse animation when reconnecting
  useEffect(() => {
    if (status === 'reconnecting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  if (isConnected) return null;

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 0],
  });

  const message = status === 'reconnecting'
    ? `Signal lost — reconnecting${reconnectAttempt > 0 ? ` (${reconnectAttempt}/15)` : '...'}`
    : lastError || 'Connection lost';

  const showRetry = status === 'disconnected';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <Animated.View style={[styles.inner, { opacity: pulseAnim }]}>
        {/* Signal indicator dot */}
        <View style={[styles.dot, showRetry ? styles.dotDead : styles.dotReconnecting]} />

        <Text variant="labelSmall" color={colors.text.primary} style={styles.message} numberOfLines={1}>
          {message}
        </Text>

        {showRetry && (
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => reconnectSocket()}
            accessibilityRole="button"
            accessibilityLabel="Retry connection"
          >
            <Text variant="labelSmall" color={colors.action.primary}>
              RETRY
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.screenPadding,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 59, 48, 0.2)',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotReconnecting: {
    backgroundColor: '#FF9500', // amber
  },
  dotDead: {
    backgroundColor: '#FF3B30', // red
  },
  message: {
    flex: 1,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.action.primary + '40',
  },
});

export default ConnectionBanner;
