import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

const DEFAULT_INTERVAL_MS = 90 * 60 * 1000; // 90 minutes
const MAX_SNOOZES = 3;
const SNOOZE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Break reminder for 24/7 security operators.
 * Notifies after continuous session time (default 90 min).
 * After max snoozes, shows mandatory break prompt.
 */
export function useBreakReminder(intervalMs = DEFAULT_INTERVAL_MS) {
  const [showMandatoryBreak, setShowMandatoryBreak] = useState(false);
  const snoozeCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionStartRef = useRef(Date.now());

  const scheduleReminder = useCallback((delayMs: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (snoozeCountRef.current >= MAX_SNOOZES) {
        setShowMandatoryBreak(true);
      } else {
        toast.warning('Time for a break!', {
          description: `You've been working for ${Math.round((Date.now() - sessionStartRef.current) / 60000)} minutes. Take a short break.`,
          duration: 15000,
          action: {
            label: 'Snooze 30m',
            onClick: () => {
              snoozeCountRef.current += 1;
              scheduleReminder(SNOOZE_DURATION_MS);
            },
          },
        });
      }
    }, delayMs);
  }, []);

  const acknowledgeBreak = useCallback(() => {
    setShowMandatoryBreak(false);
    snoozeCountRef.current = 0;
    sessionStartRef.current = Date.now();
    scheduleReminder(intervalMs);
  }, [intervalMs, scheduleReminder]);

  const getSessionMinutes = useCallback(() => {
    return Math.round((Date.now() - sessionStartRef.current) / 60000);
  }, []);

  useEffect(() => {
    scheduleReminder(intervalMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [intervalMs, scheduleReminder]);

  return {
    showMandatoryBreak,
    acknowledgeBreak,
    getSessionMinutes,
    snoozeCount: snoozeCountRef.current,
  };
}
