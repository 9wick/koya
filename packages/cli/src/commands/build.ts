import { defineCommand } from 'citty';
import consola from 'consola';

import { runTsdownBuild } from '../builders/tsdown';
import { loadConfig } from '../config/load-config';

export const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build the application using tsdown',
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
    outDir: {
      type: 'string',
      alias: 'o',
      description: 'Output directory (overrides config)',
    },
  },
  async run({ args }) {
    const cwd = process.cwd();

    const configFile = args.config as string | undefined;
    const config = await loadConfig(configFile !== undefined ? { cwd, configFile } : { cwd });

    const entry = (args.entry as string | undefined) ?? config.build?.entry;
    const outDir = (args.outDir as string | undefined) ?? config.build?.outDir;

    const buildConfig = {
      ...config.build,
      entry,
      outDir,
    };

    if (entry === undefined) {
      consola.error('No entry file specified. Use --entry or set build.entry in zelt.config.ts');
      process.exit(1);
    }

    consola.start('Building...');

    const result = await runTsdownBuild({
      cwd,
      config: buildConfig,
    });

    if (result.success) {
      consola.success('Build completed');
    } else {
      consola.error('Build failed');
      process.exit(result.exitCode);
    }
  },
});
