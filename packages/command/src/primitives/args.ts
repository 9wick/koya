import type { Result } from 'neverthrow';

import { type CommandContextError, getCommandContext } from '../internal/command-context';
import type { InferSchema, SchemaDefinition } from '../schema';

type CommandWithSchema = { schema: SchemaDefinition };

export const argsResult = <T extends CommandWithSchema>(
  _commandClass: T,
): Result<InferSchema<T['schema']>, CommandContextError> => {
  return getCommandContext().map((ctx) => {
    const result: InferSchema<T['schema']> = ctx.parsedArgs as never;
    return result;
  });
};

export const args = <T extends CommandWithSchema>(_commandClass: T): InferSchema<T['schema']> => {
  return argsResult(_commandClass).match(
    (value) => value,
    () => {
      throw new Error('zelt/command: args() called outside command execution');
    },
  );
};
