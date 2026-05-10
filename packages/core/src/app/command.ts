import { getCommandMetadata } from '../command/metadata';
import type { CommandClass } from '../command/types';

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
