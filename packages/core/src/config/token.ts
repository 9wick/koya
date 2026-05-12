import type { Container as ContainerType } from '@needle-di/core';
import { inject } from '../di/inject';
import { getLeaf, overrideLeaf, registerAsLeaf, resolveLeaf } from '../di/leaf';

import type { ConfigClass } from './types';

type AnyConfigClass = new (...args: never[]) => unknown;

export { registerAsLeaf as registerConfigClass };

export const overrideConfig = (
  container: ContainerType,
  config: AnyConfigClass,
  options?: { readonly fallback?: boolean },
): void => {
  overrideLeaf(container, config, options);
};

export const resolveConfig = (container: ContainerType, config: AnyConfigClass): void => {
  resolveLeaf(container, config);
};

export const getConfig = <T extends object>(
  container: ContainerType,
  configClass: ConfigClass<T>,
): T => getLeaf(container, configClass);

/**
 * @deprecated Use `inject(ConfigClass)` instead.
 * The unified `inject` now handles leaf resolution automatically for @Config classes.
 */
export const injectConfig = <T extends object>(configClass: ConfigClass<T>): T =>
  inject(configClass);
