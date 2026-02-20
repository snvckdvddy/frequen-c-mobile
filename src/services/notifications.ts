/**
 * Push Notification Service
 *
 * Registers for push tokens, schedules local notifications,
 * and handles incoming notification responses (e.g. deep linking to a room).
 *
 * Uses expo-notifications which works with Expo Go on Android.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ─── Default Behavior ────────────────────────────────────────
// Show alerts even when app is foregrounded

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Push Token Registration ────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('[Notifications] Must use physical device for push notifications');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  // Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00E5FF',
    });

    await Notifications.setNotificationChannelAsync('session', {
      name: 'Session Activity',
      description: 'Track changes, joins, and room updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#00E5FF',
    });
  }

  // Get the Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Will use EAS projectId from app.json when configured
    });
    console.log('[Notifications] Push token:', tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.error('[Notifications] Failed to get push token:', err);
    return null;
  }
}

// ─── Local Notifications ────────────────────────────────────

/**
 * Send a local notification (no server needed).
 * Used for immediate in-app events like "Someone joined your room".
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: null, // Immediate
  });
}

/**
 * Notify when someone joins the user's session.
 */
export async function notifyParticipantJoined(
  username: string,
  sessionName: string,
  sessionId: string
): Promise<void> {
  await sendLocalNotification(
    sessionName,
    `${username} joined the room`,
    { type: 'participant-joined', sessionId }
  );
}

/**
 * Notify when a track starts playing.
 */
export async function notifyTrackChanged(
  trackTitle: string,
  artist: string,
  sessionId: string
): Promise<void> {
  await sendLocalNotification(
    'Now Playing',
    `${trackTitle} — ${artist}`,
    { type: 'track-changed', sessionId }
  );
}

// ─── Response Handling ──────────────────────────────────────

/**
 * Subscribe to notification taps. Returns cleanup function.
 * Call this once in your app root (e.g., App.tsx).
 */
export function onNotificationResponse(
  handler: (sessionId: string) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data;
      if (data?.sessionId && typeof data.sessionId === 'string') {
        handler(data.sessionId);
      }
    }
  );

  return () => subscription.remove();
}

/**
 * Check if the app was opened via a notification tap (cold start).
 */
export async function getInitialNotification(): Promise<string | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  if (response) {
    const data = response.notification.request.content.data;
    if (data?.sessionId && typeof data.sessionId === 'string') {
      return data.sessionId;
    }
  }
  return null;
}

export default {
  register: registerForPushNotifications,
  sendLocal: sendLocalNotification,
  notifyParticipantJoined,
  notifyTrackChanged,
  onNotificationResponse,
  getInitialNotification,
};
