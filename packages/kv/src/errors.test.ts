import { describe, expect, it } from 'vitest';

import { emptyNamespace, invalidTtl, invalidValue, storeOperationFailed } from './errors';

describe('errors', () => {
  it('invalidTtl returns INVALID_TTL with correct fields', () => {
    const e = invalidTtl(0);
    expect(e.type).toBe('INVALID_TTL');
    if (e.type === 'INVALID_TTL') {
      expect(e.ttlSec).toBe(0);
    }
    expect(e.message).toContain('0');
  });

  it('invalidTtl with negative value', () => {
    const e = invalidTtl(-5);
    expect(e.type).toBe('INVALID_TTL');
    if (e.type === 'INVALID_TTL') {
      expect(e.ttlSec).toBe(-5);
    }
  });

  it('emptyNamespace returns EMPTY_NAMESPACE', () => {
    const e = emptyNamespace();
    expect(e.type).toBe('EMPTY_NAMESPACE');
    expect(e.message).toContain('empty');
  });

  it('invalidValue returns INVALID_VALUE with reason', () => {
    const e = invalidValue('cannot serialize undefined');
    expect(e.type).toBe('INVALID_VALUE');
    if (e.type === 'INVALID_VALUE') {
      expect(e.reason).toBe('cannot serialize undefined');
    }
    expect(e.message).toContain('cannot serialize undefined');
  });

  it('storeOperationFailed returns STORE_OPERATION_FAILED with Error cause', () => {
    const cause = new Error('redis down');
    const e = storeOperationFailed('get', cause);
    expect(e.type).toBe('STORE_OPERATION_FAILED');
    if (e.type === 'STORE_OPERATION_FAILED') {
      expect(e.op).toBe('get');
      expect(e.cause).toBe(cause);
    }
    expect(e.message).toContain('redis down');
  });

  it('storeOperationFailed with non-Error cause uses String()', () => {
    const e = storeOperationFailed('set', 'timeout');
    expect(e.type).toBe('STORE_OPERATION_FAILED');
    expect(e.message).toContain('timeout');
  });
});
