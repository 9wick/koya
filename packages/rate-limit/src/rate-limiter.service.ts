import { Injectable, injectConfig } from '@zeltjs/core';

import { RateLimitConfig } from './rate-limit.config';
import type { RateLimitResult } from './types';

const buildResult = (count: number, limit: number, windowSec: number): RateLimitResult => ({
  allowed: count <= limit,
  remaining: Math.max(0, limit - count),
  limit,
  retryAfterSec: count > limit ? windowSec : 0,
});

const openResult = (limit: number): RateLimitResult => ({
  allowed: true,
  remaining: limit,
  limit,
  retryAfterSec: 0,
});

@Injectable()
export class RateLimiter {
  constructor(private config = injectConfig(RateLimitConfig)) {}

  async hit(key: string, opts?: { limit?: number; windowSec?: number }): Promise<RateLimitResult> {
    const limit = opts?.limit ?? this.config.defaultLimit;
    const windowSec = opts?.windowSec ?? this.config.defaultWindowSec;

    const count = await this.config.store
      .incr(key, 1, { ttlSec: windowSec })
      .catch((err: unknown) => {
        // closed mode propagates errors to the global error handler (logs there);
        // open mode swallows the error so the request proceeds, but we surface it here so it isn't silent.
        if (this.config.failureMode === 'closed') throw err;
        console.warn('rate-limit: KV failure', { err, key });
        return null;
      });

    if (count === null) return openResult(limit);
    return buildResult(count, limit, windowSec);
  }

  async reset(key: string): Promise<void> {
    await this.config.store.del(key);
  }
}
