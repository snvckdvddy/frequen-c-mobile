/**
 * App Navigation
 *
 * Stack-based with a bottom tab navigator for the main app.
 * Auth flow is a separate stack.
 */

import React from 'react';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Text } from '../components/ui';

// Screens
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { CreateSessionScreen } from '../screens/CreateSessionScreen';
import { JoinSessionScreen } from '../screens/JoinSessionScreen';
import { SessionRoomScreen } from '../screens/SessionRoomScreen';
import { DiscoverScreen } from '../screens/DiscoverScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';

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
};

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Search: undefined;
  Profile: undefined;
};

// ─── Navigators ─────────────────────────────────────────────

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ─── Tab Icon ────────────────────────────────────────────────

const tabIcons: Record<string, { focused: keyof typeof Ionicons.glyphMap; default: keyof typeof Ionicons.glyphMap }> = {
  Home: { focused: 'home', default: 'home-outline' },
  Discover: { focused: 'compass', default: 'compass-outline' },
  Search: { focused: 'search', default: 'search-outline' },
  Profile: { focused: 'person', default: 'person-outline' },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icon = tabIcons[label];
  const name = focused ? icon?.focused : icon?.default;
  return (
    <Ionicons
      name={name || 'ellipse-outline'}
      size={22}
      color={focused ? colors.action.primary : colors.text.muted}
    />
  );
}

// ─── Tab Navigator ──────────────────────────────────────────

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.surface,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.action.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontFamily: typography.fontFamily,
          fontSize: 10,
          fontWeight: typography.weight.medium,
          letterSpacing: 1,
          // Deliberately omitting textTransform and lineHeight from
          // typography.labelSmall — they crash tabBarLabelStyle on Android.
        },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
      })}
    >
      <Tab.Screen name="Home" options={{ tabBarLabel: 'HOME' }}>
        {(props) => (
          <HomeScreen
            onCreateSession={() => props.navigation.getParent()?.navigate('CreateSession')}
            onJoinSession={() => props.navigation.getParent()?.navigate('JoinSession')}
            onOpenRoom={(sessionId: string) =>
              props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
            }
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Discover" options={{ tabBarLabel: 'DISCOVER' }}>
        {(props) => (
          <DiscoverScreen
            onOpenRoom={(sessionId: string) =>
              props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
            }
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Search" options={{ tabBarLabel: 'SEARCH' }}>
        {(props) => (
          <SearchScreen
            onOpenRoom={(sessionId: string) =>
              props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
            }
            onBrowseRooms={() => props.navigation.navigate('Discover')}
            onCreateRoom={() => props.navigation.getParent()?.navigate('CreateSession')}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Profile" options={{ tabBarLabel: 'PROFILE' }}>
        {(props) => (
          <ProfileScreen
            onOpenRoom={(sessionId: string) =>
              props.navigation.getParent()?.navigate('SessionRoom', { sessionId })
            }
          />
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
        component={CreateSessionScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <MainStack.Screen
        name="JoinSession"
        component={JoinSessionScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <MainStack.Screen name="SessionRoom" component={SessionRoomScreen} />
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

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text variant="label" color={colors.text.muted}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={isAuthenticated ? linking : undefined}>
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
