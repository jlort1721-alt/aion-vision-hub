import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { AdapterFactory } from '../factory.js';

const logger = pino({ level: 'silent' });

describe('AdapterFactory', () => {
  it('should register default adapters', () => {
    const factory = new AdapterFactory(logger);
    expect(factory.has('hikvision')).toBe(true);
    expect(factory.has('dahua')).toBe(true);
    expect(factory.has('onvif')).toBe(true);
    expect(factory.has('generic')).toBe(true);
  });

  it('should return correct adapter for brand', () => {
    const factory = new AdapterFactory(logger);
    const hik = factory.get('hikvision');
    expect(hik.brand).toBe('hikvision');
    const dh = factory.get('dahua');
    expect(dh.brand).toBe('dahua');
  });

  it('should fall back to ONVIF for unknown brands', () => {
    const factory = new AdapterFactory(logger);
    const adapter = factory.get('unknown-brand');
    expect(adapter.brand).toBe('onvif');
  });

  it('should list supported brands', () => {
    const factory = new AdapterFactory(logger);
    const brands = factory.getSupportedBrands();
    expect(brands).toContain('hikvision');
    expect(brands).toContain('dahua');
    expect(brands).toContain('onvif');
  });
});
