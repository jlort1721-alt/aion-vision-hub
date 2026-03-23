import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const corsSchema = z.string().default('http://localhost:5173').refine(
  (val) => !val.split(',').some((o) => o.trim() === '*'),
  { message: 'CORS_ORIGINS must not contain wildcard (*). Specify explicit origins.' },
);

describe('CORS origin validation', () => {
  it('accepts single valid origin', () => {
    const result = corsSchema.parse('https://app.example.com');
    expect(result).toBe('https://app.example.com');
  });

  it('accepts multiple comma-separated origins', () => {
    const result = corsSchema.parse('https://app.example.com, https://admin.example.com');
    expect(result).toBe('https://app.example.com, https://admin.example.com');
  });

  it('rejects wildcard *', () => {
    expect(() => corsSchema.parse('*')).toThrow('wildcard');
  });

  it('rejects wildcard mixed with valid origins', () => {
    expect(() => corsSchema.parse('https://app.example.com, *')).toThrow('wildcard');
  });

  it('accepts localhost for development', () => {
    const result = corsSchema.parse('http://localhost:5173');
    expect(result).toBe('http://localhost:5173');
  });

  it('uses default when not provided', () => {
    const result = corsSchema.parse(undefined);
    expect(result).toBe('http://localhost:5173');
  });
});
