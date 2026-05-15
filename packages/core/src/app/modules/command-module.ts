import { getCommandMetadata } from '../../command/metadata';
import type { CommandClass } from '../../command/types';
import { ZeltAppConfigurationError, ZeltDecoratorUsageError } from '../../errors';
import type { Module, ReadyContext } from '../module';

export type CommandModule = Module & {
  hasCommand: (name: string) => boolean;
  getCommands: () => ReadonlyMap<string, CommandClass>;
};

/** @throws {ZeltAppConfigurationError | ZeltDecoratorUsageError | ZeltLifecycleStateError} */
const validateCommands = (commands: readonly CommandClass[]): Map<string, CommandClass> => {
  const commandMap = new Map<string, CommandClass>();
  for (const cls of commands) {
    const meta = getCommandMetadata(cls);
    if (!meta) {
      throw new ZeltDecoratorUsageError({
        decoratorName: 'Command',
        reason: 'missing_decorator',
        targetName: cls.name,
      });
    }
    if (commandMap.has(meta.name)) {
      throw new ZeltAppConfigurationError({ reason: 'duplicate_command', details: meta.name });
    }
    commandMap.set(meta.name, cls);
  }
  return commandMap;
};

export const createCommandModule = (commands: readonly CommandClass[]): CommandModule => {
  const commandMap = new Map<string, CommandClass>();

  /** @throws {ZeltAppConfigurationError | ZeltDecoratorUsageError | ZeltLifecycleStateError} */
  const setup = (): void => {
    const validated = validateCommands(commands);
    for (const [name, cls] of validated) {
      commandMap.set(name, cls);
    }
  };

  const ready = async (_context: ReadyContext): Promise<void> => {};

  const shutdown = async (): Promise<void> => {};

  const hasCommand = (name: string): boolean => commandMap.has(name);

  const getCommands = (): ReadonlyMap<string, CommandClass> => commandMap;

  return {
    setup,
    ready,
    shutdown,
    hasCommand,
    getCommands,
  };
};
