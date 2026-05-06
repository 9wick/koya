// packages/contract/src/load-config.ts
import { access } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { okAsync, errAsync, ResultAsync } from 'neverthrow';

import type { ConfigError } from './errors';
import type { GenerateClientOptions } from './config/options';

const DEFAULT_CONFIG_NAMES = [
  'zelt.config.ts',
  'zelt.config.js',
  'zelt.config.mts',
  'zelt.config.mjs',
] as const;

const exists = async (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

export const findConfigFile = async (cwd: string): Promise<string | undefined> => {
  for (const name of DEFAULT_CONFIG_NAMES) {
    const p = resolve(cwd, name);
    if (await exists(p)) return p;
  }
  return undefined;
};

function narrowConfig(value: unknown): GenerateClientOptions;
function narrowConfig(value: unknown): unknown {
  return value;
}

const dynamicImport = async (url: string): Promise<unknown> => import(url);

export const loadConfig = (path: string): ResultAsync<GenerateClientOptions, ConfigError> => {
  const abs = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const url = pathToFileURL(abs).href;

  return ResultAsync.fromPromise(dynamicImport(url), () => ({
    type: 'INVALID_CONFIG_EXPORT' as const,
    path,
  })).andThen((mod) => {
    if (typeof mod !== 'object' || mod === null) {
      return errAsync({ type: 'INVALID_CONFIG_EXPORT' as const, path });
    }
    const namespace: Record<string, unknown> = { ...mod };
    const defaultKey = 'default';
    const cfg = namespace[defaultKey];
    if (cfg === undefined) {
      return errAsync({ type: 'INVALID_CONFIG_EXPORT' as const, path });
    }
    return okAsync(narrowConfig(cfg));
  });
};
