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
import type { ConfigClass } from '../config';
import { findConfigToken } from '../config';

import { handleError } from './error-handler';

type AnyConfigClass = ConfigClass<object>;
type AnyConstructorClass = new (...args: never[]) => object;

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
  readonly ready: () => Promise<void>;
  readonly replaceConfig: (token: AnyConfigClass, replacement: AnyConfigClass) => void;
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
  configs: readonly AnyConstructorClass[] | undefined,
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

type BuiltApp = {
  readonly hono: Hono;
  readonly lifecycle: LifecycleManager;
  readonly schedulerRunner: SchedulerRunner | undefined;
};

const buildApp = async (
  options: CreateHttpAppOptions,
  configOverrides: ReadonlyMap<AnyConstructorClass, AnyConstructorClass>,
): Promise<BuiltApp> => {
  const effectiveConfigs = applyOverrides(options.configs ?? [], configOverrides);
  const resolver = createContainer({ configs: effectiveConfigs });
  const lifecycle = resolver.get(LifecycleManager);

  instantiateConfigs(effectiveConfigs, resolver);
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

  return { hono, lifecycle, schedulerRunner };
};

const applyOverrides = (
  configs: readonly AnyConstructorClass[],
  overrides: ReadonlyMap<AnyConstructorClass, AnyConstructorClass>,
): readonly AnyConstructorClass[] => {
  if (overrides.size === 0) return configs;
  return configs.map((cfg) => overrides.get(cfg) ?? cfg);
};

const assertConfigToken = (
  token: AnyConfigClass,
  configs: readonly AnyConstructorClass[],
): void => {
  const hasToken = configs.some((cfg) => cfg === token || findConfigToken(cfg) === token);
  if (!hasToken) {
    throw new Error(`Cannot replaceConfig(): token ${token.name} is not in configs`);
  }
};

const awaitSafe = async (p: Promise<void>): Promise<void> => {
  try {
    await p;
  } catch {
    // ignore: callers handle the error state independently
  }
};

export const createHttpApp = (options: CreateHttpAppOptions): HttpApp => {
  let built: BuiltApp | undefined;
  let disposed = false;
  let readyPromise: Promise<void> | undefined;
  const configOverrides = new Map<AnyConfigClass, AnyConfigClass>();

  const replaceConfig = (token: AnyConfigClass, replacement: AnyConfigClass): void => {
    if (disposed) throw new Error('Cannot replaceConfig() after shutdown()');
    if (built) throw new Error('Cannot replaceConfig() after ready()');
    assertConfigToken(token, options.configs ?? []);
    configOverrides.set(token, replacement);
  };

  const ready = async (): Promise<void> => {
    if (disposed) throw new Error('Cannot ready() after shutdown()');
    if (built) return;
    if (readyPromise) return readyPromise;
    readyPromise = buildApp(options, configOverrides).then((b) => {
      built = b;
    });
    return readyPromise;
  };

  const shutdown = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    // Wait for any in-flight ready() to complete before shutting down
    if (readyPromise) await awaitSafe(readyPromise);
    if (built) {
      await built.lifecycle.shutdown();
      built = undefined;
    }
  };

  const fetch = async (req: Request): Promise<Response> => {
    if (!built) throw new Error('Cannot fetch() before ready()');
    return built.hono.fetch(req);
  };

  const request = (input: string | Request, init?: RequestInit): Promise<Response> => {
    const req =
      typeof input === 'string' ? new Request(new URL(input, 'http://localhost'), init) : input;
    return fetch(req);
  };

  const startScheduler = (): void => {
    // no-op: scheduler now starts automatically via lifecycle
  };

  const stopScheduler = async (): Promise<void> => {
    await built?.schedulerRunner?.shutdown();
  };

  return { fetch, request, shutdown, ready, replaceConfig, startScheduler, stopScheduler };
};
