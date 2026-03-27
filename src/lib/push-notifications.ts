// ═══════════════════════════════════════════════════════════
// AION VISION HUB — Push Notifications
// Wraps the Web Push API for browser notifications.
// ═══════════════════════════════════════════════════════════

/**
 * Check whether push notifications are supported in the current browser.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window
  );
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.requestPermission();
}

/**
 * Show a local notification (no push server needed).
 * Only works if permission has been granted.
 */
export function showLocalNotification(
  title: string,
  options?: NotificationOptions,
): Notification | null {
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  return new Notification(title, options);
}
