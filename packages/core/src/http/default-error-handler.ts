import { inject } from '@needle-di/core';
import { HTTPException } from 'hono/http-exception';

import { ErrorHandler } from '../decorators/error-handler';
import { EnvConfig } from '../modules/env';
import type { RequestContext } from '../middleware/types';

@ErrorHandler
export class DefaultErrorHandler {
  private envConfig: EnvConfig;

  constructor() {
    const injected: EnvConfig[] = inject(EnvConfig, { multi: true });
    this.envConfig = injected[0] ?? new EnvConfig();
  }

  onError(err: Error, _c: RequestContext): Response {
    if (err instanceof HTTPException) return err.getResponse();
    const isDevelopment = this.envConfig.get('NODE_ENV') === 'development';
    const message = isDevelopment ? err.message : 'internal server error';
    return Response.json({ code: 'INTERNAL_ERROR', message }, { status: 500 });
  }
}
