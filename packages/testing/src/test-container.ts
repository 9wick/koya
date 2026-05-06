import { resolveWith } from '@zeltjs/core';

type Class<T> = new (...args: never[]) => T;

type Override<T> = {
  readonly provide: Class<T>;
  readonly useValue: T;
};

export type CreateTestContainerOptions = {
  readonly overrides?: readonly Override<unknown>[];
};

export type TestContainerResult<T> = {
  readonly target: T;
  readonly get: <U extends object>(cls: Class<U>) => U;
};

export const createTestContainer = <T extends object>(
  targetClass: Class<T>,
  options: CreateTestContainerOptions = {},
): TestContainerResult<T> => {
  const { target, resolver } = resolveWith(targetClass, options);

  return {
    target,
    get: resolver.get,
  };
};
