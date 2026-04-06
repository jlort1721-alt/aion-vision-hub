/**
 * Twilio Voice SDK hook for browser-to-PSTN calls.
 * Complements use-sip-phone.ts (Asterisk internal) with Twilio PSTN capability.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

type CallStatus = 'idle' | 'connecting' | 'ringing' | 'in-call' | 'disconnected';

interface UseTwilioPhoneReturn {
  status: CallStatus;
  callDuration: number;
  makeCall: (to: string) => Promise<void>;
  hangUp: () => void;
  isReady: boolean;
  error: string | null;
}

export function useTwilioPhone(identity?: string): UseTwilioPhoneReturn {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Twilio Device
  useEffect(() => {
    if (!identity) return;

    let cancelled = false;
    const init = async () => {
      try {
        // Dynamic import to avoid bundling if not used
        const { Device } = await import('@twilio/voice-sdk');

        const res = await apiClient.get<{ token: string }>('/twilio/calls/token', { identity });
        if (cancelled) return;

        const device = new Device(res.token, {
          codecPreferences: [Device.Codec.Opus, Device.Codec.PCMU],
          logLevel: 1,
        });

        device.on('registered', () => {
          if (!cancelled) setIsReady(true);
        });

        device.on('error', (err: any) => {
          if (!cancelled) setError(err.message || 'Twilio device error');
        });

        device.on('incoming', (call: any) => {
          // Auto-answer incoming calls for operator use case
          call.accept();
          callRef.current = call;
          setStatus('in-call');
          startTimer();
          setupCallListeners(call);
        });

        await device.register();
        deviceRef.current = device;
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to initialize Twilio');
      }
    };

    init();
    return () => {
      cancelled = true;
      stopTimer();
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [identity]);

  const startTimer = useCallback(() => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setupCallListeners = useCallback((call: any) => {
    call.on('accept', () => {
      setStatus('in-call');
      startTimer();
    });
    call.on('ringing', () => setStatus('ringing'));
    call.on('disconnect', () => {
      setStatus('idle');
      stopTimer();
      callRef.current = null;
    });
    call.on('cancel', () => {
      setStatus('idle');
      stopTimer();
      callRef.current = null;
    });
    call.on('error', (err: any) => {
      setError(err.message);
      setStatus('idle');
      stopTimer();
      callRef.current = null;
    });
  }, [startTimer, stopTimer]);

  const makeCall = useCallback(async (to: string) => {
    if (!deviceRef.current) {
      setError('Twilio device not ready');
      return;
    }
    try {
      setError(null);
      setStatus('connecting');
      const call = await deviceRef.current.connect({ params: { To: to } });
      callRef.current = call;
      setupCallListeners(call);
    } catch (err: any) {
      setError(err.message);
      setStatus('idle');
    }
  }, [setupCallListeners]);

  const hangUp = useCallback(() => {
    callRef.current?.disconnect();
    setStatus('idle');
    stopTimer();
    callRef.current = null;
  }, [stopTimer]);

  return { status, callDuration, makeCall, hangUp, isReady, error };
}
