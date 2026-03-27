import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBreakReminder } from '@/hooks/use-break-reminder';

// Mock sonner toast to prevent real toast rendering
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useBreakReminder', () => {
  it('initializes with showMandatoryBreak = false', () => {
    const { result } = renderHook(() => useBreakReminder());
    expect(result.current.showMandatoryBreak).toBe(false);
  });

  it('initializes with snoozeCount = 0', () => {
    const { result } = renderHook(() => useBreakReminder());
    expect(result.current.snoozeCount).toBe(0);
  });

  it('getSessionMinutes returns 0 initially', () => {
    const { result } = renderHook(() => useBreakReminder());
    expect(result.current.getSessionMinutes()).toBe(0);
  });

  it('getSessionMinutes returns correct value after time passes', () => {
    const { result } = renderHook(() => useBreakReminder());

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000); // 10 minutes
    });

    expect(result.current.getSessionMinutes()).toBe(10);
  });

  it('fires toast warning after the configured interval', async () => {
    const { toast } = await import('sonner');
    const SHORT_INTERVAL = 5000; // 5 seconds for test speed

    renderHook(() => useBreakReminder(SHORT_INTERVAL));

    act(() => {
      vi.advanceTimersByTime(SHORT_INTERVAL);
    });

    expect(toast.warning).toHaveBeenCalledWith(
      'Time for a break!',
      expect.objectContaining({
        description: expect.any(String),
        duration: 15000,
        action: expect.objectContaining({ label: 'Snooze 30m' }),
      }),
    );
  });

  it('does not show mandatory break after first timer expiry (snoozeCount < MAX_SNOOZES)', () => {
    const SHORT_INTERVAL = 5000;

    const { result } = renderHook(() => useBreakReminder(SHORT_INTERVAL));

    act(() => {
      vi.advanceTimersByTime(SHORT_INTERVAL);
    });

    expect(result.current.showMandatoryBreak).toBe(false);
  });

  it('acknowledgeBreak resets showMandatoryBreak to false', () => {
    const { result } = renderHook(() => useBreakReminder());

    // Manually verify acknowledgeBreak function exists and can be called
    act(() => {
      result.current.acknowledgeBreak();
    });

    expect(result.current.showMandatoryBreak).toBe(false);
  });

  it('acknowledgeBreak resets session timer (getSessionMinutes returns ~0)', () => {
    const { result } = renderHook(() => useBreakReminder());

    // Advance time so session minutes > 0
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(result.current.getSessionMinutes()).toBe(5);

    // Acknowledge break — should reset session start
    act(() => {
      result.current.acknowledgeBreak();
    });

    expect(result.current.getSessionMinutes()).toBe(0);
  });

  it('cleans up timer on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = renderHook(() => useBreakReminder());

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('accepts custom interval parameter', async () => {
    const { toast } = await import('sonner');
    const CUSTOM_INTERVAL = 2000;

    renderHook(() => useBreakReminder(CUSTOM_INTERVAL));

    act(() => {
      vi.advanceTimersByTime(CUSTOM_INTERVAL);
    });

    expect(toast.warning).toHaveBeenCalled();
  });
});
