import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import consola from 'consola';

import type { BuildConfig } from '../config/schema';

export type BuildOptions = {
  readonly cwd: string;
  readonly config: BuildConfig;
};

export type BuildResult = {
  readonly success: boolean;
  readonly exitCode: number;
};

export const runTsdownBuild = (options: BuildOptions): Promise<BuildResult> => {
  const { cwd, config } = options;

  const args: string[] = [];

  if (config.entry !== undefined) {
    args.push('--entry', config.entry);
  }

  if (config.outDir !== undefined) {
    args.push('--out-dir', config.outDir);
  }

  if (config.format !== undefined) {
    args.push('--format', config.format);
  }

  if (config.platform !== undefined) {
    args.push('--platform', config.platform);
  }

  if (config.external === true) {
    args.push('--deps.never-bundle', '*');
  }

  args.push('--clean');
  args.push('--no-config');

  consola.info(`Running tsdown in ${cwd}`);
  consola.debug(`tsdown ${args.join(' ')}`);

  return new Promise((resolvePromise) => {
    const tsdownBin = resolve(cwd, 'node_modules/.bin/tsdown');

    const child = spawn(tsdownBin, args, {
      cwd,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      const exitCode = code ?? 0;
      resolvePromise({
        success: exitCode === 0,
        exitCode,
      });
    });

    child.on('error', (err) => {
      consola.error('Failed to start tsdown:', err.message);
      resolvePromise({
        success: false,
        exitCode: 1,
      });
    });
  });
};
