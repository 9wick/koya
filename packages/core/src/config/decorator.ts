import { injectable } from '@needle-di/core';

import { resolveClassArgs } from '../internal/decorator-context';
import type { ConfigClass } from './types';
import { findConfigToken } from './token';

export const Config = (...args: unknown[]): unknown => {
  const { cls } = resolveClassArgs(args);
  const target = cls as ConfigClass;
  if (!findConfigToken(target)) {
    throw new Error(
      `@Config class "${target.name}" must have static Token (or extend a class that has one)`,
    );
  }
  injectable()(target);
  return cls;
};
