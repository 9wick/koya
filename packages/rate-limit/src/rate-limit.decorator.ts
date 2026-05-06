import { Injectable, inject, UseMiddleware } from '@zeltjs/core';
import type { MiddlewareClass, RequestContext, Next } from '@zeltjs/core';

import { TooManyRequestsException } from './errors';
import { RateLimiter } from './rate-limiter.service';
import type { RateLimitOptions } from './types';

const createRateLimitMiddlewareClass = (opts: RateLimitOptions): MiddlewareClass => {
  @Injectable()
  class RateLimitMiddleware {
    private readonly limiter: RateLimiter;

    constructor(limiter = inject(RateLimiter)) {
      this.limiter = limiter;
    }

    async use(c: RequestContext, next: Next): Promise<undefined> {
      const key = typeof opts.key === 'string' ? opts.key : opts.key();
      const result = await this.limiter.hit(key, {
        limit: opts.limit,
        windowSec: opts.windowSec,
      });

      c.header('X-RateLimit-Limit', String(result.limit));
      c.header('X-RateLimit-Remaining', String(result.remaining));

      if (!result.allowed) throw new TooManyRequestsException(result);
      await next();
      return undefined;
    }
  }

  return RateLimitMiddleware;
};

export const RateLimit = (opts: RateLimitOptions) => {
  const middlewareClass = createRateLimitMiddlewareClass(opts);
  return UseMiddleware(middlewareClass);
};
