import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { HttpMetadata } from '../generate-openapi';
import { generateOpenApi } from '../generate-openapi';

const createMockApp = (metadata: HttpMetadata) => ({
  getMetadata: () => metadata,
});

describe('generateOpenApi', () => {
  it('writes openapi.json with basic structure', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'zelt-openapi-'));
    const app = createMockApp({
      controllers: [
        {
          basePath: '/users',
          sourceFile: '/app/src/user.controller.ts',
          name: 'UserController',
          routes: [
            { method: 'GET', path: '/:id', fullPath: '/users/:id', methodName: 'show' },
            { method: 'POST', path: '/', fullPath: '/users', methodName: 'create' },
          ],
        },
      ],
    });

    const result = await generateOpenApi(app, { distDir: dist });

    expect(result.changed).toBe(true);

    const parsed = JSON.parse(await readFile(join(dist, 'openapi.json'), 'utf8')) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(parsed.openapi).toBe('3.1.0');
    expect(parsed.paths['/users/{id}']).toBeDefined();
    expect(parsed.paths['/users']).toBeDefined();
  });

  it('returns changed=false on second run with no changes', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'zelt-openapi-'));
    const app = createMockApp({
      controllers: [
        {
          basePath: '/items',
          sourceFile: '/app/src/item.controller.ts',
          name: 'ItemController',
          routes: [{ method: 'GET', path: '/', fullPath: '/items', methodName: 'list' }],
        },
      ],
    });

    await generateOpenApi(app, { distDir: dist });
    const secondResult = await generateOpenApi(app, { distDir: dist });

    expect(secondResult.changed).toBe(false);
  });

  it('converts path params from :id to {id} format', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'zelt-openapi-'));
    const app = createMockApp({
      controllers: [
        {
          basePath: '/posts',
          sourceFile: '/app/src/post.controller.ts',
          name: 'PostController',
          routes: [
            {
              method: 'GET',
              path: '/:postId/comments/:commentId',
              fullPath: '/posts/:postId/comments/:commentId',
              methodName: 'getComment',
            },
          ],
        },
      ],
    });

    await generateOpenApi(app, { distDir: dist });

    const parsed = JSON.parse(await readFile(join(dist, 'openapi.json'), 'utf8')) as {
      paths: Record<string, unknown>;
    };
    expect(parsed.paths['/posts/{postId}/comments/{commentId}']).toBeDefined();
  });

  it('includes custom title and version', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'zelt-openapi-'));
    const app = createMockApp({ controllers: [] });

    await generateOpenApi(app, {
      distDir: dist,
      title: 'My API',
      version: '1.0.0',
    });

    const parsed = JSON.parse(await readFile(join(dist, 'openapi.json'), 'utf8')) as {
      info: { title: string; version: string };
    };
    expect(parsed.info.title).toBe('My API');
    expect(parsed.info.version).toBe('1.0.0');
  });
});
