import { describe, expect, it } from 'vitest';

import { validatePrefix, joinPrefix } from './namespace';

describe('namespace helpers', () => {
  it('joinPrefix concatenates prefixes', () => {
    expect(joinPrefix('a:', 'b:')).toBe('a:b:');
    expect(joinPrefix('cache:', 'user:')).toBe('cache:user:');
  });

  it('validatePrefix returns Err on empty string', () => {
    const r = validatePrefix('');
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().type).toBe('EMPTY_NAMESPACE');
  });

  it('validatePrefix returns Ok for non-empty string', () => {
    const r = validatePrefix('x');
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toBe('x');
  });
});
