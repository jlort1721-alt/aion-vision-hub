import type pino from 'pino';
import type { IDeviceAdapter, IStreamAdapter, IDiscoveryAdapter, IHealthAdapter, IConfigAdapter, IPTZAdapter, IPlaybackAdapter, IEventAdapter } from '@aion/shared-contracts';
import { BaseAdapter } from './base-adapter.js';
import { HikvisionAdapter } from './hikvision/adapter.js';
import { DahuaAdapter } from './dahua/adapter.js';
import { GenericOnvifAdapter } from './onvif/adapter.js';

export type FullAdapter = BaseAdapter &
  IDeviceAdapter &
  IStreamAdapter &
  IDiscoveryAdapter &
  IHealthAdapter &
  IConfigAdapter &
  IPTZAdapter &
  IPlaybackAdapter &
  IEventAdapter;

/**
 * Factory for creating device adapters based on brand.
 * Supports registration of custom adapters at runtime.
 */
export class AdapterFactory {
  private adapters = new Map<string, FullAdapter>();
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger;
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register('hikvision', new HikvisionAdapter(this.logger) as FullAdapter);
    this.register('dahua', new DahuaAdapter(this.logger) as FullAdapter);
    this.register('onvif', new GenericOnvifAdapter(this.logger) as FullAdapter);
    // Generic fallback maps to ONVIF
    this.register('generic', new GenericOnvifAdapter(this.logger) as FullAdapter);
  }

  register(brand: string, adapter: FullAdapter): void {
    this.adapters.set(brand.toLowerCase(), adapter);
    this.logger.info({ brand }, 'Adapter registered');
  }

  get(brand: string): FullAdapter {
    const adapter = this.adapters.get(brand.toLowerCase());
    if (!adapter) {
      this.logger.warn({ brand }, 'No specific adapter found, falling back to ONVIF');
      const fallback = this.adapters.get('onvif');
      if (!fallback) throw new Error(`No adapter available for brand: ${brand}`);
      return fallback;
    }
    return adapter;
  }

  has(brand: string): boolean {
    return this.adapters.has(brand.toLowerCase());
  }

  getSupportedBrands(): string[] {
    return Array.from(this.adapters.keys());
  }

  getAll(): Map<string, FullAdapter> {
    return new Map(this.adapters);
  }
}
