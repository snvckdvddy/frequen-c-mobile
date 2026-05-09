/**
 * Module-level navigation ref.
 *
 * The AppNavigator's <NavigationContainer> binds this ref so any module
 * (not just React components inside the navigator) can read the current
 * route name or imperatively navigate. Used by OnConnectToastProvider
 * to suppress the post-connect discovery toast when the user is already
 * on a screen where the toast would be redundant.
 *
 * Pattern: https://reactnavigation.org/docs/navigating-without-navigation-prop/
 */

import { createNavigationContainerRef } from '@react-navigation/native';
import type { MainStackParamList } from './AppNavigator';

export const navigationRef = createNavigationContainerRef<MainStackParamList>();
