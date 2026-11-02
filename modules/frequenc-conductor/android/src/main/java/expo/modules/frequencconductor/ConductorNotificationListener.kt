package expo.modules.frequencconductor

import android.service.notification.NotificationListenerService

/**
 * Intentionally empty. Android only hands MediaSessionManager.getActiveSessions()
 * to apps the user has granted notification access, and that grant requires a
 * declared NotificationListenerService. This class is that declaration; it never
 * reads or acts on notifications.
 */
class ConductorNotificationListener : NotificationListenerService()
