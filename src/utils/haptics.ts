/**
 * Haptic Feedback Utility
 *
 * Research pillar: Tactile Fidelity —
 * physical feedback reinforces social actions.
 * Votes, reactions, and queue adds should FEEL real.
 */

import { Platform } from 'react-native';

// Lazy import to avoid crash if expo-haptics isn't linked
let Haptics: typeof import('expo-haptics') | null = null;
try {
  Haptics = require('expo-haptics');
} catch {
  // expo-haptics not available — no-op
}

/** Light tap — button presses, selection changes */
export function tapLight() {
  if (Platform.OS === 'web') return;
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Medium tap — votes, adding tracks to queue */
export function tapMedium() {
  if (Platform.OS === 'web') return;
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Heavy tap — destructive actions, session leave */
export function tapHeavy() {
  if (Platform.OS === 'web') return;
  Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** Success — track added, room created, login success */
export function notifySuccess() {
  if (Platform.OS === 'web') return;
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Warning — approaching limits, voltage low */
export function notifyWarning() {
  if (Platform.OS === 'web') return;
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

/** Error — failed action, connection lost */
export function notifyError() {
  if (Platform.OS === 'web') return;
  Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

/** Selection change — toggling modes, switching tabs */
export function selectionChanged() {
  if (Platform.OS === 'web') return;
  Haptics?.selectionAsync();
}
