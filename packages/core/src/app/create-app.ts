import { createContainer } from '../internal/container';
import { LifecycleManager } from '../lifecycle';
import type { CommandClass } from '../command/types';

import { httpReady, createFetch, createRequest, type HttpBuiltApp } from './http';
import { commandReady, type CommandBuiltApp } from './command';
import { schedulerReady, type SchedulerBuiltApp } from './scheduler';
import {
  configReady,
  applyOverrides,
  configHasToken,
  createReplaceConfig,
  type AnyConfigClass,
  type AnyConstructorClass,
  type Resolver,
} from './config';
import type {
  App,
  CreateAppOptions,
  ReadyOptions,
  ReadyResult,
} from './types';

type BuiltApp = {
  readonly http: HttpBuiltApp | undefined;
  readonly command: CommandBuiltApp | undefined;
  readonly scheduler: SchedulerBuiltApp | undefined;
  readonly lifecycle: LifecycleManager;
  readonly resolver: Resolver;
};

type BuildAppOptions = {
  readonly appOptions: CreateAppOptions;
  readonly configOverrides: ReadonlyMap<AnyConstructorClass, AnyConstructorClass>;
  readonly warmup: boolean;
};

type LifecycleResult = { ok: true } | { ok: false; cleanup: () => Promise<void> };

const lifecycleReady = async (lifecycle: LifecycleManager): Promise<LifecycleResult> =>
  lifecycle
    .startupPending()
    .then((): LifecycleResult => ({ ok: true }))
    .catch((): LifecycleResult => ({ ok: false, cleanup: () => lifecycle.shutdown() }));

const buildApp = async (options: BuildAppOptions): Promise<BuiltApp> => {
  const { appOptions, configOverrides, warmup } = options;

  const effectiveConfigs = applyOverrides(appOptions.configs ?? [], configOverrides);
  const resolver = createContainer({ configs: effectiveConfigs });
  const lifecycle = resolver.get(LifecycleManager);

  configReady({ configs: effectiveConfigs, resolver });
  const scheduler = schedulerReady({ schedulers: appOptions.schedulers, resolver, lifecycle });

  const lifecycleResult = await lifecycleReady(lifecycle);
  if (!lifecycleResult.ok) {
    await lifecycleResult.cleanup();
    throw new Error('Lifecycle startup failed');
  }

  const http = appOptions.http
    ? await httpReady({ httpOptions: appOptions.http, resolver, lifecycle, warmup })
    : undefined;

  const command = commandReady(appOptions.commands);

  return { http, command, scheduler, lifecycle, resolver };
};

const awaitSafe = async (p: Promise<unknown>): Promise<void> => {
  await p.catch(() => {});
};

type AppState = {
  built: BuiltApp | undefined;
  disposed: boolean;
  readyPromise: Promise<ReadyResult> | undefined;
  readonly configOverrides: Map<AnyConfigClass, AnyConfigClass>;
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
    state.readyPromise = buildApp({
      appOptions: options,
      configOverrides: state.configOverrides,
      warmup,
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
  const fetch = createFetch(() => state.built?.http);
  const baseApp = createBaseApp(options, state);
  const httpMethods = options.http ? { fetch, request: createRequest(fetch) } : {};
  const commandMethods = options.commands?.length
    ? {
        hasCommand: (name: string) => state.built?.command?.hasCommand(name) ?? false,
        getCommands: () => state.built?.command?.getCommands() ?? new Map<string, CommandClass>(),
      }
    : {};

  return { ...baseApp, ...httpMethods, ...commandMethods };
};

export function createApp<TOptions extends CreateAppOptions>(options: TOptions): App<TOptions>;
export function createApp(options: CreateAppOptions): App<CreateAppOptions> {
  if (!options.http && !options.commands?.length) {
    throw new Error('createApp requires at least http or commands option');
  }

  const state: AppState = {
    built: undefined,
    disposed: false,
    readyPromise: undefined,
    configOverrides: new Map<AnyConfigClass, AnyConfigClass>(),
  };

  return buildAppObject(options, state);
}
