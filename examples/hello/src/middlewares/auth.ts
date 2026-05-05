import { Middleware, inject, Injectable } from '@koya/core';
import type { KoyaContext, KoyaNext } from '@koya/core';
import { jwt } from 'hono/jwt';

@Injectable()
export class AuthConfig {
  readonly secret = 'dev-secret';
}

@Middleware
export class AuthMiddleware {
  constructor(private config = inject(AuthConfig)) {}

  async use(c: KoyaContext, next: KoyaNext): Promise<Response | undefined> {
    const jwtMiddleware = jwt({ secret: this.config.secret, alg: 'HS256' });
    const result = await jwtMiddleware(c, next);
    return result ?? undefined;
  }
}
