// Notification history stored in memory for current session
export interface NotificationEntry {
  id: string;
  title: string;
  body: string;
  severity: string;
  timestamp: string;
}

const MAX_HISTORY = 50;
let history: NotificationEntry[] = [];
let listeners: (() => void)[] = [];

export function addNotification(entry: Omit<NotificationEntry, 'id' | 'timestamp'>) {
  const item: NotificationEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  history = [item, ...history].slice(0, MAX_HISTORY);
  listeners.forEach(l => l());
}

export function getNotificationHistory(): NotificationEntry[] {
  return history;
}

export function clearNotificationHistory() {
  history = [];
  listeners.forEach(l => l());
}

export function subscribeNotificationHistory(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}
