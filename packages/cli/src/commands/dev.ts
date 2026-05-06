import { defineCommand } from 'citty';
import consola from 'consola';

import { loadConfig } from '../config/load-config';
import { startDevServer } from '../dev-server/server';

export const devCommand = defineCommand({
  meta: {
    name: 'dev',
    description: 'Start development server with file watching',
  },
  args: {
    config: {
      type: 'string',
      alias: 'c',
      description: 'Path to zelt.config.ts',
    },
    entry: {
      type: 'string',
      alias: 'e',
      description: 'Entry file (overrides config)',
    },
    port: {
      type: 'string',
      alias: 'p',
      description: 'Port to listen on (overrides config)',
    },
  },
  async run({ args }) {
    const cwd = process.cwd();

    const configFile = args.config as string | undefined;
    const config = await loadConfig(configFile !== undefined ? { cwd, configFile } : { cwd });

    const entry = (args.entry as string | undefined) ?? config.dev?.entry;

    if (entry === undefined) {
      consola.error('No entry file specified. Use --entry or set dev.entry in zelt.config.ts');
      process.exit(1);
    }

    const portArg = args.port as string | undefined;
    const devConfig = {
      ...config.dev,
      entry,
      port: portArg !== undefined ? Number.parseInt(portArg, 10) : config.dev?.port,
    };

    await startDevServer({
      cwd,
      config: devConfig,
    });
  },
});
