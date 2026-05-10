import { getCommandMetadata } from '../command/metadata';
import type { CommandClass } from '../command/types';

export type CommandBuiltApp = {
  readonly commandMap: ReadonlyMap<string, CommandClass>;
  readonly hasCommand: (name: string) => boolean;
  readonly getCommands: () => ReadonlyMap<string, CommandClass>;
};

export const validateCommands = (commands: readonly CommandClass[]): Map<string, CommandClass> => {
  const commandMap = new Map<string, CommandClass>();
  for (const cls of commands) {
    const meta = getCommandMetadata(cls);
    if (!meta) {
      throw new Error(`Command class ${cls.name} is missing @Command decorator`);
    }
    if (commandMap.has(meta.name)) {
      throw new Error(`Duplicate command name: ${meta.name}`);
    }
    commandMap.set(meta.name, cls);
  }
  return commandMap;
};

export const commandReady = (commands: readonly CommandClass[] | undefined): CommandBuiltApp | undefined => {
  if (!commands || commands.length === 0) return undefined;
  const commandMap = validateCommands(commands);
  return {
    commandMap,
    hasCommand: (name: string) => commandMap.has(name),
    getCommands: () => commandMap,
  };
};
