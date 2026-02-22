/**
 * App Navigation — Convergence Strategy §1.1, §5
 *
 * 4-tab layout: Home | Discover | [+] Create | Library
 * Profile accessed via header avatar (not a tab).
 * Center Create button opens CreateSession modal.
 *
 * Replaces the previous 3-tab jargon layout (Patch Bay | Flight Cases | Profile).
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, LinkingOptions, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { useAuth } from '../contexts/AuthContext';
import { onNotificationResponse, getInitialNotification } from '../services/notifications';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Text } from '../components/ui';

// Screens
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { CreateSessionScreen } from '../screens/CreateSessionScreen';
import { JoinSessionScreen } from '../screens/JoinSessionScreen';
import { SessionRoomScreen } from '../screens/SessionRoomScreen';
import { FlightCasesScreen } from '../screens/FlightCasesScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

// ─── Types ──────────────────────────────────────────────────

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type MainStackParamList = {
  Tabs: undefined;
  CreateSession: undefined;
  JoinSession: { joinCode?: string } | undefined;
  SessionRoom: { sessionId: string };
  Profile: undefined;
};

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Create: undefined;     // Placeholder — intercepted by listener, opens modal
  Library: undefined;
};

// ─── Navigators ─────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ─── Create Button (center tab) ─────────────────────────────

/**
 * Elevated center button per Convergence Strategy §1.1:
 * "Create — Elevated CTA (floating circle or distinct icon)"
 * 44×44pt circular, palette.ice bg, void icon.
 */
function CreateTabButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={createBtnStyles.container}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Create a new session"
    >
      <View style={createBtnStyles.button}>
        <Ionicons name="add" size={24} color={colors.bg.primary} />
      </View>
    </TouchableOpacity>
  );
}

const createBtnStyles = StyleSheet.create({
  container: {
    top: -12, // Elevate above tab bar
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Glow
    shadowColor: colors.action.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});

// ─── Placeholder screen for the Create tab (never rendered) ──
function CreatePlaceholder() {
  return <View style={{ flex: 1, backgroundColor: colors.bg.primary }} />;
}

// ─── Tab Navigator ──────────────────────────────────────────

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        // §7: 200ms ease-in-out cross-fade on tab switch
        animation: 'fade',
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderTopColor: colors.border.default,      // Dark steel divider — §1.1
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.action.primary,  // ice cyan — §1.3
        tabBarInactiveTintColor: colors.text.muted,    // slate — §8
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily,
          fontSize: 10,                                // §1.9: Micro 10pt
          fontWeight: typography.weight.medium,
          letterSpacing: 0.5,
        },
      }}
    >
      {/* Tab 1: Home — Your rooms, recent activity */}
      <Tab.Screen
        name="Home"
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <ErrorBoundary screenName="Home">
            <HomeScreen
              onCreateSession={() => props.navigation.getParent()?.navigate('CreateSession')}
              onJoinSession={() => props.navigation.getParent()?.navigate('JoinSession')}
              onOpenRoom={(sessionId: string) =>
                props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
              }
              onOpenProfile={() => props.navigation.getParent()?.navigate('Profile')}
            />
          </ErrorBoundary>
        )}
      </Tab.Screen>

      {/* Tab 2: Discover — Browse public rooms, trending, genre filters */}
      <Tab.Screen
        name="Discover"
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'compass' : 'compass-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <ErrorBoundary screenName="Discover">
            <DiscoverScreen
              onOpenRoom={(sessionId: string) =>
                props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
              }
            />
          </ErrorBoundary>
        )}
      </Tab.Screen>

      {/* Tab 3: Create — Center elevated button (opens modal, no screen) */}
      <Tab.Screen
        name="Create"
        component={CreatePlaceholder}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <CreateTabButton
              onPress={() => {
                // Navigate to CreateSession modal via parent stack
                // We need to access the parent navigator
              }}
            />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Prevent navigating to the Create tab screen
            e.preventDefault();
            // Open CreateSession modal instead
            navigation.getParent()?.navigate('CreateSession');
          },
        })}
      />

      {/* Tab 4: Library — Saved tracks, session history, collections */}
      <Tab.Screen
        name="Library"
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name={focused ? 'library' : 'library-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      >
        {(props) => (
          <ErrorBoundary screenName="Library">
            <FlightCasesScreen
              onOpenRoom={(sessionId: string) =>
                props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
              }
            />
          </ErrorBoundary>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ─── Auth Navigator ─────────────────────────────────────────

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{ headerShown: false, animation: 'fade' }}
    >
      <AuthStack.Screen name="Login">
        {(props) => (
          <LoginScreen onSwitchToRegister={() => props.navigation.navigate('Register')} />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register">
        {(props) => (
          <RegisterScreen onSwitchToLogin={() => props.navigation.navigate('Login')} />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

// ─── Main Navigator ─────────────────────────────────────────

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <MainStack.Screen name="Tabs" component={TabNavigator} />
      <MainStack.Screen
        name="CreateSession"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {() => (
          <ErrorBoundary screenName="CreateSession">
            <CreateSessionScreen />
          </ErrorBoundary>
        )}
      </MainStack.Screen>
      <MainStack.Screen
        name="JoinSession"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {() => (
          <ErrorBoundary screenName="JoinSession">
            <JoinSessionScreen />
          </ErrorBoundary>
        )}
      </MainStack.Screen>
      <MainStack.Screen name="SessionRoom">
        {() => (
          <ErrorBoundary screenName="SessionRoom">
            <SessionRoomScreen />
          </ErrorBoundary>
        )}
      </MainStack.Screen>
      <MainStack.Screen
        name="Profile"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      >
        {() => (
          <ErrorBoundary screenName="Profile:Modal">
            <ProfileScreen />
          </ErrorBoundary>
        )}
      </MainStack.Screen>
    </MainStack.Navigator>
  );
}

// ─── Deep Linking ──────────────────────────────────────────

const prefix = Linking.createURL('/');

const linking: LinkingOptions<MainStackParamList> = {
  prefixes: [prefix, 'frequenc://'],
  config: {
    screens: {
      JoinSession: {
        path: 'join/:joinCode',
      },
      SessionRoom: {
        path: 'room/:sessionId',
      },
      Tabs: {
        path: '',
      },
    },
  },
};

// ─── Root ───────────────────────────────────────────────────

export function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<MainStackParamList>>(null);

  // Wire notification tap → navigate to session room
  useEffect(() => {
    if (!isAuthenticated) return;

    // Handle notification taps while app is running
    const unsubscribe = onNotificationResponse((sessionId) => {
      navigationRef.current?.navigate('SessionRoom', { sessionId });
    });

    // Handle cold-start from notification tap
    getInitialNotification().then((sessionId) => {
      if (sessionId) {
        // Small delay to let navigator mount
        setTimeout(() => {
          navigationRef.current?.navigate('SessionRoom', { sessionId });
        }, 500);
      }
    });

    return unsubscribe;
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text variant="label" color={colors.text.muted}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} linking={isAuthenticated ? linking : undefined}>
        {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
  },
});

export default AppNavigator;
