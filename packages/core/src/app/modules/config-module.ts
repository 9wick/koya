import type { ConfigClass } from '../../config';
import type { Module, ReadyContext } from '../module';

type AnyConstructorClass = new (...args: never[]) => object;

export type ConfigModule = Module & {
  addFallbackConfig: (config: ConfigClass<object>) => void;
  overrideConfig: (config: ConfigClass<object>) => void;
  getDefaults: () => readonly AnyConstructorClass[];
  getOverrides: () => readonly AnyConstructorClass[];
};

export const createConfigModule = (): ConfigModule => {
  const defaults: AnyConstructorClass[] = [];
  const overrides: AnyConstructorClass[] = [];

  const setup = (): void => {};

  const ready = async (_context: ReadyContext): Promise<void> => {};

  const shutdown = async (): Promise<void> => {};

  const addFallbackConfig = (config: ConfigClass<object>): void => {
    defaults.push(config);
  };

  const overrideConfig = (config: ConfigClass<object>): void => {
    overrides.push(config);
  };

  const getDefaults = (): readonly AnyConstructorClass[] => defaults;
  const getOverrides = (): readonly AnyConstructorClass[] => overrides;

  return {
    setup,
    ready,
    shutdown,
    addFallbackConfig,
    overrideConfig,
    getDefaults,
    getOverrides,
  };
};
