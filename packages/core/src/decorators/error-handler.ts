import { injectable } from '@needle-di/core';

import { resolveClassArgs } from '../internal/decorator-context';

export const ErrorHandler = (...args: unknown[]): unknown => {
  const { cls } = resolveClassArgs(args);
  injectable()(cls as new (...args: never[]) => object);
  return cls;
};
