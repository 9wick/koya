import { injectable } from '@needle-di/core';
import type { ConfigClass } from './types';

type AnyConstructor = new (...args: never[]) => unknown;

const findToken = (cls: AnyConstructor): AnyConstructor | null => {
  let current: AnyConstructor | null = cls;
  while (current && current !== Function.prototype) {
    if ('Token' in current) {
      return (current as { Token: AnyConstructor }).Token;
    }
    current = Object.getPrototypeOf(current) as AnyConstructor | null;
  }
  return null;
};

export const Config = <T extends ConfigClass>(target: T): T => {
  if (!findToken(target)) {
    throw new Error(
      `@Config class "${target.name}" must have static Token (or extend a class that has one)`,
    );
  }
  injectable()(target);
  return target;
};
