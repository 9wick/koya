import { err, ok, type Result } from 'neverthrow';

import { emptyNamespace, type KVError } from './errors';

export const validatePrefix = (prefix: string): Result<string, KVError> =>
  prefix.length === 0 ? err(emptyNamespace()) : ok(prefix);

export const joinPrefix = (a: string, b: string): string => a + b;
