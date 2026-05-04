import { Middleware, inject, Injectable } from '@koya/core';
import type { Context, Env, Input, Next } from 'hono';
import { jwt } from 'hono/jwt';

@Injectable()
export class AuthConfig {
  readonly secret = 'dev-secret';
}

@Middleware
export class AuthMiddleware {
  constructor(private config = inject(AuthConfig)) {}

  async use(c: Context<Env, string, Input>, next: Next): Promise<Response | undefined> {
    const jwtMiddleware = jwt({ secret: this.config.secret, alg: 'HS256' });
    const result = await jwtMiddleware(c, next);
    return result ?? undefined;
  }
}
