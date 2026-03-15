declare module 'onvif' {
  import { EventEmitter } from 'node:events';

  export class Cam {
    deviceInformation?: Record<string, string>;
    ptzService?: unknown;

    constructor(options: Record<string, unknown>, callback: (err: Error | null) => void);
    getDeviceInformation(callback: (err: Error | null, info: Record<string, unknown>) => void): void;
    getProfiles(callback: (err: Error | null, profiles: Array<Record<string, unknown>>) => void): void;
    getStreamUri(options: Record<string, unknown>, callback: (err: Error | null, uri: Record<string, unknown>) => void): void;
    getCapabilities(callback: (err: Error | null, caps: Record<string, unknown>) => void): void;
    getServices(includeCapability: boolean, callback: (err: Error | null, services: Array<Record<string, unknown>>) => void): void;
    absoluteMove(options: Record<string, unknown>, callback: (err: Error | null) => void): void;
    relativeMove(options: Record<string, unknown>, callback: (err: Error | null) => void): void;
    continuousMove(options: Record<string, unknown>, callback: (err: Error | null) => void): void;
    stop(options: Record<string, unknown>, callback: (err: Error | null) => void): void;
    getPresets(options: Record<string, unknown>, callback: (err: Error | null, presets: Record<string, unknown>) => void): void;
    setPreset(options: Record<string, unknown>, callback: (err: Error | null) => void): void;
    gotoPreset(options: Record<string, unknown>, callback: (err: Error | null) => void): void;
    getRecordingSearchResults?(options: Record<string, unknown>, callback: (err: Error | null, results: Record<string, unknown>) => void): void;
  }

  export class Discovery extends EventEmitter {
    constructor();
    probe(): void;
    static probe(callback: (err: Error | null, cams: Array<Record<string, unknown>>) => void): void;
    static probe(options: Record<string, unknown>, callback: (err: Error | null, cams: Array<Record<string, unknown>>) => void): void;
  }
}
