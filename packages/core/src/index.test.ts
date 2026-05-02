import { __version } from '@koya/testing';
import { describe, expect, it } from 'vitest';

import * as lambda from './lambda';
import * as workers from './workers';

import * as core from './index';

describe('@koya/core entries', () => {
  it('index module loads', () => {
    expect(core).toBeDefined();
  });

  it('workers subpath module loads', () => {
    expect(workers).toBeDefined();
  });

  it('lambda subpath module loads', () => {
    expect(lambda).toBeDefined();
  });

  it('reaches @koya/testing via workspace linking (dogfood)', () => {
    expect(__version).toBe('0.0.0');
  });
});
