import { describe, it, expect } from 'vitest';
import {
  uuidSchema,
  paginationSchema,
  dateRangeSchema,
  ipSchema,
  portSchema,
  networkRangeSchema,
  slugSchema,
  emailSchema,
  passwordSchema,
} from '../validation.js';

describe('uuidSchema', () => {
  it('accepts a valid UUID', () => {
    expect(uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('rejects a malformed string', () => {
    expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => uuidSchema.parse('')).toThrow();
  });
});

describe('paginationSchema', () => {
  it('applies defaults when no input given', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
    expect(result.sortOrder).toBe('desc');
    expect(result.sortBy).toBeUndefined();
  });

  it('coerces string numbers', () => {
    const result = paginationSchema.parse({ page: '3', perPage: '50' });
    expect(result.page).toBe(3);
    expect(result.perPage).toBe(50);
  });

  it('rejects page < 1', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });

  it('rejects perPage > 100', () => {
    expect(() => paginationSchema.parse({ perPage: 101 })).toThrow();
  });

  it('rejects invalid sortOrder', () => {
    expect(() => paginationSchema.parse({ sortOrder: 'random' })).toThrow();
  });

  it('accepts valid sortBy string', () => {
    const result = paginationSchema.parse({ sortBy: 'created_at' });
    expect(result.sortBy).toBe('created_at');
  });
});

describe('dateRangeSchema', () => {
  it('accepts valid ISO datetime strings', () => {
    const result = dateRangeSchema.parse({
      from: '2024-01-01T00:00:00Z',
      to: '2024-12-31T23:59:59Z',
    });
    expect(result.from).toBe('2024-01-01T00:00:00Z');
    expect(result.to).toBe('2024-12-31T23:59:59Z');
  });

  it('allows optional from/to', () => {
    const result = dateRangeSchema.parse({});
    expect(result.from).toBeUndefined();
    expect(result.to).toBeUndefined();
  });

  it('rejects non-datetime strings', () => {
    expect(() => dateRangeSchema.parse({ from: 'not-a-date' })).toThrow();
  });
});

describe('ipSchema', () => {
  it.each([
    '192.168.1.1',
    '0.0.0.0',
    '255.255.255.255',
    '10.0.0.1',
    '172.16.0.1',
  ])('accepts valid IP: %s', (ip) => {
    expect(ipSchema.parse(ip)).toBe(ip);
  });

  it.each([
    '256.1.1.1',
    'abc',
    '1.2.3',
    '1.2.3.4.5',
    '',
    '192.168.1.1/24',
  ])('rejects invalid IP: %s', (ip) => {
    expect(() => ipSchema.parse(ip)).toThrow();
  });
});

describe('portSchema', () => {
  it('accepts port 1', () => {
    expect(portSchema.parse(1)).toBe(1);
  });

  it('accepts port 65535', () => {
    expect(portSchema.parse(65535)).toBe(65535);
  });

  it('coerces string to number', () => {
    expect(portSchema.parse('8080')).toBe(8080);
  });

  it('rejects port 0', () => {
    expect(() => portSchema.parse(0)).toThrow();
  });

  it('rejects port 65536', () => {
    expect(() => portSchema.parse(65536)).toThrow();
  });

  it('rejects negative port', () => {
    expect(() => portSchema.parse(-1)).toThrow();
  });
});

describe('networkRangeSchema', () => {
  it.each([
    '192.168.1.0/24',
    '10.0.0.0/8',
    '172.16.0.0/16',
    '0.0.0.0/0',
    '255.255.255.255/32',
  ])('accepts valid CIDR: %s', (cidr) => {
    expect(networkRangeSchema.parse(cidr)).toBe(cidr);
  });

  it.each([
    '192.168.1.0/33',
    '192.168.1.0',
    '256.0.0.0/24',
    'abc/24',
  ])('rejects invalid CIDR: %s', (cidr) => {
    expect(() => networkRangeSchema.parse(cidr)).toThrow();
  });
});

describe('slugSchema', () => {
  it.each([
    'my-slug',
    'a1',
    'test-123-slug',
    'ab',
  ])('accepts valid slug: %s', (slug) => {
    expect(slugSchema.parse(slug)).toBe(slug);
  });

  it('rejects uppercase', () => {
    expect(() => slugSchema.parse('MySlug')).toThrow();
  });

  it('rejects spaces', () => {
    expect(() => slugSchema.parse('my slug')).toThrow();
  });

  it('rejects leading hyphen', () => {
    expect(() => slugSchema.parse('-leading')).toThrow();
  });

  it('rejects trailing hyphen', () => {
    expect(() => slugSchema.parse('trailing-')).toThrow();
  });

  it('rejects single character (min 2)', () => {
    expect(() => slugSchema.parse('a')).toThrow();
  });

  it('rejects string longer than 64 chars', () => {
    expect(() => slugSchema.parse('a'.repeat(65))).toThrow();
  });
});

describe('emailSchema', () => {
  it('accepts valid email', () => {
    expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
  });

  it('rejects invalid email', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });

  it('rejects email longer than 255 chars', () => {
    expect(() => emailSchema.parse(`${'a'.repeat(250)}@b.com`)).toThrow();
  });
});

describe('passwordSchema', () => {
  it('accepts 8 character password', () => {
    expect(passwordSchema.parse('12345678')).toBe('12345678');
  });

  it('accepts 128 character password', () => {
    const pw = 'a'.repeat(128);
    expect(passwordSchema.parse(pw)).toBe(pw);
  });

  it('rejects password shorter than 8', () => {
    expect(() => passwordSchema.parse('1234567')).toThrow();
  });

  it('rejects password longer than 128', () => {
    expect(() => passwordSchema.parse('a'.repeat(129))).toThrow();
  });
});
