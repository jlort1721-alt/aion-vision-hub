import { config } from '../config/env.js';

export interface TimeoutConfig {
  connectMs: number;
  healthMs: number;
  discoveryMs: number;
  ptzMs: number;
  playbackMs: number;
  streamRegistrationMs: number;
}

export const timeouts: TimeoutConfig = {
  connectMs: config.DEVICE_CONNECT_TIMEOUT_MS,
  healthMs: 3000,
  discoveryMs: config.DISCOVERY_TIMEOUT_MS,
  ptzMs: 5000,
  playbackMs: 10000,
  streamRegistrationMs: 5000,
};

export function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${operation} exceeded ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
