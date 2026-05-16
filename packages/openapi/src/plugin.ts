import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ZeltPlugin } from '@zeltjs/cli';

import type { GenerateOpenApiOptions, HttpMetadata } from './generate-openapi';
import { generateOpenApi } from './generate-openapi';

type HttpAppLike = {
  getMetadata: () => HttpMetadata;
};

type AppModule = {
  app?: HttpAppLike;
  default?: HttpAppLike;
};

export type OpenApiPluginOptions = {
  readonly entry?: string;
  readonly outDir?: string;
  readonly tsconfig?: string;
  readonly title?: string;
  readonly version?: string;
};

const loadApp = async (cwd: string, entry: string): Promise<HttpAppLike> => {
  const absPath = resolve(cwd, entry);
  const fileUrl = pathToFileURL(absPath).href;
  const mod: AppModule = await import(fileUrl);
  const app = mod.app ?? mod.default;
  if (app === undefined || typeof app.getMetadata !== 'function') {
    throw new Error(`[openapi] Could not find app with getMetadata() in ${entry}`);
  }
  return app;
};

const buildGenerateOptions = (options: OpenApiPluginOptions): GenerateOpenApiOptions => ({
  distDir: options.outDir ?? './dist',
  ...(options.tsconfig !== undefined && { tsconfig: options.tsconfig }),
  ...(options.title !== undefined && { title: options.title }),
  ...(options.version !== undefined && { version: options.version }),
});

export const openapiPlugin = (options: OpenApiPluginOptions = {}): ZeltPlugin => ({
  name: 'openapi',
  async preBuild(ctx) {
    const entry = options.entry ?? ctx.config.entry;
    if (entry === undefined) {
      throw new Error('[openapi] entry is required. Set it in plugin options or config.entry');
    }
    const app = await loadApp(ctx.cwd, entry);
    await generateOpenApi(app, buildGenerateOptions(options));
  },
});
