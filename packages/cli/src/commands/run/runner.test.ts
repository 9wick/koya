import { args, cliSchema, Command } from '@zeltjs/command';
import { describe, expect, it } from 'vitest';

import { runCommand } from './runner';

describe('runCommand', () => {
  it('executes command with parsed args and options', async () => {
    const received: { name: string; verbose: boolean } = { name: '', verbose: false };

    class GreetCommandBase {
      readonly args = {
        name: { type: 'positional' as const, required: true as const },
      };
      readonly options = {
        verbose: { type: 'boolean' as const, default: false },
      };

      run(ctx: { args: Record<string, string | undefined>; options: Record<string, unknown> }) {
        received.name = ctx.args['name'] ?? '';
        received.verbose = ctx.options['verbose'] as boolean;
      }
    }

    const GreetCommand = Command({ name: 'greet' })(GreetCommandBase);

    const result = await runCommand(GreetCommand, ['Alice', '--verbose']);

    expect(result.isOk()).toBe(true);
    expect(received.name).toBe('Alice');
    expect(received.verbose).toBe(true);
  });

  it('uses default values when args not provided', async () => {
    const received: { env: string } = { env: '' };

    class DeployCommandBase {
      readonly options = {
        env: { type: 'string' as const, default: 'production' },
      };

      run(ctx: { args: Record<string, string | undefined>; options: Record<string, unknown> }) {
        received.env = ctx.options['env'] as string;
      }
    }

    const DeployCommand = Command({ name: 'deploy' })(DeployCommandBase);

    const result = await runCommand(DeployCommand, []);

    expect(result.isOk()).toBe(true);
    expect(received.env).toBe('production');
  });

  it('returns error when command throws', async () => {
    class FailingCommandBase {
      run() {
        throw new Error('Command failed');
      }
    }

    const FailingCommand = Command({ name: 'fail' })(FailingCommandBase);

    const result = await runCommand(FailingCommand, []);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('COMMAND_EXECUTION_FAILED');
    }
  });
});

describe('runCommand with static schema', () => {
  it('parses positional args from schema', async () => {
    const received: { target: string } = { target: '' };

    @Command({ name: 'greet' })
    class GreetCommand {
      static schema = cliSchema({
        args: [{ name: 'target', type: 'string' }],
      });

      run(ctx = args(GreetCommand)) {
        received.target = ctx.target;
      }
    }

    const result = await runCommand(GreetCommand, ['world']);

    expect(result.isOk()).toBe(true);
    expect(received.target).toBe('world');
  });

  it('parses options with alias from schema', async () => {
    const received: { verbose: boolean } = { verbose: false };

    @Command({ name: 'test' })
    class TestCommand {
      static schema = cliSchema({
        options: [{ name: 'verbose', type: 'boolean', alias: 'v' }],
      });

      run(ctx = args(TestCommand)) {
        received.verbose = ctx.verbose;
      }
    }

    const result = await runCommand(TestCommand, ['-v']);

    expect(result.isOk()).toBe(true);
    expect(received.verbose).toBe(true);
  });

  it('converts number type args', async () => {
    const received: { port: number } = { port: 0 };

    @Command({ name: 'serve' })
    class ServeCommand {
      static schema = cliSchema({
        options: [{ name: 'port', type: 'number', default: 3000 }],
      });

      run(ctx = args(ServeCommand)) {
        received.port = ctx.port;
      }
    }

    const result = await runCommand(ServeCommand, ['--port', '8080']);

    expect(result.isOk()).toBe(true);
    expect(received.port).toBe(8080);
    expect(typeof received.port).toBe('number');
  });

  it('uses default value for number option', async () => {
    const received: { port: number } = { port: 0 };

    @Command({ name: 'serve' })
    class ServeCommand {
      static schema = cliSchema({
        options: [{ name: 'port', type: 'number', default: 3000 }],
      });

      run(ctx = args(ServeCommand)) {
        received.port = ctx.port;
      }
    }

    const result = await runCommand(ServeCommand, []);

    expect(result.isOk()).toBe(true);
    expect(received.port).toBe(3000);
  });

  it('returns error for invalid number', async () => {
    @Command({ name: 'serve' })
    class ServeCommand {
      static schema = cliSchema({
        options: [{ name: 'port', type: 'number' }],
      });

      run() {}
    }

    const result = await runCommand(ServeCommand, ['--port', 'abc']);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('INVALID_NUMBER');
    }
  });

  it('handles optional positional args', async () => {
    const received: { target: string; message: string | undefined } = {
      target: '',
      message: undefined,
    };

    @Command({ name: 'greet' })
    class GreetCommand {
      static schema = cliSchema({
        args: [
          { name: 'target', type: 'string' },
          { name: 'message', type: 'string', optional: true },
        ],
      });

      run(ctx = args(GreetCommand)) {
        received.target = ctx.target;
        received.message = ctx.message;
      }
    }

    const result = await runCommand(GreetCommand, ['world']);

    expect(result.isOk()).toBe(true);
    expect(received.target).toBe('world');
    expect(received.message).toBeUndefined();
  });

  it('combines args and options', async () => {
    const received: { target: string; port: number; verbose: boolean } = {
      target: '',
      port: 0,
      verbose: false,
    };

    @Command({ name: 'deploy' })
    class DeployCommand {
      static schema = cliSchema({
        args: [{ name: 'target', type: 'string' }],
        options: [
          { name: 'port', type: 'number', default: 3000 },
          { name: 'verbose', type: 'boolean' },
        ],
      });

      run(ctx = args(DeployCommand)) {
        received.target = ctx.target;
        received.port = ctx.port;
        received.verbose = ctx.verbose;
      }
    }

    const result = await runCommand(DeployCommand, ['production', '--port', '8080', '--verbose']);

    expect(result.isOk()).toBe(true);
    expect(received.target).toBe('production');
    expect(received.port).toBe(8080);
    expect(received.verbose).toBe(true);
  });
});

describe('schema validation', () => {
  it('returns error when args and options have same name', async () => {
    @Command({ name: 'test' })
    class TestCommand {
      static schema = cliSchema({
        args: [{ name: 'port', type: 'string' }],
        options: [{ name: 'port', type: 'number' }],
      });

      run() {}
    }

    const result = await runCommand(TestCommand, []);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('SCHEMA_VALIDATION_FAILED');
    }
  });
});
