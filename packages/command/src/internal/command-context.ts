import { AsyncLocalStorage } from 'node:async_hooks';

import { err, ok, type Result } from 'neverthrow';

export type CommandContextStore = {
  readonly parsedArgs: Record<string, unknown>;
};

export type CommandContextError = { type: 'CONTEXT_NOT_FOUND' };

const storage = new AsyncLocalStorage<CommandContextStore>();

export const runInCommandContext = <T>(ctx: CommandContextStore, fn: () => T): T =>
  storage.run(ctx, fn);

export const getCommandContext = (): Result<CommandContextStore, CommandContextError> => {
  const ctx = storage.getStore();
  if (!ctx) return err({ type: 'CONTEXT_NOT_FOUND' });
  return ok(ctx);
};
