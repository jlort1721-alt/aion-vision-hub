import { useCallback, useRef, useState } from 'react';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

const TONE_CONFIG: Record<Severity, { frequency: number; beeps: number; duration: number } | null> = {
  critical: { frequency: 800, beeps: 3, duration: 150 },
  high: { frequency: 600, beeps: 2, duration: 120 },
  medium: { frequency: 400, beeps: 1, duration: 100 },
  low: null,
  info: null,
};

export function useAudioAlerts() {
  const [isMuted, setIsMuted] = useState(() => {
    try { return localStorage.getItem('aion-audio-muted') === 'true'; } catch { return false; }
  });
  const [volume, setVolumeState] = useState(0.5);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playAlert = useCallback((severity: Severity) => {
    if (isMuted) return;
    const config = TONE_CONFIG[severity];
    if (!config) return;

    try {
      const ctx = getAudioContext();
      const { frequency, beeps, duration } = config;

      for (let i = 0; i < beeps; i++) {
        const startTime = ctx.currentTime + i * (duration + 80) / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;
        gain.gain.value = volume;

        // Envelope: quick attack, sustain, quick release
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gain.gain.setValueAtTime(volume, startTime + duration / 1000 - 0.02);
        gain.gain.linearRampToValueAtTime(0, startTime + duration / 1000);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration / 1000);
      }
    } catch {
      // Audio context not available (e.g., no user interaction yet)
    }
  }, [isMuted, volume, getAudioContext]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try { localStorage.setItem('aion-audio-muted', String(next)); } catch { /* no-op */ }
      return next;
    });
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  return { playAlert, isMuted, toggleMute, volume, setVolume };
}
