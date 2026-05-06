import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { Container } from '@needle-di/core';
import type { RequestContext, Next } from '@zeltjs/core';

import { JwtMiddleware } from './jwt.middleware';
import { JwtService } from './jwt.service';
import { JwtConfig } from './jwt.config';
import type { JwtPayload } from './jwt.types';

class TestJwtConfig extends JwtConfig {
  override get secret(): string {
    return 'test-secret-key-for-testing-only';
  }

  override get resolveUser() {
    return async (payload: JwtPayload) => ({
      user: payload.sub,
      roles: ['user', 'admin'] as string[],
    });
  }
}

describe('JwtMiddleware', () => {
  let app: Hono;
  let jwtService: JwtService;
  let middleware: JwtMiddleware;

  beforeEach(() => {
    const container = new Container();
    container.bind({ provide: JwtConfig.Token, useClass: TestJwtConfig });
    jwtService = container.get(JwtService);
    middleware = container.get(JwtMiddleware);

    app = new Hono();
    app.use('/*', (c, next) => middleware.use(c as RequestContext, next as Next));
    app.get('/protected', (c) => c.json({ message: 'success' }));
  });

  it('should return 401 when no Authorization header', async () => {
    const res = await app.request('/protected');

    expect(res.status).toBe(401);
  });

  it('should return 401 when Authorization header is not Bearer', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: 'Basic abc123' },
    });

    expect(res.status).toBe(401);
  });

  it('should return 401 when token is invalid', async () => {
    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer invalid-token' },
    });

    expect(res.status).toBe(401);
  });

  it('should allow request with valid token', async () => {
    const token = await jwtService.sign({ sub: 'user-123' });
    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { message: string };
    expect(body.message).toBe('success');
  });

  it('should return 401 for expired token', async () => {
    const expiredContainer = new Container();
    class ExpiredConfig extends JwtConfig {
      override get secret(): string {
        return 'test-secret-key-for-testing-only';
      }
      override get expiresIn(): string {
        return '0s';
      }
    }
    expiredContainer.bind({ provide: JwtConfig.Token, useClass: ExpiredConfig });
    const expiredJwtService = expiredContainer.get(JwtService);
    const token = await expiredJwtService.sign({ sub: 'user-123' });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const res = await app.request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(401);
  });
});
