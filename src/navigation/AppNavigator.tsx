/**
 * App Navigation — Modular Synthesis Architecture
 *
 * 3-tab layout: Patch Bay | Flight Cases | Profile
 * Contextual FAB: "Patch In" adapts to current screen
 * Signal Path breadcrumbs on every screen
 */

import React, { useEffect, useRef } from 'react';
import { NavigationContainer, LinkingOptions, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DURATION, EASING as MOTION_EASING } from '../theme/motion';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
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
import { PatchBayScreen } from '../screens/PatchBayScreen';
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
  PatchBay: undefined;
  FlightCases: undefined;
  ProfileTab: undefined;
};

// ─── Navigators ─────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ─── Tab Icons — Modular Synthesis Visual Language ──────────

/** Patch Bay icon — grid of connected nodes */
function PatchBayIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.action.primary : colors.text.muted;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={6} cy={6} r={2.5} fill={color} opacity={focused ? 1 : 0.6} />
      <Circle cx={18} cy={6} r={2.5} fill={color} opacity={focused ? 1 : 0.6} />
      <Circle cx={6} cy={18} r={2.5} fill={color} opacity={focused ? 1 : 0.6} />
      <Circle cx={18} cy={18} r={2.5} fill={color} opacity={focused ? 1 : 0.6} />
      <Path d="M 8.5 6 L 15.5 6" stroke={color} strokeWidth={1} opacity={0.4} />
      <Path d="M 6 8.5 L 6 15.5" stroke={color} strokeWidth={1} opacity={0.4} />
      <Path d="M 8.5 18 L 15.5 18" stroke={color} strokeWidth={1} opacity={0.4} />
      <Path d="M 18 8.5 L 18 15.5" stroke={color} strokeWidth={1} opacity={0.4} />
      <Path d="M 8 8 L 16 16" stroke={color} strokeWidth={1} opacity={0.25} strokeDasharray="2,2" />
    </Svg>
  );
}

/** Flight Cases icon — stacked containers */
function FlightCasesIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.action.primary : colors.text.muted;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {/* Top case */}
      <Rect x={3} y={4} width={18} height={6} rx={2} stroke={color} strokeWidth={1.5} fill="none" />
      {/* Bottom case */}
      <Rect x={3} y={13} width={18} height={7} rx={2} stroke={color} strokeWidth={1.5} fill="none" />
      {/* Handle */}
      <Path d="M 10 4 L 10 2 L 14 2 L 14 4" stroke={color} strokeWidth={1.2} fill="none" />
      {/* Latches */}
      <Path d="M 9 7 L 15 7" stroke={color} strokeWidth={1} opacity={0.5} />
      <Path d="M 9 16.5 L 15 16.5" stroke={color} strokeWidth={1} opacity={0.5} />
    </Svg>
  );
}

/** Profile icon — signal node with connections */
function ProfileIcon({ focused }: { focused: boolean }) {
  const color = focused ? colors.action.primary : colors.text.muted;
  return (
    <Ionicons
      name={focused ? 'person-circle' : 'person-circle-outline'}
      size={22}
      color={color}
    />
  );
}

// ─── Patch In FAB ───────────────────────────────────────────

/**
 * Contextual Floating Action Button.
 * From Patch Bay → Create/Join Room
 * From Flight Cases → New Collection
 * From Profile → Connect Service
 */
function PatchInFAB({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={fabStyles.container} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Patch In, create or join a session">
      <View style={fabStyles.button}>
        <Ionicons name="add" size={26} color={colors.action.primaryText} />
      </View>
      <Text variant="labelSmall" color={colors.action.primary} style={fabStyles.label}>
        PATCH IN
      </Text>
    </TouchableOpacity>
  );
}

const fabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90, // above tab bar
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  button: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.action.primary,
    alignItems: 'center',
    justifyContent: 'center',
    // Chrome border
    borderWidth: 1,
    borderColor: colors.chrome.highlight,
    // Glow
    shadowColor: colors.action.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  label: {
    marginTop: 4,
    fontSize: 8,
    letterSpacing: 1.5,
  },
});

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
          borderTopColor: colors.border.default,      // Dark steel divider — Convergence §1.1
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.action.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily,
          fontSize: 9,
          fontWeight: typography.weight.medium,
          letterSpacing: 1.2,
        },
      }}
    >
      {/* Tab 1: Patch Bay — Live session grid (Home + Discover merged) */}
      <Tab.Screen
        name="PatchBay"
        options={{
          tabBarLabel: 'PATCH BAY',
          tabBarIcon: ({ focused }) => <PatchBayIcon focused={focused} />,
        }}
      >
        {(props) => (
          <ErrorBoundary screenName="PatchBay">
            <View style={{ flex: 1 }}>
              <PatchBayScreen
                onCreateSession={() => props.navigation.getParent()?.navigate('CreateSession')}
                onJoinSession={() => props.navigation.getParent()?.navigate('JoinSession')}
                onOpenRoom={(sessionId: string) =>
                  props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
                }
                onOpenProfile={() => props.navigation.getParent()?.navigate('Profile')}
              />
              <PatchInFAB
                onPress={() => props.navigation.getParent()?.navigate('CreateSession')}
              />
            </View>
          </ErrorBoundary>
        )}
      </Tab.Screen>

      {/* Tab 2: Flight Cases — Library, collections, history */}
      <Tab.Screen
        name="FlightCases"
        options={{
          tabBarLabel: 'FLIGHT CASES',
          tabBarIcon: ({ focused }) => <FlightCasesIcon focused={focused} />,
        }}
      >
        {(props) => (
          <ErrorBoundary screenName="FlightCases">
            <FlightCasesScreen
              onOpenRoom={(sessionId: string) =>
                props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
              }
            />
          </ErrorBoundary>
        )}
      </Tab.Screen>

      {/* Tab 3: Profile — Identity, services, CV, settings */}
      <Tab.Screen
        name="ProfileTab"
        options={{
          tabBarLabel: 'PROFILE',
          tabBarIcon: ({ focused }) => <ProfileIcon focused={focused} />,
        }}
      >
        {(props) => (
          <ErrorBoundary screenName="Profile">
            <ProfileScreen
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
