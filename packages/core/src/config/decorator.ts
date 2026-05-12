import { injectable } from '@needle-di/core';

import { registerAsLeaf } from '../di/leaf';

type AnyConstructor = new (...args: never[]) => unknown;

export const Config = (target: AnyConstructor): void => {
  registerAsLeaf(target);
  injectable()(target);
};
