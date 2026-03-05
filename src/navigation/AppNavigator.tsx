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
import { createBottomTabNavigator, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { useAuth } from '../contexts/AuthContext';
import { onNotificationResponse, getInitialNotification } from '../services/notifications';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { typography } from '../theme/typography';
import { Text } from '../components/ui';
// ─── Design System: Rack × Chrome visual language ──────────
import { palette } from '../design/tokens/materials';

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
import { FriendsScreen } from '../screens/FriendsScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { ActivityFeedScreen } from '../screens/ActivityFeedScreen';

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
  Friends: undefined;
  UserProfile: { userId: string };
  ActivityFeed: undefined;
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
/**
 * Create Tab Button — Gemini V7 elevated center CTA
 * Rounded square (not circle), orange/red background matching Gemini screenshots.
 */
function CreateTabButton({ onPress }: { onPress?: BottomTabBarButtonProps['onPress'] }) {
  return (
    <TouchableOpacity
      style={createBtnStyles.container}
      onPress={(event) => onPress?.(event)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Create a new session"
    >
      <View style={createBtnStyles.button}>
        <Ionicons name="stop" size={22} color={palette.frost} />
      </View>
    </TouchableOpacity>
  );
}

const createBtnStyles = StyleSheet.create({
  container: {
    top: -12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: palette.orange,
    alignItems: 'center',
    justifyContent: 'center',
    // Orange glow
    shadowColor: palette.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
});

// ─── Placeholder screen for the Create tab (never rendered) ──
function CreatePlaceholder() {
  return <View style={{ flex: 1, backgroundColor: palette.void }} />;
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
          backgroundColor: palette.midnight,             // Dark rack surface
          borderTopColor: 'rgba(192, 223, 255, 0.08)',   // Chrome divider line
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: palette.orange,             // Orange active (Gemini V7)
        tabBarInactiveTintColor: palette.slate,          // Slate inactive
        tabBarLabelStyle: {
          fontFamily: 'ChakraPetch-Medium',              // Rack label font
          fontSize: 10,
          letterSpacing: 1,
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
              onOpenFriends={() => props.navigation.getParent()?.navigate('Friends')}
              onOpenActivityFeed={() => props.navigation.getParent()?.navigate('ActivityFeed')}
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
              onPress={props.onPress || (() => {})}
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
        contentStyle: { backgroundColor: palette.void },
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

      <MainStack.Screen
        name="Friends"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation }) => (
          <ErrorBoundary screenName="Friends">
            <FriendsScreen
              onBack={() => navigation.goBack()}
              onOpenProfile={(userId: string) => navigation.navigate('UserProfile', { userId })}
              onOpenRoom={(sessionId: string) => navigation.navigate('SessionRoom', { sessionId })}
            />
          </ErrorBoundary>
        )}
      </MainStack.Screen>
      <MainStack.Screen
        name="UserProfile"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation, route }) => (
          <ErrorBoundary screenName="UserProfile">
            <UserProfileScreen
              userId={(route.params as any)?.userId ?? ''}
              onBack={() => navigation.goBack()}
              onOpenRoom={(sessionId: string) => navigation.navigate('SessionRoom', { sessionId })}
            />
          </ErrorBoundary>
        )}
      </MainStack.Screen>

      <MainStack.Screen
        name="ActivityFeed"
        options={{ animation: 'slide_from_right' }}
      >
        {({ navigation }) => (
          <ErrorBoundary screenName="ActivityFeed">
            <ActivityFeedScreen
              onBack={() => navigation.goBack()}
              onOpenRoom={(sessionId: string) => navigation.navigate('SessionRoom', { sessionId })}
              onOpenProfile={(userId: string) => navigation.navigate('UserProfile', { userId })}
            />
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
    }).catch(() => {});

    return unsubscribe;
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text variant="label" color={palette.slate}>Loading...</Text>
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
    backgroundColor: palette.void,
  },
});

export default AppNavigator;
