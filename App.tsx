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
import { HardwareHandshakeProvider } from './src/components/effects/HardwareHandshakeProvider';

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
                   * HardwareHandshakeProvider mounts a fullscreen Modal
                   * overlay that fires on successful provider connect. The
                   * overlay is render-as-needed (null when idle), so the
                   * cost of mounting is negligible.
                   */}
                  <HardwareHandshakeProvider />
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
