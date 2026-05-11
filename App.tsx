/**
 * Frequen-C Mobile — App Root
 *
 * Wraps ErrorBoundary → AuthProvider → AppNavigator.
 */

import React from 'react';
import { StyleSheet, StatusBar, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { ActiveSessionProvider } from './src/contexts/ActiveSessionContext';
import { FavoritesProvider } from './src/contexts/FavoritesContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme/colors';
import { ToastProvider } from './src/components/ui';
import { useDesignFonts } from './src/design/loadFonts';

import { GlobalSessionRoomProvider } from './src/contexts/GlobalSessionRoomContext';
import { HapticHandshakeProvider } from './src/components/effects/HapticHandshakeProvider';
// HardwareHandshakeProvider intentionally NOT mounted — see comment near
// usage block below for rationale (2026-05-11).

export default function App() {
  const [fontsLoaded, fontError] = useDesignFonts();

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.action.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.app}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />
      <ErrorBoundary>
        <AuthProvider>
          <ActiveSessionProvider>
            <GlobalSessionRoomProvider>
              <FavoritesProvider>
                <ThemeProvider>
                  <AppNavigator />
                  <ToastProvider />
                  {/*
                   * HardwareHandshakeProvider DELIBERATELY NOT MOUNTED
                   * (2026-05-11). It rendered a fullscreen opaque overlay
                   * for ~4 seconds after every successful provider connect.
                   * Even with pointerEvents="none", the visual obscured the
                   * screen so the user could not see what they were touching
                   * — functionally a 4-second freeze right after PATCH.
                   * Caleb's UX feedback: "i don't like the screen being
                   * frozen at all personally." The component, the bus, and
                   * the animation code all stay in the codebase — only this
                   * mount line was removed. To re-enable for a specific
                   * scenario (e.g. first-ever-connect celebration), import
                   * and remount here.
                   *
                   * HapticHandshakeProvider stays mounted. It also
                   * subscribes to handshakeBus.fire() but only fires
                   * 80-120ms haptic pulses (iOS only, no-op on Android).
                   * Zero perceived freeze cost.
                   */}
                  <HapticHandshakeProvider />
                </ThemeProvider>
              </FavoritesProvider>
            </GlobalSessionRoomProvider>
          </ActiveSessionProvider>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
