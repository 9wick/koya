import { loadConfig as c12LoadConfig } from 'c12';

import type { ZeltConfig } from './schema';

export type LoadConfigOptions = {
  readonly cwd?: string;
  readonly configFile?: string;
};

export const loadConfig = async (options: LoadConfigOptions = {}): Promise<ZeltConfig> => {
  const c12Options: Parameters<typeof c12LoadConfig<ZeltConfig>>[0] = {
    name: 'zelt',
    defaults: {
      build: {
        outDir: './dist',
        platform: 'node',
        format: 'esm',
        external: true,
      },
      dev: {
        port: 3000,
        debounceMs: 300,
      },
    },
  };

  if (options.cwd !== undefined) {
    c12Options.cwd = options.cwd;
  }
  if (options.configFile !== undefined) {
    c12Options.configFile = options.configFile;
  }

  const { config } = await c12LoadConfig<ZeltConfig>(c12Options);

  if (config === undefined) {
    return {};
  }

  return config;
};
