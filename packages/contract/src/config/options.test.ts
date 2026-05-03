import { describe, expect, expectTypeOf, it } from 'vitest';

import { defineConfig, type GenerateClientOptions } from './options';

class A {}
class B {}

describe('defineConfig', () => {
  it('returns the input as-is (identity function)', () => {
    const cfg = defineConfig({ controllers: [A, B], dist: './generated' });
    expect(cfg.controllers).toEqual([A, B]);
    expect(cfg.dist).toBe('./generated');
  });

  it('preserves narrow type', () => {
    const cfg = defineConfig({ controllers: [A], dist: './x' });
    expectTypeOf(cfg).toMatchTypeOf<GenerateClientOptions>();
  });

  it('accepts watch option', () => {
    const cfg = defineConfig({ controllers: [A], dist: './x', watch: true });
    expect(cfg.watch).toBe(true);
  });
});
