export { Command } from './decorators/command';
export { getCommandMetadata, type CommandMetadata } from './internal/metadata';
export type {
  ArgsDefinition,
  CommandClass,
  CommandContext,
  InferArgs,
  InferOptions,
  LegacyCommandClass,
  NewCommandClass,
  OptionsDefinition,
} from './types';

// New API
export { cliSchema } from './schema';
export type { ArgDef, InferSchema, OptionDef, SchemaDefinition } from './schema';
export { args } from './primitives/args';
export {
  getCommandContext,
  runInCommandContext,
  type CommandContextStore,
} from './internal/command-context';
