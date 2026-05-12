import type { inject as InjectFn, InjectionToken, Token } from '@needle-di/core';
import { inject } from '@needle-di/core';

import { injectLeaf, isLeafClass } from './leaf';

type AnyClass = new (...args: never[]) => unknown;

const isClassToken = <T>(token: Token<T>): boolean =>
  typeof token === 'function' && token.prototype !== undefined;

const needleInject: typeof InjectFn = inject;

function unifiedInject<T>(token: InjectionToken<T>): T;
function unifiedInject<T>(token: Token<T>): T;
function unifiedInject<T>(token: Token<T>, options: { multi: true }): T[];
function unifiedInject<T>(token: Token<T>, options: { optional: true }): T | undefined;
function unifiedInject<T>(
  token: Token<T>,
  options: { multi: true; optional: true },
): T[] | undefined;
function unifiedInject<T>(token: Token<T>, options: { lazy: true }): () => T;
function unifiedInject<T>(token: Token<T>, options: { lazy: true; multi: true }): () => T[];
function unifiedInject<T>(
  token: Token<T>,
  options: { lazy: true; optional: true },
): () => T | undefined;
function unifiedInject<T>(
  token: Token<T>,
  options: { lazy: true; multi: true; optional: true },
): () => T[] | undefined;
function unifiedInject<T>(
  token: Token<T>,
  options?: { multi?: boolean; optional?: boolean; lazy?: boolean },
): unknown {
  if (options === undefined && isClassToken(token) && isLeafClass(token as AnyClass)) {
    return injectLeaf(token as new (...args: never[]) => object);
  }
  return needleInject(token, options as never);
}

export { unifiedInject as inject };
