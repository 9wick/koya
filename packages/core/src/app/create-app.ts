import type { Hono } from 'hono';

import { createContainer } from '../internal/container';
import { LifecycleManager } from '../lifecycle';
import type { SchedulerRunner } from '../scheduler/runner';
import type { ConfigClass } from '../config';
import { findRootConfigToken } from '../config/token';
import type { CommandClass } from '../command/types';

import { initializeHttp, createFetch, createRequest, type InitializeHttpOptions } from './http';
import { validateCommands, createHasCommand, createGetCommands } from './command';
import { registerScheduler } from './scheduler';
import type {
  App,
  CreateAppOptions,
  ReadyOptions,
  ReadyResult,
  ControllerClass,
} from './types';

type AnyConfigClass = ConfigClass<object>;
type AnyConstructorClass = new (...args: never[]) => object;
type Resolver = { get: <T extends object>(cls: new (...args: never[]) => T) => T };

const instantiateConfigs = (
  configs: readonly AnyConstructorClass[] | undefined,
  resolver: Resolver,
): void => {
  for (const configClass of configs ?? []) {
    resolver.get(configClass);
  }
};

type BuiltApp = {
  readonly hono: Hono | undefined;
  readonly lifecycle: LifecycleManager;
  readonly schedulerRunner: SchedulerRunner | undefined;
  readonly resolver: Resolver;
  readonly controllers: readonly ControllerClass[];
  readonly commandMap: ReadonlyMap<string, CommandClass>;
};

type BuildAppInternalOptions = {
  readonly appOptions: CreateAppOptions;
  readonly configOverrides: ReadonlyMap<AnyConstructorClass, AnyConstructorClass>;
  readonly warmup: boolean;
  readonly commandMap: ReadonlyMap<string, CommandClass>;
};

const applyOverrides = (
  configs: readonly AnyConstructorClass[],
  overrides: ReadonlyMap<AnyConstructorClass, AnyConstructorClass>,
): readonly AnyConstructorClass[] => {
  if (overrides.size === 0) return configs;
  return configs.map((cfg) => overrides.get(cfg) ?? cfg);
};

type LifecycleResult = { ok: true } | { ok: false; cleanup: () => Promise<void> };

const initializeLifecycle = async (lifecycle: LifecycleManager): Promise<LifecycleResult> =>
  lifecycle
    .startupPending()
    .then((): LifecycleResult => ({ ok: true }))
    .catch((): LifecycleResult => ({ ok: false, cleanup: () => lifecycle.shutdown() }));

const buildAppInternal = async (buildOptions: BuildAppInternalOptions): Promise<BuiltApp> => {
  const { appOptions, configOverrides, warmup, commandMap } = buildOptions;
  const effectiveConfigs = applyOverrides(appOptions.configs ?? [], configOverrides);
  const resolver = createContainer({ configs: effectiveConfigs });
  const lifecycle = resolver.get(LifecycleManager);

  instantiateConfigs(effectiveConfigs, resolver);
  const schedulerRunner = registerScheduler(appOptions.schedulers, resolver, lifecycle);

  const lifecycleResult = await initializeLifecycle(lifecycle);
  if (!lifecycleResult.ok) {
    await lifecycleResult.cleanup();
    throw new Error('Lifecycle startup failed');
  }

  const hono = appOptions.http
    ? await initializeHttp(
        { httpOptions: appOptions.http, resolver, lifecycle } as InitializeHttpOptions,
        warmup,
      )
    : undefined;

  return {
    hono,
    lifecycle,
    schedulerRunner,
    resolver,
    controllers: appOptions.http?.controllers ?? [],
    commandMap,
  };
};

const assertConfigToken = (
  tokenClass: AnyConfigClass,
  configs: readonly AnyConstructorClass[],
): void => {
  const targetRoot = findRootConfigToken(tokenClass);
  const hasToken = configs.some(
    (cfg) => cfg === tokenClass || findRootConfigToken(cfg) === targetRoot,
  );
  if (!hasToken) {
    throw new Error(`Cannot replaceConfig(): token ${tokenClass.name} is not in configs`);
  }
};

const awaitSafe = async (p: Promise<unknown>): Promise<void> => {
  await p.catch(() => {});
};

const configHasToken = (
  configs: readonly AnyConstructorClass[],
  tokenClass: AnyConfigClass,
): boolean => {
  const targetRoot = findRootConfigToken(tokenClass);
  return configs.some((cfg) => cfg === tokenClass || findRootConfigToken(cfg) === targetRoot);
};

type AppState = {
  built: BuiltApp | undefined;
  disposed: boolean;
  readyPromise: Promise<ReadyResult> | undefined;
  readonly configOverrides: Map<AnyConfigClass, AnyConfigClass>;
  readonly commandMap: ReadonlyMap<string, CommandClass>;
};

const createReplaceConfig =
  (options: CreateAppOptions, state: AppState) =>
  (token: AnyConfigClass, replacement: AnyConfigClass): void => {
    if (state.disposed) throw new Error('Cannot replaceConfig() after shutdown()');
    if (state.built) throw new Error('Cannot replaceConfig() after ready()');
    assertConfigToken(token, options.configs ?? []);
    state.configOverrides.set(token, replacement);
  };

const createReadyResult = (resolver: Resolver): ReadyResult => ({
  get: <T extends object>(cls: new (...args: never[]) => T): T => resolver.get(cls),
});

const createReady =
  (options: CreateAppOptions, state: AppState) =>
  async (readyOptions?: ReadyOptions): Promise<ReadyResult> => {
    if (state.disposed) throw new Error('Cannot ready() after shutdown()');
    if (state.readyPromise) return state.readyPromise;

    const warmup = readyOptions?.warmup ?? false;
    state.readyPromise = buildAppInternal({
      appOptions: options,
      configOverrides: state.configOverrides,
      warmup,
      commandMap: state.commandMap,
    }).then((b) => {
      state.built = b;
      return createReadyResult(b.resolver);
    });
    return state.readyPromise;
  };

const createShutdown = (state: AppState) => async (): Promise<void> => {
  if (state.disposed) return;
  state.disposed = true;
  if (state.readyPromise) await awaitSafe(state.readyPromise);
  if (state.built) {
    await state.built.lifecycle.shutdown();
    state.built = undefined;
  }
};

const createBaseApp = (options: CreateAppOptions, state: AppState) => ({
  shutdown: createShutdown(state),
  ready: createReady(options, state),
  hasConfig: (token: AnyConfigClass): boolean => configHasToken(options.configs ?? [], token),
  replaceConfig: createReplaceConfig(options, state),
});

const buildAppObject = (options: CreateAppOptions, state: AppState): App<CreateAppOptions> => {
  const fetch = createFetch(() => state.built?.hono);
  const baseApp = createBaseApp(options, state);
  const httpMethods = options.http ? { fetch, request: createRequest(fetch) } : {};
  const commandMethods = options.commands?.length
    ? { hasCommand: createHasCommand(state.commandMap), getCommands: createGetCommands(state.commandMap) }
    : {};

  return { ...baseApp, ...httpMethods, ...commandMethods };
};

export function createApp<TOptions extends CreateAppOptions>(options: TOptions): App<TOptions>;
export function createApp(options: CreateAppOptions): App<CreateAppOptions> {
  if (!options.http && !options.commands?.length) {
    throw new Error('createApp requires at least http or commands option');
  }

  const commandMap = options.commands ? validateCommands(options.commands) : new Map();

  const state: AppState = {
    built: undefined,
    disposed: false,
    readyPromise: undefined,
    configOverrides: new Map<AnyConfigClass, AnyConfigClass>(),
    commandMap,
  };

  return buildAppObject(options, state);
}
