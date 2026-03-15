import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, unwrap, unwrapOr, tryCatch } from '../result.js';

describe('Result type', () => {
  describe('ok()', () => {
    it('should create a success result', () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
    });
  });

  describe('err()', () => {
    it('should create an error result', () => {
      const error = new Error('something went wrong');
      const result = err(error);
      expect(result).toEqual({ ok: false, error });
    });
  });

  describe('isOk / isErr', () => {
    it('isOk returns true for ok result', () => {
      expect(isOk(ok('value'))).toBe(true);
    });

    it('isOk returns false for err result', () => {
      expect(isOk(err(new Error('fail')))).toBe(false);
    });

    it('isErr returns true for err result', () => {
      expect(isErr(err(new Error('fail')))).toBe(true);
    });

    it('isErr returns false for ok result', () => {
      expect(isErr(ok('value'))).toBe(false);
    });
  });

  describe('unwrap', () => {
    it('should return value on ok', () => {
      expect(unwrap(ok('hello'))).toBe('hello');
    });

    it('should throw on err with Error instance', () => {
      expect(() => unwrap(err(new Error('boom')))).toThrow('boom');
    });

    it('should throw wrapped error on err with non-Error value', () => {
      expect(() => unwrap(err('string error'))).toThrow('string error');
    });
  });

  describe('unwrapOr', () => {
    it('should return value on ok', () => {
      expect(unwrapOr(ok(10), 0)).toBe(10);
    });

    it('should return fallback on err', () => {
      expect(unwrapOr(err(new Error('fail')), 0)).toBe(0);
    });
  });

  describe('tryCatch', () => {
    it('should wrap a successful async function in ok', async () => {
      const result = await tryCatch(async () => 'success');
      expect(isOk(result)).toBe(true);
      expect(unwrap(result)).toBe('success');
    });

    it('should wrap a failing async function in err', async () => {
      const result = await tryCatch(async () => {
        throw new Error('async failure');
      });
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error.message).toBe('async failure');
      }
    });

    it('should wrap non-Error throws in an Error', async () => {
      const result = await tryCatch(async () => {
        throw 'plain string';
      });
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('plain string');
      }
    });
  });
});
