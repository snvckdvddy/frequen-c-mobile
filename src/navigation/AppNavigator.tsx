/**
 * App Navigation — Convergence Strategy §1.1, §5
 *
 * 4-tab layout: Home | Discover | Library | [+] Create
 * Profile accessed via header avatar (not a tab).
 * Center Create button opens CreateSession modal.
 *
 * Replaces the previous 3-tab jargon layout (Patch Bay | Flight Cases | Profile).
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, LinkingOptions, NavigationContainerRef, useNavigation, getStateFromPath as defaultGetStateFromPath } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { MiniPlayer } from '../components/MiniPlayer';
import { useGlobalSessionRoom } from '../contexts/GlobalSessionRoomContext';
import { skipCurrentTrack } from '../services/queueEngine';
import { togglePlayPause } from '../services/playbackEngine';
import { DEFAULT_BEHAVIORS } from '../types';
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
import { LibraryScreen } from '../screens/LibraryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { ActivityFeedScreen } from '../screens/ActivityFeedScreen';
import { WelcomeBootScreen } from '../screens/WelcomeBootScreen';
import { clearWelcomeBoot, shouldShowWelcomeBoot } from '../features/onboarding/welcomeBootState';

// ─── Types ──────────────────────────────────────────────────

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type MainStackParamList = {
  WelcomeBoot: undefined;
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
  Library: { initialSegment?: 'liked' | 'playlists' | 'history' } | undefined;
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
        <Ionicons name="add" size={28} color={palette.void} />
      </View>
    </TouchableOpacity>
  );
}

const createBtnStyles = StyleSheet.create({
  container: {
    flex: 1, // Let it fill its tab slot
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    width: '100%',
    height: '100%',
    backgroundColor: palette.frost, // White square filling the tab
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ─── Placeholder screen for the Create tab (never rendered) ──
function CreatePlaceholder() {
  return <View style={{ flex: 1, backgroundColor: palette.void }} />;
}

// ─── Tab Navigator ──────────────────────────────────────────

function TabNavigator() {
  const { user } = useAuth();
  const globalRoom = useGlobalSessionRoom();
  const currentTrack = globalRoom.queue[0];
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const handlePress = () => {
    if (globalRoom.session?.id) {
      navigation.navigate('SessionRoom', { sessionId: globalRoom.session.id });
    }
  };

  const handleSkip = () => {
    if (!user || !globalRoom.session) return;
    const behaviors = globalRoom.session.behaviors || DEFAULT_BEHAVIORS;
    const { skipped } = skipCurrentTrack(globalRoom.queue, user.id, globalRoom.session.hostId, behaviors);
    if (skipped) {
      globalRoom.advanceQueue();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.midnight }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          tabBarStyle: {
            backgroundColor: palette.midnight,             // Dark rack surface
            borderTopColor: 'rgba(192, 223, 255, 0.08)',   // Chrome divider line
            borderTopWidth: 1,
            height: 70, // Slightly taller to allow touch targets and bottom safe area
            paddingBottom: 0,
            paddingTop: 0,
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0,
            margin: 0,
          },
          tabBarIconStyle: { display: 'none' }, // Tactical V2 uses text-only tabs
        }}
      >
        {/* Tab 1: Home — RADAR */}
        <Tab.Screen
          name="Home"
          options={{
            tabBarLabel: ({ focused }) => (
              <View style={[styles.tacticalTab, focused && styles.tacticalTabActive]}>
                <Text style={[styles.tacticalTabLabel, focused && { color: palette.green }]}>
                  RADAR
                </Text>
              </View>
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
                onViewAllLibrary={() => props.navigation.navigate('Library', { initialSegment: 'history' })}
              />
            </ErrorBoundary>
          )}
        </Tab.Screen>

        {/* Tab 2: Discover — ROOM */}
        <Tab.Screen
          name="Discover"
          options={{
            tabBarLabel: ({ focused }) => (
              <View style={[styles.tacticalTab, focused && styles.tacticalTabActive]}>
                <Text style={[styles.tacticalTabLabel, focused && { color: palette.green }]}>
                  ROOM
                </Text>
              </View>
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

        {/* Tab 3: Library — LIBRARY */}
        <Tab.Screen
          name="Library"
          options={{
            tabBarLabel: ({ focused }) => (
              <View style={[styles.tacticalTab, focused && styles.tacticalTabActive]}>
                <Text style={[styles.tacticalTabLabel, focused && { color: palette.green }]}>
                  LIBRARY
                </Text>
              </View>
            ),
          }}
        >
          {(props) => (
            <ErrorBoundary screenName="Library">
              <LibraryScreen
                route={props.route}
                onOpenRoom={(sessionId: string) =>
                  props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
                }
              />
            </ErrorBoundary>
          )}
        </Tab.Screen>

        {/* Tab 4: Create — Solid White Right-Side Button */}
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
      </Tab.Navigator>

      {currentTrack && globalRoom.playback && (
        <View style={{ position: 'absolute', bottom: 82, left: 12, right: 12 }}>
          <MiniPlayer
            track={currentTrack}
            playback={globalRoom.playback}
            onPlayPause={togglePlayPause}
            onSkip={handleSkip}
            onPress={handlePress}
          />
        </View>
      )}
    </View>
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
      initialRouteName={shouldShowWelcomeBoot() ? 'WelcomeBoot' : 'Tabs'}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: palette.void },
      }}
    >
      <MainStack.Screen
        name="WelcomeBoot"
        options={{ animation: 'fade' }}
      >
        {({ navigation }) => (
          <ErrorBoundary screenName="WelcomeBoot">
            <WelcomeBootScreen
              onContinue={() => {
                clearWelcomeBoot();
                navigation.replace('Tabs');
              }}
            />
          </ErrorBoundary>
        )}
      </MainStack.Screen>
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
              userId={(route.params as MainStackParamList['UserProfile'])?.userId ?? ''}
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

/**
 * Auth callback URLs (SoundCloud, Last.fm, Apple web) should NOT trigger
 * navigation — they are handled by the Linking listener in AuthContext.
 * Return true for URLs that carry auth params so getStateFromPath can drop them.
 *
 * NOTE: React Navigation's getStateFromPath receives only the path+query portion
 * of the deep link, not the scheme. So frequenc://apple-auth?token=… arrives as
 * "apple-auth?token=…".
 */
function isAuthCallbackUrl(path: string): boolean {
  const lower = path.toLowerCase();
  // SoundCloud / generic service callbacks: ?service=soundcloud&status=success
  if (/[?&]service=/.test(lower) && /[?&]status=/.test(lower)) return true;
  // Last.fm callback: bare scheme root with ?token= (no path segment)
  if (/^[/?]?[^/]*[?&]token=/.test(lower) && !/[?&]service=/.test(lower)) return true;
  // Apple web sign-in callback: frequenc://apple-auth?...
  // Apple Music MusicKit callback: frequenc://apple-music-auth?...
  if (lower.startsWith('apple-auth') || lower.startsWith('apple-music-auth')) return true;
  return false;
}

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
  getStateFromPath(path, options) {
    if (isAuthCallbackUrl(path)) return undefined;
    return defaultGetStateFromPath(path, options);
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
  tacticalTab: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tacticalTabActive: {
    borderBottomColor: palette.green,
    backgroundColor: 'rgba(0, 255, 65, 0.05)',
  },
  tacticalTabLabel: {
    fontFamily: 'ChakraPetch-Medium',
    fontSize: 11,
    letterSpacing: 2,
    color: palette.slate,
  },
});

export default AppNavigator;
