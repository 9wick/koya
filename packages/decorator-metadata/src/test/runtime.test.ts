import { describe, expect, it } from 'vitest';
import { getCallerPosition } from '../runtime/position';

describe('getCallerPosition', () => {
  it('returns position with sourceFile, line, column', () => {
    const pos = getCallerPosition();

    expect(pos).toBeDefined();
    expect(pos?.sourceFile).toContain('runtime.test.ts');
    expect(typeof pos?.line).toBe('number');
    expect(typeof pos?.column).toBe('number');
    expect(pos?.line).toBeGreaterThan(0);
    expect(pos?.column).toBeGreaterThan(0);
  });
});
