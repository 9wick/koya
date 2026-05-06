import { describe, expect, it } from 'vitest';

import { deserialize, serialize } from './serialize';

describe('serialize', () => {
  it('round-trips primitives', () => {
    expect(deserialize(serialize(42)._unsafeUnwrap())).toBe(42);
    expect(deserialize(serialize('hello')._unsafeUnwrap())).toBe('hello');
    expect(deserialize(serialize(true)._unsafeUnwrap())).toBe(true);
    expect(deserialize(serialize(null)._unsafeUnwrap())).toBe(null);
  });

  it('round-trips objects', () => {
    const value = { a: 1, b: ['x', 'y'], c: { d: true } };
    expect(deserialize(serialize(value)._unsafeUnwrap())).toEqual(value);
  });

  it('returns Err when serializing undefined', () => {
    const r = serialize(undefined);
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().type).toBe('INVALID_VALUE');
  });

  it('returns undefined when deserializing null input', () => {
    expect(deserialize(null)).toBeUndefined();
  });
});
