import { HTTPException } from 'hono/http-exception';

import type { RateLimitResult } from './types';

export class TooManyRequestsException extends HTTPException {
  constructor(public result: RateLimitResult) {
    super(429, {
      message: 'Too Many Requests',
      res: Response.json(
        { code: 'RATE_LIMIT_EXCEEDED', retryAfterSec: result.retryAfterSec },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'Retry-After': String(result.retryAfterSec),
          },
        },
      ),
    });
  }
}
