import type { Provider } from '@needle-di/core';

import { createHttpRuntime, type HttpRuntime, type HttpRuntimeOptions } from './http/runtime';
import { createContainer } from './internal/container';

export type Application = {
  readonly http: (options: HttpRuntimeOptions) => HttpRuntime;
};

export type CreateAppOptions = {
  readonly providers: readonly Provider<unknown>[];
};

export const createApp = (options: CreateAppOptions): Application => {
  const container = createContainer(options.providers);
  return {
    http: (httpOptions) => createHttpRuntime(container, httpOptions),
  };
};
