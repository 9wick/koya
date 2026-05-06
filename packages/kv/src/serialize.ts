import { err, ok, type Result } from 'neverthrow';

import { invalidValue, type KVError } from './errors';

export const serialize = (value: unknown): Result<string, KVError> => {
  if (value === undefined) return err(invalidValue('cannot serialize undefined'));
  return ok(JSON.stringify(value));
};

// deserialize stays sync without Result because we control the input (always
// a string we previously serialized via JSON.stringify, plus driver-controlled null sentinel).
export const deserialize = <T>(raw: string | null): T | undefined => {
  if (raw === null) return undefined;
  return JSON.parse(raw) as T;
};
