import { inject } from '@needle-di/core';
import type { ConfigClass } from './types';

export const injectConfig = <T>(configClass: ConfigClass<T>): T => {
  return inject<T>(configClass.Token);
};
