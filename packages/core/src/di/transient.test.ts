import { injectable } from '@needle-di/core';
import { describe, expect, it } from 'vitest';

import { isTransientClass, registerAsTransient } from './transient';

describe('transient mechanism', () => {
  describe('registerAsTransient / isTransientClass', () => {
    it('returns false for unregistered class', () => {
      class NotTransient {}
      expect(isTransientClass(NotTransient)).toBe(false);
    });

    it('returns true after registerAsTransient', () => {
      @injectable()
      class TransientClass {}
      registerAsTransient(TransientClass);
      expect(isTransientClass(TransientClass)).toBe(true);
    });
  });
});
