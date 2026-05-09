import { args, cliSchema, Command } from '@zeltjs/command';
import { describe, expect, it } from 'vitest';

import { runCommand } from './runner';

const getArgsFromContext = (cmd: unknown): unknown => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return args(cmd as any);
  } catch {
    return {};
  }
};

describe('runCommand', () => {
  it('executes command with parsed args and options', async () => {
    const received: { name: string; verbose: boolean } = { name: '', verbose: false };

    @Command({ name: 'greet' })
    class GreetCommand {
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

    const result = await runCommand(GreetCommand, ['Alice', '--verbose']);

    expect(result.isOk()).toBe(true);
    expect(received.name).toBe('Alice');
    expect(received.verbose).toBe(true);
  });

  it('uses default values when args not provided', async () => {
    const received: { env: string } = { env: '' };

    @Command({ name: 'deploy' })
    class DeployCommand {
      readonly options = {
        env: { type: 'string' as const, default: 'production' },
      };

      run(ctx: { args: Record<string, string | undefined>; options: Record<string, unknown> }) {
        received.env = ctx.options['env'] as string;
      }
    }

    const result = await runCommand(DeployCommand, []);

    expect(result.isOk()).toBe(true);
    expect(received.env).toBe('production');
  });

  it('returns error when command throws', async () => {
    @Command({ name: 'fail' })
    class FailingCommand {
      run() {
        throw new Error('Command failed');
      }
    }

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

    class GreetCommandBase {
      static schema = cliSchema({
        args: [{ name: 'target', type: 'string' }],
      });

      run() {
        const ctx = getArgsFromContext(GreetCommandBase) as { target: string };
        received.target = ctx.target;
      }
    }
    Command({ name: 'greet' })(GreetCommandBase);

    const result = await runCommand(GreetCommandBase, ['world']);

    expect(result.isOk()).toBe(true);
    expect(received.target).toBe('world');
  });

  it('parses options with alias from schema', async () => {
    const received: { verbose: boolean } = { verbose: false };

    class TestCommand {
      static schema = cliSchema({
        options: [{ name: 'verbose', type: 'boolean', alias: 'v' }],
      });

      run() {
        const ctx = getArgsFromContext(TestCommand) as { verbose: boolean };
        received.verbose = ctx.verbose;
      }
    }
    Command({ name: 'test' })(TestCommand);

    const result = await runCommand(TestCommand, ['-v']);

    expect(result.isOk()).toBe(true);
    expect(received.verbose).toBe(true);
  });

  it('converts number type args', async () => {
    const received: { port: number } = { port: 0 };

    class ServeCommand {
      static schema = cliSchema({
        options: [{ name: 'port', type: 'number', default: 3000 }],
      });

      run() {
        const ctx = getArgsFromContext(ServeCommand) as { port: number };
        received.port = ctx.port;
      }
    }
    Command({ name: 'serve' })(ServeCommand);

    const result = await runCommand(ServeCommand, ['--port', '8080']);

    expect(result.isOk()).toBe(true);
    expect(received.port).toBe(8080);
    expect(typeof received.port).toBe('number');
  });

  it('uses default value for number option', async () => {
    const received: { port: number } = { port: 0 };

    class ServeCommand {
      static schema = cliSchema({
        options: [{ name: 'port', type: 'number', default: 3000 }],
      });

      run() {
        const ctx = getArgsFromContext(ServeCommand) as { port: number };
        received.port = ctx.port;
      }
    }
    Command({ name: 'serve' })(ServeCommand);

    const result = await runCommand(ServeCommand, []);

    expect(result.isOk()).toBe(true);
    expect(received.port).toBe(3000);
  });

  it('returns error for invalid number', async () => {
    class ServeCommand {
      static schema = cliSchema({
        options: [{ name: 'port', type: 'number' }],
      });

      run() {}
    }
    Command({ name: 'serve' })(ServeCommand);

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

    class GreetCommand {
      static schema = cliSchema({
        args: [
          { name: 'target', type: 'string' },
          { name: 'message', type: 'string', optional: true },
        ],
      });

      run() {
        const ctx = getArgsFromContext(GreetCommand) as { target: string; message?: string };
        received.target = ctx.target;
        received.message = ctx.message;
      }
    }
    Command({ name: 'greet' })(GreetCommand);

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

    class DeployCommand {
      static schema = cliSchema({
        args: [{ name: 'target', type: 'string' }],
        options: [
          { name: 'port', type: 'number', default: 3000 },
          { name: 'verbose', type: 'boolean' },
        ],
      });

      run() {
        const ctx = getArgsFromContext(DeployCommand) as {
          target: string;
          port: number;
          verbose: boolean;
        };
        received.target = ctx.target;
        received.port = ctx.port;
        received.verbose = ctx.verbose;
      }
    }
    Command({ name: 'deploy' })(DeployCommand);

    const result = await runCommand(DeployCommand, ['production', '--port', '8080', '--verbose']);

    expect(result.isOk()).toBe(true);
    expect(received.target).toBe('production');
    expect(received.port).toBe(8080);
    expect(received.verbose).toBe(true);
  });
});

describe('schema validation', () => {
  it('returns error when args and options have same name', async () => {
    class TestCommand {
      static schema = cliSchema({
        args: [{ name: 'port', type: 'string' }],
        options: [{ name: 'port', type: 'number' }],
      });

      run() {}
    }
    Command({ name: 'test' })(TestCommand);

    const result = await runCommand(TestCommand, []);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('SCHEMA_VALIDATION_FAILED');
    }
  });
});
