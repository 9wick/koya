import type {
  ArgDef,
  CommandClass,
  CommandContext,
  LegacyCommandClass,
  NewCommandClass,
  SchemaDefinition,
} from '@zeltjs/command';
import { runInCommandContext } from '@zeltjs/command';
import { Container } from '@needle-di/core';
import type { ArgsDef, BooleanArgDef, StringArgDef } from 'citty';
import { parseArgs } from 'citty';
import {
  err,
  errAsync,
  fromPromise,
  fromThrowable,
  ok,
  type Result,
  type ResultAsync,
} from 'neverthrow';

export type RunCommandError =
  | { type: 'COMMAND_EXECUTION_FAILED'; cause: unknown }
  | { type: 'INVALID_NUMBER'; name: string; value: unknown }
  | { type: 'SCHEMA_VALIDATION_FAILED'; message: string };

type LegacyInstanceShape = {
  args?: Record<string, { type: string; default?: string }>;
  options?: Record<string, { type: string; alias?: string; default?: boolean | string }>;
  run: (ctx: CommandContext) => Promise<void> | void;
};

type NewInstanceShape = {
  run: (ctx?: unknown) => Promise<void> | void;
};

type ParsedArgs = {
  _: string[];
  [key: string]: unknown;
};

// --- Legacy API helpers ---

const toPositionalArg = (def: { default?: string }): ArgsDef[string] =>
  def.default !== undefined ? { type: 'positional', default: def.default } : { type: 'positional' };

const toBooleanArg = (def: { alias?: string; default?: boolean | string }): BooleanArgDef => {
  const base: BooleanArgDef = { type: 'boolean' };
  if (def.alias !== undefined) base.alias = def.alias;
  if (def.default !== undefined) base.default = def.default as boolean;
  return base;
};

const toStringArg = (def: { alias?: string; default?: boolean | string }): StringArgDef => {
  const base: StringArgDef = { type: 'string' };
  if (def.alias !== undefined) base.alias = def.alias;
  if (def.default !== undefined) base.default = def.default as string;
  return base;
};

const buildLegacyCittyArgs = (commandClass: LegacyCommandClass): ArgsDef => {
  const instance = Object.create(commandClass.prototype) as LegacyInstanceShape;
  const cittyArgs: ArgsDef = {};

  for (const [key, def] of Object.entries(instance.args ?? {})) {
    cittyArgs[key] = toPositionalArg(def);
  }

  for (const [key, def] of Object.entries(instance.options ?? {})) {
    cittyArgs[key] = def.type === 'boolean' ? toBooleanArg(def) : toStringArg(def);
  }

  return cittyArgs;
};

const buildLegacyArgs = (
  instance: LegacyInstanceShape,
  parsed: ParsedArgs,
): Record<string, string | undefined> => {
  const positionalKeys = Object.keys(instance.args ?? {});
  const args: Record<string, string | undefined> = {};
  for (let i = 0; i < positionalKeys.length; i++) {
    const key = positionalKeys[i];
    if (key) {
      args[key] = (parsed._[i] as string | undefined) ?? (instance.args?.[key]?.default as string);
    }
  }
  return args;
};

const buildLegacyOptions = (
  instance: LegacyInstanceShape,
  parsed: ParsedArgs,
): Record<string, unknown> => {
  const options: Record<string, unknown> = {};
  for (const key of Object.keys(instance.options ?? {})) {
    options[key] = parsed[key] ?? instance.options?.[key]?.default;
  }
  return options;
};

// --- New API helpers ---

const getStaticSchema = (commandClass: CommandClass): SchemaDefinition | undefined => {
  const maybeSchema = (commandClass as { schema?: SchemaDefinition }).schema;
  return maybeSchema;
};

const validateSchema = (
  schema: SchemaDefinition,
): Result<void, { type: 'SCHEMA_VALIDATION_FAILED'; message: string }> => {
  const argNames = new Set((schema.args ?? []).map((a) => a.name));
  const optionNames = new Set((schema.options ?? []).map((o) => o.name));

  for (const name of argNames) {
    if (optionNames.has(name)) {
      return err({
        type: 'SCHEMA_VALIDATION_FAILED',
        message: `Duplicate name '${name}' in args and options`,
      });
    }
  }

  return ok(undefined);
};

const optionToCittyArg = (opt: {
  type: string;
  alias?: string;
  default?: unknown;
}): BooleanArgDef | StringArgDef => {
  if (opt.type === 'boolean') {
    const def: BooleanArgDef = { type: 'boolean' };
    if (opt.alias !== undefined) def.alias = opt.alias;
    if (opt.default !== undefined) def.default = opt.default as boolean;
    return def;
  }
  const def: StringArgDef = { type: 'string' };
  if (opt.alias !== undefined) def.alias = opt.alias;
  if (opt.default !== undefined) def.default = String(opt.default);
  return def;
};

const buildNewCittyArgs = (schema: SchemaDefinition): ArgsDef => {
  const cittyArgs: ArgsDef = {};

  for (const arg of schema.args ?? []) {
    cittyArgs[arg.name] =
      arg.optional === true ? { type: 'positional', required: false } : { type: 'positional' };
  }

  for (const opt of schema.options ?? []) {
    cittyArgs[opt.name] = optionToCittyArg(opt);
  }

  return cittyArgs;
};

const convertNumber = (
  value: unknown,
  name: string,
): Result<number, { type: 'INVALID_NUMBER'; name: string; value: unknown }> => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return err({ type: 'INVALID_NUMBER', name, value });
  }
  return ok(num);
};

type NumberConvertError = { type: 'INVALID_NUMBER'; name: string; value: unknown };

const processPositionalArg = (
  arg: ArgDef,
  value: unknown,
  result: Record<string, unknown>,
): Result<void, NumberConvertError> => {
  if (arg.type === 'number' && value !== undefined) {
    const converted = convertNumber(value, arg.name);
    if (converted.isErr()) return err(converted.error);
    result[arg.name] = converted.value;
  } else {
    result[arg.name] = value;
  }
  return ok(undefined);
};

const processOption = (
  opt: { name: string; type: string; default?: unknown },
  value: unknown,
  result: Record<string, unknown>,
): Result<void, NumberConvertError> => {
  if (opt.type === 'number' && value !== undefined) {
    const converted = convertNumber(value, opt.name);
    if (converted.isErr()) return err(converted.error);
    result[opt.name] = converted.value;
  } else if (opt.type === 'boolean') {
    result[opt.name] = value ?? false;
  } else {
    result[opt.name] = value;
  }
  return ok(undefined);
};

const processAllPositionalArgs = (
  argDefs: readonly ArgDef[],
  parsed: ParsedArgs,
  result: Record<string, unknown>,
): Result<void, NumberConvertError> => {
  for (let i = 0; i < argDefs.length; i++) {
    const arg = argDefs[i] as ArgDef;
    const processResult = processPositionalArg(arg, parsed._[i], result);
    if (processResult.isErr()) return err(processResult.error);
  }
  return ok(undefined);
};

const processAllOptions = (
  optionDefs: readonly { name: string; type: string; default?: unknown }[],
  parsed: ParsedArgs,
  result: Record<string, unknown>,
): Result<void, NumberConvertError> => {
  for (const opt of optionDefs) {
    const value = parsed[opt.name] ?? opt.default;
    const processResult = processOption(opt, value, result);
    if (processResult.isErr()) return err(processResult.error);
  }
  return ok(undefined);
};

const buildNewArgs = (
  schema: SchemaDefinition,
  parsed: ParsedArgs,
): Result<Record<string, unknown>, NumberConvertError> => {
  const result: Record<string, unknown> = {};

  const argsResult = processAllPositionalArgs(schema.args ?? [], parsed, result);
  if (argsResult.isErr()) return err(argsResult.error);

  const optionsResult = processAllOptions(schema.options ?? [], parsed, result);
  if (optionsResult.isErr()) return err(optionsResult.error);

  return ok(result);
};

// --- Legacy execution ---

const parseAndResolveLegacy = (
  commandClass: LegacyCommandClass,
  argv: string[],
): Result<{ instance: LegacyInstanceShape; ctx: CommandContext }, never> => {
  const cittyArgs = buildLegacyCittyArgs(commandClass);
  const parsed = parseArgs(argv, cittyArgs) as ParsedArgs;

  const container = new Container();
  const instance = container.get(commandClass) as LegacyInstanceShape;

  const ctx: CommandContext = {
    args: buildLegacyArgs(instance, parsed),
    options: buildLegacyOptions(instance, parsed),
  } as CommandContext;

  return ok({ instance, ctx });
};

const executeLegacyRun = (
  instance: LegacyInstanceShape,
  ctx: CommandContext,
): ResultAsync<void, RunCommandError> => {
  const safeRun = fromThrowable(
    () => instance.run(ctx),
    (cause) => ({ type: 'COMMAND_EXECUTION_FAILED' as const, cause }),
  );

  return safeRun().asyncAndThen((maybePromise) =>
    fromPromise(Promise.resolve(maybePromise), (cause) => ({
      type: 'COMMAND_EXECUTION_FAILED' as const,
      cause,
    })),
  );
};

// --- New execution ---

const parseAndResolveNew = (
  commandClass: NewCommandClass,
  argv: string[],
): Result<{ instance: NewInstanceShape; parsedArgs: Record<string, unknown> }, RunCommandError> => {
  const schema = commandClass.schema;

  const validationResult = validateSchema(schema);
  if (validationResult.isErr()) return err(validationResult.error);

  const cittyArgs = buildNewCittyArgs(schema);
  const parsed = parseArgs(argv, cittyArgs) as ParsedArgs;

  const argsResult = buildNewArgs(schema, parsed);
  if (argsResult.isErr()) return err(argsResult.error);

  const container = new Container();
  const instance = container.get(commandClass) as NewInstanceShape;

  return ok({ instance, parsedArgs: argsResult.value });
};

const executeNewRun = (
  instance: NewInstanceShape,
  parsedArgs: Record<string, unknown>,
): ResultAsync<void, RunCommandError> => {
  const safeRun = fromThrowable(
    () => runInCommandContext({ parsedArgs }, () => instance.run()),
    (cause) => ({ type: 'COMMAND_EXECUTION_FAILED' as const, cause }),
  );

  return safeRun().asyncAndThen((maybePromise) =>
    fromPromise(Promise.resolve(maybePromise), (cause) => ({
      type: 'COMMAND_EXECUTION_FAILED' as const,
      cause,
    })),
  );
};

// --- Main entry point ---

export const runCommand = (
  commandClass: CommandClass,
  argv: string[],
): ResultAsync<void, RunCommandError> => {
  const staticSchema = getStaticSchema(commandClass);
  if (staticSchema !== undefined) {
    const result = parseAndResolveNew(commandClass as NewCommandClass, argv);
    if (result.isErr()) return errAsync(result.error);
    return executeNewRun(result.value.instance, result.value.parsedArgs);
  }

  return parseAndResolveLegacy(commandClass as LegacyCommandClass, argv).asyncAndThen(
    ({ instance, ctx }) => executeLegacyRun(instance, ctx),
  );
};
