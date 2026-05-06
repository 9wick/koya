import { HTTPException } from 'hono/http-exception';
import { describe, expect, it } from 'vitest';

import { TooManyRequestsException } from './errors';

describe('TooManyRequestsException', () => {
  it('extends HTTPException with status 429', () => {
    const err = new TooManyRequestsException({
      allowed: false,
      remaining: 0,
      limit: 5,
      retryAfterSec: 60,
    });
    expect(err).toBeInstanceOf(HTTPException);
    expect(err.status).toBe(429);
  });

  it('returns a Response with rate-limit headers and JSON body', async () => {
    const err = new TooManyRequestsException({
      allowed: false,
      remaining: 0,
      limit: 5,
      retryAfterSec: 60,
    });
    const res = err.getResponse();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(await res.json()).toEqual({ code: 'RATE_LIMIT_EXCEEDED', retryAfterSec: 60 });
  });
});
