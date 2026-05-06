import { MinPrefixLengthError } from './errors';

export const assertNonEmptyPrefix = (prefix: string): void => {
  if (prefix.length === 0) throw new MinPrefixLengthError();
};

export const joinPrefix = (a: string, b: string): string => a + b;
