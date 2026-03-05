/**
 * OfflineBanner — Network status indicator.
 *
 * Shows a slim banner at the top of the screen when the device is offline.
 * Uses NetInfo to detect connectivity changes. Renders nothing when online.
 *
 * Usage:
 *   <OfflineBanner />   // Place above ScrollView/FlatList in any screen
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { palette } from '../../design/tokens/materials';
import { spacing } from '../../theme/spacing';

// Lightweight offline detection using RN's built-in fetch.
// For production, swap with @react-native-community/netinfo.
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        // Lightweight connectivity probe — HEAD to a tiny public resource
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (mounted) setIsOnline(true);
      } catch {
        if (mounted) setIsOnline(false);
      }
    };

    check();
    const interval = setInterval(check, 30000); // Re-check every 30s
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return isOnline;
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <View style={styles.container} accessibilityRole="alert" accessibilityLabel="You are offline">
      <Ionicons name="cloud-offline-outline" size={14} color={palette.amber} />
      <Text variant="labelSmall" color={palette.amber} style={styles.text}>
        NO SIGNAL — OFFLINE MODE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 179, 71, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: spacing.screenPadding,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 179, 71, 0.15)',
  },
  text: {
    fontSize: 10,
    letterSpacing: 1.5,
  },
});

export default OfflineBanner;
