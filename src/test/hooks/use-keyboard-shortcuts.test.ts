import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';

// ── Mock react-router-dom's useNavigate ────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(MemoryRouter, null, children);
  };
}

function fireKey(key: string, options: Partial<KeyboardEventInit> = {}, target?: HTMLElement) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  if (target) {
    Object.defineProperty(event, 'target', { value: target, writable: false });
  }
  document.dispatchEvent(event);
}

beforeEach(() => {
  mockNavigate.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useKeyboardShortcuts', () => {
  // ── F-key navigation ─────────────────────────────────

  it('F1 navigates to /dashboard', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('F1');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('F2 navigates to /live-view', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('F2');
    expect(mockNavigate).toHaveBeenCalledWith('/live-view');
  });

  it('F3 navigates to /events', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('F3');
    expect(mockNavigate).toHaveBeenCalledWith('/events');
  });

  it('F4 navigates to /incidents', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('F4');
    expect(mockNavigate).toHaveBeenCalledWith('/incidents');
  });

  it('F5 calls onToggleMute callback', () => {
    const onToggleMute = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onToggleMute }), {
      wrapper: createWrapper(),
    });

    fireKey('F5');
    expect(onToggleMute).toHaveBeenCalledTimes(1);
  });

  // ── Alt combos ────────────────────────────────────────

  it('Alt+G calls onOpenGate', () => {
    const onOpenGate = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onOpenGate }), {
      wrapper: createWrapper(),
    });

    fireKey('g', { altKey: true });
    expect(onOpenGate).toHaveBeenCalledTimes(1);
  });

  it('Alt+N calls onNewIncident', () => {
    const onNewIncident = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onNewIncident }), {
      wrapper: createWrapper(),
    });

    fireKey('n', { altKey: true });
    expect(onNewIncident).toHaveBeenCalledTimes(1);
  });

  it('Alt+1 navigates to /dashboard', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('1', { altKey: true });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('Alt+2 navigates to /live-view', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('2', { altKey: true });
    expect(mockNavigate).toHaveBeenCalledWith('/live-view');
  });

  it('Alt+3 navigates to /events', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('3', { altKey: true });
    expect(mockNavigate).toHaveBeenCalledWith('/events');
  });

  it('Alt+4 navigates to /incidents', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('4', { altKey: true });
    expect(mockNavigate).toHaveBeenCalledWith('/incidents');
  });

  it('Alt+5 navigates to /ai-assistant', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    fireKey('5', { altKey: true });
    expect(mockNavigate).toHaveBeenCalledWith('/ai-assistant');
  });

  // ── Input/textarea guard ──────────────────────────────

  it('ignores events when target is an INPUT element', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    const input = document.createElement('input');
    fireKey('F1', {}, input);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores events when target is a TEXTAREA element', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    const textarea = document.createElement('textarea');
    fireKey('F2', {}, textarea);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('ignores events when target is a SELECT element', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    const select = document.createElement('select');
    fireKey('F3', {}, select);

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ── Cleanup ───────────────────────────────────────────

  it('removes event listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardShortcuts(), {
      wrapper: createWrapper(),
    });

    unmount();

    const removedEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedEvents).toContain('keydown');
  });

  // ── No callback = no crash ────────────────────────────

  it('does not crash when Alt+G is pressed without onOpenGate callback', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    expect(() => fireKey('g', { altKey: true })).not.toThrow();
  });

  it('does not crash when Alt+N is pressed without onNewIncident callback', () => {
    renderHook(() => useKeyboardShortcuts(), { wrapper: createWrapper() });

    expect(() => fireKey('n', { altKey: true })).not.toThrow();
  });
});
