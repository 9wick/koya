import { injectable } from '@needle-di/core';

type AnyClass = new (...args: never[]) => object;

// legacy class decorator: (target: Class) => Class | void
export const Middleware = <T extends AnyClass>(target: T): T => {
  const wrapped: T | void = injectable<T>()(target);
  return wrapped ?? target;
};
