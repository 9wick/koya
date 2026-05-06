import { describe, expect, it } from 'vitest';

import { MinPrefixLengthError } from './errors';
import { assertNonEmptyPrefix, joinPrefix } from './namespace';

describe('namespace helpers', () => {
  it('joinPrefix concatenates prefixes', () => {
    expect(joinPrefix('a:', 'b:')).toBe('a:b:');
    expect(joinPrefix('cache:', 'user:')).toBe('cache:user:');
  });

  it('assertNonEmptyPrefix throws on empty string', () => {
    expect(() => assertNonEmptyPrefix('')).toThrow(MinPrefixLengthError);
  });

  it('assertNonEmptyPrefix passes for non-empty', () => {
    expect(() => assertNonEmptyPrefix('x')).not.toThrow();
  });
});
