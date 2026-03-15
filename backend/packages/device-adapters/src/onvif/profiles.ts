/**
 * ONVIF Profile definitions.
 *
 * Profile S: Streaming (required for all IP cameras)
 * Profile T: Advanced Streaming + analytics
 * Profile G: Recording & storage
 * Profile M: Metadata & events
 */

export const ONVIF_PROFILES = {
  S: { name: 'Profile S', scope: 'Streaming', required: true },
  T: { name: 'Profile T', scope: 'Advanced Streaming', required: false },
  G: { name: 'Profile G', scope: 'Recording', required: false },
  M: { name: 'Profile M', scope: 'Metadata', required: false },
} as const;

export type OnvifProfile = keyof typeof ONVIF_PROFILES;

export interface OnvifMediaProfile {
  token: string;
  name: string;
  videoEncoding: string;
  width: number;
  height: number;
  frameRate: number;
  bitrate?: number;
  streamUri?: string;
}

/**
 * Utility to promisify callback-based onvif Cam methods.
 */
export function promisifyCam(cam: Record<string, unknown>, method: string, ...args: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const fn = cam[method] as (...cbArgs: unknown[]) => void;
    if (typeof fn !== 'function') {
      reject(new Error(`Method ${method} not found on camera`));
      return;
    }
    fn.call(cam, ...args, (err: Error | null, result: unknown) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
