import { appendSkipMiddlewareMetadata } from '../internal/metadata';
import type { MiddlewareIdentifier } from '../middleware/types';

export const SkipMiddleware =
  (...middlewares: MiddlewareIdentifier[]): MethodDecorator =>
  (target, propertyKey): void => {
    if (typeof target === 'function') {
      throw new Error('koya: @SkipMiddleware cannot be applied to static methods');
    }
    appendSkipMiddlewareMetadata(target.constructor, propertyKey, middlewares);
  };
