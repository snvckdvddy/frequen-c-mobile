/**
 * Ambient type declarations for expo-notifications and expo-device.
 *
 * These ensure TS compilation succeeds even if node_modules
 * isn't fully populated. Real types come from the packages at runtime.
 */

declare module 'expo-notifications' {
  export enum AndroidImportance {
    DEFAULT = 3,
    HIGH = 4,
    LOW = 2,
    MAX = 5,
    MIN = 1,
    NONE = 0,
  }

  export interface NotificationHandler {
    handleNotification: (notification: any) => Promise<{
      shouldShowAlert: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
      shouldShowBanner?: boolean;
      shouldShowList?: boolean;
    }>;
  }

  export function setNotificationHandler(handler: NotificationHandler): void;
  export function getPermissionsAsync(): Promise<{ status: string }>;
  export function requestPermissionsAsync(): Promise<{ status: string }>;
  export function setNotificationChannelAsync(
    channelId: string,
    channel: {
      name: string;
      description?: string;
      importance: AndroidImportance;
      vibrationPattern?: number[];
      lightColor?: string;
    }
  ): Promise<any>;
  export function getExpoPushTokenAsync(options?: {
    projectId?: string | undefined;
  }): Promise<{ data: string }>;
  export function scheduleNotificationAsync(options: {
    content: {
      title: string;
      body: string;
      data?: Record<string, unknown>;
      sound?: boolean;
    };
    trigger: any;
  }): Promise<string>;
  export function addNotificationResponseReceivedListener(
    handler: (response: {
      notification: {
        request: {
          content: {
            data: Record<string, unknown>;
          };
        };
      };
    }) => void
  ): { remove: () => void };
  export function getLastNotificationResponseAsync(): Promise<{
    notification: {
      request: {
        content: {
          data: Record<string, unknown>;
        };
      };
    };
  } | null>;
}

declare module 'expo-device' {
  export const isDevice: boolean;
}
