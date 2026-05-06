import { Injectable, injectConfig } from '@zeltjs/core';
import type { RequestContext, Next } from '@zeltjs/core';

import { JwtConfig } from './jwt.config';
import { JwtService } from './jwt.service';

@Injectable()
export class JwtMiddleware {
  constructor(
    private readonly jwtService = new JwtService(injectConfig(JwtConfig)),
    private readonly config = injectConfig(JwtConfig),
  ) {}

  async use(c: RequestContext, next: Next): Promise<Response | undefined> {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice(7);
    const verified = await this.jwtService.verify(token).then(
      (payload) => ({ ok: true as const, payload }),
      () => ({ ok: false as const }),
    );

    if (!verified.ok) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await this.config.resolveUser(verified.payload);
    await next();
    return undefined;
  }
}
