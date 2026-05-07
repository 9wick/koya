import { Hono } from 'hono';

import { createContainer } from '../internal/container';
import { LifecycleManager } from '../lifecycle';
import { buildRoutes } from '../internal/route-builder';
import type {
  ErrorHandlerClass,
  ErrorHandlerInstance,
  MiddlewareInput,
  RequestContext,
} from '../middleware/types';
import { createSchedulerRunner, type SchedulerRunner } from '../scheduler/runner';

import { handleError } from './error-handler';

type ControllerClass = new (...args: never[]) => object;
type SchedulerClass = new (...args: never[]) => object;
type Resolver = { get: <T extends object>(cls: new (...args: never[]) => T) => T };

export type CreateHttpAppOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly schedulers?: readonly SchedulerClass[];
  readonly middlewares?: readonly MiddlewareInput[];
  readonly errorHandlers?: readonly ErrorHandlerClass[];
  readonly configs?: readonly (new (...args: never[]) => object)[];
};

export type HttpApp = {
  readonly fetch: (request: Request) => Promise<Response>;
  readonly request: (input: string | Request, init?: RequestInit) => Promise<Response>;
  readonly shutdown: () => Promise<void>;
  /** @deprecated Scheduler now starts automatically. Use shutdown() to stop. */
  readonly startScheduler: () => void;
  /** @deprecated Scheduler now stops via shutdown(). */
  readonly stopScheduler: () => Promise<void>;
};

const createErrorHandler =
  (errorHandlers: readonly ErrorHandlerInstance[]) =>
  async (err: Error, c: RequestContext): Promise<Response> => {
    for (const handler of errorHandlers) {
      const result = await handler.onError(err, c);
      if (result) return result;
    }
    return handleError(err);
  };

const resolveErrorHandler = (cls: ErrorHandlerClass, resolver: Resolver): ErrorHandlerInstance => {
  const instance: ErrorHandlerInstance = resolver.get(cls);
  return instance;
};

const resolveErrorHandlers = (
  classes: readonly ErrorHandlerClass[],
  resolver: Resolver,
): ErrorHandlerInstance[] => classes.map((cls) => resolveErrorHandler(cls, resolver));

const instantiateConfigs = (
  configs: readonly (new (...args: never[]) => object)[] | undefined,
  resolver: Resolver,
): void => {
  for (const configClass of configs ?? []) {
    resolver.get(configClass);
  }
};

const registerScheduler = (
  schedulers: readonly SchedulerClass[] | undefined,
  resolver: Resolver,
  lifecycle: LifecycleManager,
): SchedulerRunner | undefined => {
  if (!schedulers || schedulers.length === 0) return undefined;
  const runner = createSchedulerRunner(schedulers, resolver);
  lifecycle.register(runner);
  return runner;
};

const setupHono = (options: CreateHttpAppOptions, resolver: Resolver): Hono => {
  // strict:false で `/echo` と `/echo/` を同一視する。joinPath が末尾スラッシュを正規化するため、
  // 利用者が `@Post('/')` と書いた場合でも `/echo/` リクエストにマッチさせる必要がある。
  const hono = new Hono({ strict: false });
  const errorHandlers = resolveErrorHandlers(options.errorHandlers ?? [], resolver);
  hono.onError(createErrorHandler(errorHandlers));
  buildRoutes(hono, options.controllers, resolver, options.middlewares ?? []);
  return hono;
};

export const createHttpApp = async (options: CreateHttpAppOptions): Promise<HttpApp> => {
  const resolver = createContainer({ configs: options.configs });
  const lifecycle = resolver.get(LifecycleManager);

  instantiateConfigs(options.configs, resolver);
  const schedulerRunner = registerScheduler(options.schedulers, resolver, lifecycle);

  try {
    await lifecycle.startup();
  } catch (error) {
    await lifecycle.shutdown();
    throw error;
  }

  let hono: Hono;
  try {
    hono = setupHono(options, resolver);
  } catch (error) {
    await lifecycle.shutdown();
    throw error;
  }

  const fetch = (req: Request): Promise<Response> => Promise.resolve(hono.fetch(req));
  const request = (input: string | Request, init?: RequestInit): Promise<Response> => {
    const req =
      typeof input === 'string' ? new Request(new URL(input, 'http://localhost'), init) : input;
    return fetch(req);
  };

  const shutdown = async (): Promise<void> => {
    await lifecycle.shutdown();
  };

  const startScheduler = (): void => {
    // no-op: scheduler now starts automatically via lifecycle
  };

  const stopScheduler = async (): Promise<void> => {
    await schedulerRunner?.shutdown();
  };

  return { fetch, request, shutdown, startScheduler, stopScheduler };
};
