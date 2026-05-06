#!/usr/bin/env node
// packages/contract/src/cli.ts
import { cac } from 'cac';
import { match } from 'ts-pattern';

import type { AnalyzerError, ConfigError, EmitError, ContractError } from './errors';
import { generateClient } from './generate-client';
import { findConfigFile, loadConfig } from './load-config';
import { watchClient } from './watch';

const formatAnalyzerError = (error: AnalyzerError): string =>
  match(error)
    .with(
      { type: 'SOURCE_FILE_NOT_FOUND' },
      (e) => `zelt/openapi: source file not found: ${e.path}`,
    )
    .with(
      { type: 'CLASS_NOT_FOUND' },
      (e) => `zelt/openapi: class ${e.className} not found in ${e.path}`,
    )
    .with(
      { type: 'CONTROLLER_DECORATOR_MISSING' },
      (e) => `zelt/openapi: ${e.className} is missing @Controller decorator`,
    )
    .with(
      { type: 'DECORATOR_REQUIRES_STRING_LITERAL' },
      (e) => `zelt/openapi: @${e.decoratorName} requires a string literal argument`,
    )
    .with(
      { type: 'MODULE_RESOLVE_FAILED' },
      (e) => `zelt/openapi: cannot resolve module for validated(${e.exportName})`,
    )
    .with(
      { type: 'PATH_PARAM_REQUIRES_LITERAL' },
      () => `zelt/openapi: pathParam() requires a string literal argument`,
    )
    .exhaustive();

const formatEmitError = (error: EmitError): string =>
  match(error)
    .with(
      { type: 'MODULE_NOT_OBJECT' },
      (e) => `zelt/openapi: ${e.modulePath} did not export an object module`,
    )
    .with(
      { type: 'EXPORT_NOT_FOUND' },
      (e) => `zelt/openapi: ${e.exportName} not found in ${e.modulePath}`,
    )
    .with(
      { type: 'INLINE_SCHEMA_NOT_SUPPORTED' },
      () => `zelt/openapi: inline schema not supported. Extract to module-level export.`,
    )
    .with(
      { type: 'NOT_VALIBOT_SCHEMA' },
      (e) => `zelt/openapi: ${e.exportName} in ${e.modulePath} is not a valibot schema`,
    )
    .with(
      { type: 'UNRESOLVABLE_RESPONSE_TYPE' },
      () => `zelt/openapi: handler return type is unknown/any. Add explicit return type.`,
    )
    .exhaustive();

const formatConfigError = (error: ConfigError): string =>
  match(error)
    .with({ type: 'CONFIG_NOT_FOUND' }, () => `zelt/openapi: no zelt.config.{ts,js,mts,mjs} found`)
    .with(
      { type: 'INVALID_CONFIG_EXPORT' },
      (e) => `zelt/openapi: ${e.path} must export a default GenerateClientOptions`,
    )
    .exhaustive();

const formatError = (error: ContractError): string => {
  if ('type' in error) {
    switch (error.type) {
      case 'SOURCE_FILE_NOT_FOUND':
      case 'CLASS_NOT_FOUND':
      case 'CONTROLLER_DECORATOR_MISSING':
      case 'DECORATOR_REQUIRES_STRING_LITERAL':
      case 'MODULE_RESOLVE_FAILED':
      case 'PATH_PARAM_REQUIRES_LITERAL':
        return formatAnalyzerError(error);
      case 'MODULE_NOT_OBJECT':
      case 'EXPORT_NOT_FOUND':
      case 'INLINE_SCHEMA_NOT_SUPPORTED':
      case 'NOT_VALIBOT_SCHEMA':
      case 'UNRESOLVABLE_RESPONSE_TYPE':
        return formatEmitError(error);
      case 'CONFIG_NOT_FOUND':
      case 'INVALID_CONFIG_EXPORT':
        return formatConfigError(error);
    }
  }
  return `zelt/openapi: unknown error`;
};

const cli = cac('zelt-openapi');

cli
  .command('build', 'Generate AppType + OpenAPI once')
  .option('-c, --config <path>', 'Path to zelt.config file')
  .action(async (opts: { config?: string }) => {
    const cfgPath = opts.config ?? (await findConfigFile(process.cwd()));
    if (cfgPath === undefined) {
      console.error(formatError({ type: 'CONFIG_NOT_FOUND' }));
      process.exit(1);
    }

    const cfgResult = await loadConfig(cfgPath);
    if (cfgResult.isErr()) {
      console.error(formatError(cfgResult.error));
      process.exit(1);
    }

    const result = await generateClient(cfgResult.value);
    result.match(
      (success) => {
        console.log(
          `[zelt-openapi] built (app.gen.ts ${success.appGenChanged ? 'changed' : 'unchanged'}, openapi.json ${success.openApiChanged ? 'changed' : 'unchanged'})`,
        );
      },
      (error) => {
        console.error(formatError(error));
        process.exit(1);
      },
    );
  });

cli
  .command('watch', 'Generate AppType + OpenAPI continuously')
  .option('-c, --config <path>', 'Path to zelt.config file')
  .action(async (opts: { config?: string }) => {
    const cfgPath = opts.config ?? (await findConfigFile(process.cwd()));
    if (cfgPath === undefined) {
      console.error(formatError({ type: 'CONFIG_NOT_FOUND' }));
      process.exit(1);
    }

    const cfgResult = await loadConfig(cfgPath);
    if (cfgResult.isErr()) {
      console.error(formatError(cfgResult.error));
      process.exit(1);
    }

    await watchClient({ ...cfgResult.value, watch: true });
    console.log('[zelt-openapi] watching ...');
  });

cli.help();
cli.version('0.0.0');
cli.parse(process.argv, { run: false });
await cli.runMatchedCommand();
