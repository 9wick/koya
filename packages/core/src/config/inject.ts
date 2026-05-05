import { inject } from '@needle-di/core';

import type { ConfigClass } from './types';

export const injectConfig = <T>(configClass: ConfigClass<T>): T => {
  const values = inject<T>(configClass.Token);
  return values;
};
