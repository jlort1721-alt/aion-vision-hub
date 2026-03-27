import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPushSupported,
  requestPermission,
  showLocalNotification,
} from '@/lib/push-notifications';

// ── Helper to define/restore window properties ─────────

function defineWindowProp(prop: string, value: any) {
  Object.defineProperty(window, prop, {
    writable: true,
    configurable: true,
    value,
  });
}

function defineNavigatorProp(prop: string, value: any) {
  Object.defineProperty(navigator, prop, {
    writable: true,
    configurable: true,
    value,
  });
}

beforeEach(() => {
  // Set up a full push-capable environment by default
  defineNavigatorProp('serviceWorker', {
    register: vi.fn(),
    ready: Promise.resolve({}),
  });

  defineWindowProp('PushManager', vi.fn());

  defineWindowProp('Notification', Object.assign(
    vi.fn((title: string, opts?: NotificationOptions) => ({ title, ...opts })),
    {
      permission: 'granted' as NotificationPermission,
      requestPermission: vi.fn().mockResolvedValue('granted' as NotificationPermission),
    },
  ));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isPushSupported', () => {
  it('returns true when serviceWorker, Notification, and PushManager all exist', () => {
    expect(isPushSupported()).toBe(true);
  });

  it('returns false when serviceWorker is missing', () => {
    // Remove serviceWorker from navigator
    defineNavigatorProp('serviceWorker', undefined);
    // The check is 'serviceWorker' in navigator, so we need to actually delete it
    // Use a workaround: redefine navigator without the property
    const orig = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    // @ts-expect-error - intentionally deleting for test
    delete (navigator as any).serviceWorker;

    expect(isPushSupported()).toBe(false);

    // Restore
    if (orig) Object.defineProperty(navigator, 'serviceWorker', orig);
  });

  it('returns false when Notification is missing', () => {
    const orig = window.Notification;
    // @ts-expect-error - intentionally deleting for test
    delete (window as any).Notification;

    expect(isPushSupported()).toBe(false);

    // Restore
    defineWindowProp('Notification', orig);
  });

  it('returns false when PushManager is missing', () => {
    // @ts-expect-error - intentionally deleting for test
    delete (window as any).PushManager;

    expect(isPushSupported()).toBe(false);
  });
});

describe('requestPermission', () => {
  it('calls Notification.requestPermission and returns result', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('granted' as NotificationPermission);
    defineWindowProp('Notification', Object.assign(vi.fn(), {
      permission: 'default' as NotificationPermission,
      requestPermission: mockRequestPermission,
    }));

    const result = await requestPermission();

    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    expect(result).toBe('granted');
  });

  it('returns denied when user denies permission', async () => {
    const mockRequestPermission = vi.fn().mockResolvedValue('denied' as NotificationPermission);
    defineWindowProp('Notification', Object.assign(vi.fn(), {
      permission: 'default' as NotificationPermission,
      requestPermission: mockRequestPermission,
    }));

    const result = await requestPermission();
    expect(result).toBe('denied');
  });

  it('returns denied when Notification API is not available', async () => {
    const orig = window.Notification;
    // @ts-expect-error - intentionally deleting for test
    delete (window as any).Notification;

    const result = await requestPermission();
    expect(result).toBe('denied');

    // Restore
    defineWindowProp('Notification', orig);
  });
});

describe('showLocalNotification', () => {
  it('creates a Notification when permission is granted', () => {
    const mockConstructor = vi.fn((title: string, opts?: NotificationOptions) => ({
      title,
      ...opts,
    }));
    defineWindowProp('Notification', Object.assign(mockConstructor, {
      permission: 'granted' as NotificationPermission,
      requestPermission: vi.fn(),
    }));

    const result = showLocalNotification('Test Alert', { body: 'Camera offline' });

    expect(mockConstructor).toHaveBeenCalledWith('Test Alert', { body: 'Camera offline' });
    expect(result).not.toBeNull();
  });

  it('passes notification options correctly', () => {
    const mockConstructor = vi.fn((title: string, opts?: NotificationOptions) => ({
      title,
      ...opts,
    }));
    defineWindowProp('Notification', Object.assign(mockConstructor, {
      permission: 'granted' as NotificationPermission,
      requestPermission: vi.fn(),
    }));

    showLocalNotification('Alarm', { body: 'Intrusion detected', icon: '/alarm.png' });

    expect(mockConstructor).toHaveBeenCalledWith('Alarm', {
      body: 'Intrusion detected',
      icon: '/alarm.png',
    });
  });

  it('returns null when permission is not granted', () => {
    defineWindowProp('Notification', Object.assign(vi.fn(), {
      permission: 'denied' as NotificationPermission,
      requestPermission: vi.fn(),
    }));

    const result = showLocalNotification('Alert');
    expect(result).toBeNull();
  });

  it('returns null when permission is default (not yet requested)', () => {
    defineWindowProp('Notification', Object.assign(vi.fn(), {
      permission: 'default' as NotificationPermission,
      requestPermission: vi.fn(),
    }));

    const result = showLocalNotification('Alert');
    expect(result).toBeNull();
  });

  it('returns null when Notification API is missing', () => {
    const orig = window.Notification;
    // @ts-expect-error - intentionally deleting for test
    delete (window as any).Notification;

    const result = showLocalNotification('Alert');
    expect(result).toBeNull();

    // Restore
    defineWindowProp('Notification', orig);
  });

  it('handles being called without options', () => {
    const mockConstructor = vi.fn((title: string, opts?: NotificationOptions) => ({
      title,
      ...opts,
    }));
    defineWindowProp('Notification', Object.assign(mockConstructor, {
      permission: 'granted' as NotificationPermission,
      requestPermission: vi.fn(),
    }));

    const result = showLocalNotification('Simple Alert');

    expect(mockConstructor).toHaveBeenCalledWith('Simple Alert', undefined);
    expect(result).not.toBeNull();
  });
});
