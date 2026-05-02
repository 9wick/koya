import { injectable } from '@needle-di/core';

import { setControllerMetadata } from '../internal/metadata';

type AnyClass = new (...args: never[]) => object;

// legacy class decorator: (target: Class) => Class | void
export const Controller =
  (basePath: string) =>
  <T extends AnyClass>(target: T): T => {
    setControllerMetadata(target, { basePath });
    const wrapped: T | void = injectable<T>()(target);
    return wrapped ?? target;
  };
