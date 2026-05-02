import { Container, type Provider } from '@needle-di/core';

type Class<T> = new (...args: never[]) => T;

export type ResolverHandle = {
  readonly get: <T extends object>(cls: Class<T>) => T;
};

export const createContainer = (providers: readonly Provider<unknown>[]): ResolverHandle => {
  const container = new Container();
  for (const provider of providers) {
    container.bind(provider);
  }
  return {
    get: <T extends object>(cls: Class<T>): T => container.get<T>(cls),
  };
};
