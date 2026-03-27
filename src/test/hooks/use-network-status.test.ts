import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '@/hooks/use-network-status';

beforeEach(() => {
  vi.useFakeTimers();
  // Default: browser is online
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    configurable: true,
    value: true,
  });
  // Default: fetch succeeds quickly
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useNetworkStatus', () => {
  it('initially reports online when navigator.onLine is true', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('initially reports offline when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('has lastOnlineAt set when initially online', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.lastOnlineAt).not.toBeNull();
  });

  it('has lastOnlineAt null when initially offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.lastOnlineAt).toBeNull();
  });

  it('detects offline when browser fires offline event', async () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.isSlowConnection).toBe(false);
  });

  it('detects back online when browser fires online event', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
      window.dispatchEvent(new Event('online'));
      // Flush the ping() triggered by the online handler
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('handles fetch failures gracefully (marks slow, stays online if navigator says online)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const { result } = renderHook(() => useNetworkStatus());

    // Flush the initial ping (which will reject) and let React process state updates
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // When navigator.onLine is true but fetch fails, isOnline stays true
    // but isSlowConnection is set to true
    expect(result.current.isSlowConnection).toBe(true);
  });

  it('marks offline when fetch fails AND navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('initially isSlowConnection is false', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isSlowConnection).toBe(false);
  });

  it('calls fetch on mount for initial ping', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useNetworkStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('performs periodic pings every 30 seconds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useNetworkStatus());

    // Initial call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const initialCalls = fetchMock.mock.calls.length;

    // Advance 30s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('cleans up event listeners and interval on unmount', () => {
    const removeEventSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useNetworkStatus());

    unmount();

    const removedEvents = removeEventSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain('online');
    expect(removedEvents).toContain('offline');
  });
});
