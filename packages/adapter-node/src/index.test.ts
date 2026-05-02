import { describe, expect, it } from 'vitest';

import * as adapter from './index';

describe('@koya/adapter-node', () => {
  it('module loads', () => {
    expect(adapter).toBeDefined();
  });
});
