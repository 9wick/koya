import { describe, expect, it, vi } from 'vitest';
import { MemoryKV, type AtomicKVStore } from '@zeltjs/kv';

import { RateLimitConfig } from './rate-limit.config';
import { RateLimiter } from './rate-limiter.service';

// NOTE: tests instantiate Config/Service directly instead of `Container().get(...)` because
// `@zeltjs/core` bundles its own copy of `@needle-di/core`, causing a `injectableSymbol` mismatch
// with the test's devDependency copy (resolves to "No provider(s) found"). Direct instantiation
// exercises the same wiring (constructor injection happens at `new` time).
const makeDefaultLimiter = () => {
  const config = new RateLimitConfig(new MemoryKV());
  return new RateLimiter(config);
};

describe('RateLimiter', () => {
  it('hit returns allowed=true within limit', async () => {
    const limiter = makeDefaultLimiter();
    const r = await limiter.hit('test:k1', { limit: 3, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.limit).toBe(3);
  });

  it('hit returns allowed=false after limit exceeded', async () => {
    const limiter = makeDefaultLimiter();
    await limiter.hit('test:k2', { limit: 2, windowSec: 60 });
    await limiter.hit('test:k2', { limit: 2, windowSec: 60 });
    const r = await limiter.hit('test:k2', { limit: 2, windowSec: 60 });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSec).toBe(60);
  });

  it('uses Config defaults when opts omitted', async () => {
    const limiter = makeDefaultLimiter();
    const r = await limiter.hit('test:k3');
    expect(r.limit).toBe(100);
  });

  it('reset deletes the counter', async () => {
    const limiter = makeDefaultLimiter();
    await limiter.hit('test:k4', { limit: 1, windowSec: 60 });
    await limiter.reset('test:k4');
    const r = await limiter.hit('test:k4', { limit: 1, windowSec: 60 });
    expect(r.allowed).toBe(true);
  });

  it('failureMode=open returns allowed when store throws', async () => {
    const failingKv = new MemoryKV();
    const failingConfig = new RateLimitConfig(failingKv);
    Object.defineProperty(failingConfig, 'store', {
      value: {
        incr: vi.fn().mockRejectedValue(new Error('boom')),
        del: vi.fn(),
      } as unknown as AtomicKVStore,
    });
    const limiter = new RateLimiter(failingConfig);
    const r = await limiter.hit('test:k5', { limit: 5, windowSec: 60 });
    expect(r.allowed).toBe(true);
  });

  it('failureMode=closed propagates store errors', async () => {
    const failingKv = new MemoryKV();
    const failingConfig = new RateLimitConfig(failingKv);
    Object.defineProperty(failingConfig, 'store', {
      value: {
        incr: vi.fn().mockRejectedValue(new Error('boom')),
        del: vi.fn(),
      } as unknown as AtomicKVStore,
    });
    failingConfig.failureMode = 'closed';
    const limiter = new RateLimiter(failingConfig);
    await expect(limiter.hit('test:k6', { limit: 5, windowSec: 60 })).rejects.toThrow('boom');
  });
});
