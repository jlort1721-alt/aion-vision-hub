import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioAlerts } from '@/hooks/use-audio-alerts';

// ── Mock AudioContext & OscillatorNode ─────────────────

const mockOscillator = {
  type: 'sine' as OscillatorType,
  frequency: { value: 0 },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockGainNode = {
  gain: {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
};

const mockAudioContext = {
  currentTime: 0,
  state: 'running' as AudioContextState,
  destination: {},
  resume: vi.fn().mockResolvedValue(undefined),
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  createGain: vi.fn(() => ({
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  })),
};

beforeEach(() => {
  vi.stubGlobal('AudioContext', vi.fn(() => ({ ...mockAudioContext })));
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAudioAlerts', () => {
  it('initializes with isMuted = false by default', () => {
    const { result } = renderHook(() => useAudioAlerts());
    expect(result.current.isMuted).toBe(false);
  });

  it('reads initial muted state from localStorage', () => {
    localStorage.setItem('aion-audio-muted', 'true');
    const { result } = renderHook(() => useAudioAlerts());
    expect(result.current.isMuted).toBe(true);
  });

  it('initializes with volume = 0.5', () => {
    const { result } = renderHook(() => useAudioAlerts());
    expect(result.current.volume).toBe(0.5);
  });

  it('toggleMute flips muted state from false to true', () => {
    const { result } = renderHook(() => useAudioAlerts());
    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);
    expect(localStorage.getItem('aion-audio-muted')).toBe('true');
  });

  it('toggleMute flips muted state from true to false', () => {
    localStorage.setItem('aion-audio-muted', 'true');
    const { result } = renderHook(() => useAudioAlerts());
    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(false);
    expect(localStorage.getItem('aion-audio-muted')).toBe('false');
  });

  it('setVolume updates volume within bounds', () => {
    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.setVolume(0.8);
    });
    expect(result.current.volume).toBe(0.8);
  });

  it('setVolume clamps to [0, 1] range', () => {
    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.setVolume(1.5);
    });
    expect(result.current.volume).toBe(1);

    act(() => {
      result.current.setVolume(-0.3);
    });
    expect(result.current.volume).toBe(0);
  });

  it('playAlert creates AudioContext and oscillator for critical severity', () => {
    const createOscillatorSpy = vi.fn(() => ({ ...mockOscillator }));
    const createGainSpy = vi.fn(() => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }));

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        ...mockAudioContext,
        createOscillator: createOscillatorSpy,
        createGain: createGainSpy,
      })),
    );

    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.playAlert('critical');
    });

    // Critical has 3 beeps, so 3 oscillators should be created
    expect(createOscillatorSpy).toHaveBeenCalledTimes(3);
    expect(createGainSpy).toHaveBeenCalledTimes(3);
  });

  it('playAlert creates 2 beeps for high severity', () => {
    const createOscillatorSpy = vi.fn(() => ({ ...mockOscillator }));
    const createGainSpy = vi.fn(() => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }));

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        ...mockAudioContext,
        createOscillator: createOscillatorSpy,
        createGain: createGainSpy,
      })),
    );

    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.playAlert('high');
    });

    expect(createOscillatorSpy).toHaveBeenCalledTimes(2);
  });

  it('playAlert creates 1 beep for medium severity', () => {
    const createOscillatorSpy = vi.fn(() => ({ ...mockOscillator }));
    const createGainSpy = vi.fn(() => ({
      gain: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }));

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        ...mockAudioContext,
        createOscillator: createOscillatorSpy,
        createGain: createGainSpy,
      })),
    );

    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.playAlert('medium');
    });

    expect(createOscillatorSpy).toHaveBeenCalledTimes(1);
  });

  it('playAlert does nothing for low severity (null config)', () => {
    const createOscillatorSpy = vi.fn(() => ({ ...mockOscillator }));

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        ...mockAudioContext,
        createOscillator: createOscillatorSpy,
      })),
    );

    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.playAlert('low');
    });

    expect(createOscillatorSpy).not.toHaveBeenCalled();
  });

  it('playAlert does nothing for info severity (null config)', () => {
    const createOscillatorSpy = vi.fn(() => ({ ...mockOscillator }));

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        ...mockAudioContext,
        createOscillator: createOscillatorSpy,
      })),
    );

    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.playAlert('info');
    });

    expect(createOscillatorSpy).not.toHaveBeenCalled();
  });

  it('playAlert does nothing when muted', () => {
    localStorage.setItem('aion-audio-muted', 'true');

    const createOscillatorSpy = vi.fn(() => ({ ...mockOscillator }));

    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => ({
        ...mockAudioContext,
        createOscillator: createOscillatorSpy,
      })),
    );

    const { result } = renderHook(() => useAudioAlerts());

    act(() => {
      result.current.playAlert('critical');
    });

    expect(createOscillatorSpy).not.toHaveBeenCalled();
  });

  it('playAlert handles AudioContext errors gracefully', () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(() => {
        throw new Error('AudioContext not allowed');
      }),
    );

    const { result } = renderHook(() => useAudioAlerts());

    // Should not throw
    expect(() => {
      act(() => {
        result.current.playAlert('critical');
      });
    }).not.toThrow();
  });
});
