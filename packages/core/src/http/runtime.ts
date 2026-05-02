import { Hono } from 'hono';

import type { ResolverHandle } from '../internal/container';
import { buildRoutes } from '../internal/route-builder';

type ControllerClass = new (...args: never[]) => object;

export type HttpRuntimeOptions = {
  readonly controllers: readonly ControllerClass[];
};

export type WorkerHandler = {
  readonly fetch: (request: Request) => Response | Promise<Response>;
};

export type HttpRuntime = {
  readonly toWorker: () => WorkerHandler;
};

export const createHttpRuntime = (
  resolver: ResolverHandle,
  options: HttpRuntimeOptions,
): HttpRuntime => {
  // strict:false で `/echo` と `/echo/` を同一視する。joinPath が末尾スラッシュを正規化するため、
  // 利用者が `@Post('/')` と書いた場合でも `/echo/` リクエストにマッチさせる必要がある。
  const hono = new Hono({ strict: false });
  buildRoutes(hono, options.controllers, resolver);
  return {
    toWorker: () => ({
      fetch: (request) => hono.fetch(request),
    }),
  };
};
