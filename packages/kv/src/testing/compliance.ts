import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AtomicKVDriver, AtomicKVStore, KVDriver, KVStore } from '../types';

export const runKVStoreComplianceTests = (factory: () => KVDriver): void => {
  describe('KVStore compliance', () => {
    let store: KVStore;

    beforeEach(() => {
      store = factory().namespace('compliance:');
    });

    it('get returns undefined for missing key', async () => {
      expect(await store.get('missing')).toBeUndefined();
    });

    it('set + get round-trips a JSON object', async () => {
      await store.set('foo', { a: 1, nested: ['x', 'y'] });
      expect(await store.get('foo')).toEqual({ a: 1, nested: ['x', 'y'] });
    });

    it('del removes the key', async () => {
      await store.set('foo', 1);
      await store.del('foo');
      expect(await store.has('foo')).toBe(false);
    });

    it('has reflects existence', async () => {
      expect(await store.has('foo')).toBe(false);
      await store.set('foo', 1);
      expect(await store.has('foo')).toBe(true);
    });

    it('chained namespace concatenates prefixes', async () => {
      const sub = store.namespace('sub:');
      await sub.set('foo', 1);
      // when we read via parent prefix + sub key, we should see the value
      const directParent = factory().namespace('compliance:sub:');
      expect(await directParent.get('foo')).toBe(1);
    });

    it('empty namespace prefix throws', () => {
      expect(() => store.namespace('')).toThrow();
    });
  });

  describe('KVStore TTL compliance', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('TTL expires the key', async () => {
      const store = factory().namespace('compliance-ttl:');
      await store.set('foo', 1, { ttlSec: 10 });
      vi.advanceTimersByTime(11_000);
      expect(await store.get('foo')).toBeUndefined();
    });

    it('expire returns false on missing key', async () => {
      const store = factory().namespace('compliance-ttl:');
      expect(await store.expire('missing', 5)).toBe(false);
    });
  });
};

export const runAtomicKVStoreComplianceTests = (factory: () => AtomicKVDriver): void => {
  runKVStoreComplianceTests(factory);

  describe('AtomicKVStore compliance', () => {
    let store: AtomicKVStore;

    beforeEach(() => {
      store = factory().namespace('atomic:');
    });

    it('incr starts at 1 from missing, then increments', async () => {
      expect(await store.incr('counter')).toBe(1);
      expect(await store.incr('counter')).toBe(2);
      expect(await store.incr('counter', 5)).toBe(7);
    });

    it('setnx returns true on new, false on existing', async () => {
      expect(await store.setnx('lock', 'a')).toBe(true);
      expect(await store.setnx('lock', 'b')).toBe(false);
      expect(await store.get('lock')).toBe('a');
    });

    it('delIf deletes only on value match', async () => {
      await store.set('lock', 'A');
      expect(await store.delIf('lock', 'B')).toBe(false);
      expect(await store.get('lock')).toBe('A');
      expect(await store.delIf('lock', 'A')).toBe(true);
      expect(await store.has('lock')).toBe(false);
    });

    it('incr is atomic under concurrent calls', async () => {
      await Promise.all(Array.from({ length: 50 }, () => store.incr('hot')));
      expect(await store.get('hot')).toBe(50);
    });
  });
};
