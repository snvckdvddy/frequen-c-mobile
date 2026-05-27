/**
 * DevModeRoot — top-level mount for the dev panel UI.
 *
 * Renders two things, both gated on `devMode === true`:
 *   1. A small floating "DEV" tile (bottom-right, above safe area)
 *      that's visible on EVERY screen when dev mode is active
 *   2. The DevPanel Modal that opens when the tile is tapped
 *
 * When `devMode === false` (normal user state), this component
 * renders null — zero visual footprint, zero rendered work. The
 * cost of mounting is negligible.
 *
 * Why floating tile vs. menu in a specific screen:
 *   - Tap-to-test needs to work from anywhere (in a room, on home,
 *     in profile, mid-OAuth flow). A floating tile is the only
 *     placement that survives all navigation states.
 *   - Bottom-right is the conventional "secondary action" anchor
 *     and stays out of the way of primary content + the bottom
 *     tab bar above it.
 *
 * Activation/deactivation happens via useDevMode (storage-persisted)
 * — see ProfileScreen for the hidden tap-5-times gesture that flips
 * it on, and the DevPanel "Disable Dev Mode" action that flips it off.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDevMode } from '../../hooks/useDevMode';
import { tacticalTokens } from '../../features/session-v2/theme/tacticalTokens';
import { DevPanel } from './DevPanel';

export function DevModeRoot() {
  const { devMode, devModeReady } = useDevMode();
  const [panelOpen, setPanelOpen] = useState(false);

  // Don't render anything until we've hydrated devMode from storage,
  // then render nothing if the operator never enabled it.
  if (!devModeReady || !devMode) return null;

  return (
    <>
      <View pointerEvents="box-none" style={styles.anchor}>
        <Pressable
          onPress={() => setPanelOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open dev panel"
          hitSlop={8}
          style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
        >
          <Text style={styles.tileText}>DEV</Text>
        </Pressable>
      </View>
      <DevPanel visible={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  // Full-screen anchor with pointerEvents='box-none' lets touches pass
  // through to the underlying UI everywhere EXCEPT on the tile itself.
  anchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 96, // clear of bottom tab bar + safe area
    paddingRight: 12,
    zIndex: 9999,
  },
  tile: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: tacticalTokens.colors.acid,
    backgroundColor: 'rgba(12, 14, 20, 0.86)', // void at ~86% so screen content is faintly visible behind
  },
  tilePressed: {
    backgroundColor: tacticalTokens.colors.acid,
  },
  tileText: {
    fontFamily: tacticalTokens.fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: tacticalTokens.colors.acid,
  },
});

export default DevModeRoot;
