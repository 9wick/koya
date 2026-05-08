import type { HttpApp, ReadyOptions } from '@zeltjs/core';

export type CloudflareWorkersOptions = {
  readonly warmup?: boolean;
};

export type CloudflareWorkersHandle = {
  readonly fetch: (request: Request, env: unknown, ctx: ExecutionContext) => Promise<Response>;
};

export const onCloudflareWorkers = (
  app: HttpApp,
  options: CloudflareWorkersOptions = {},
): CloudflareWorkersHandle => {
  let readyPromise: Promise<void> | undefined;

  const ensureReady = (): Promise<void> => {
    if (!readyPromise) {
      const readyOptions: ReadyOptions = { warmup: options.warmup ?? false };
      readyPromise = app.ready(readyOptions);
    }
    return readyPromise;
  };

  const fetch = async (
    request: Request,
    _env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> => {
    await ensureReady();
    const response = app.fetch(request);
    ctx.waitUntil(response.then(() => {}));
    return response;
  };

  return { fetch };
};
