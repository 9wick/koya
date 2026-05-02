import { describe, expect, it } from 'vitest';

import { __version } from './index';

describe('@koya/testing', () => {
  it('module loads and exports __version', () => {
    expect(__version).toBe('0.0.0');
  });
});
