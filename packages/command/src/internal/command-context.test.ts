import { describe, expect, it } from 'vitest';

import { getCommandContext, runInCommandContext } from './command-context';

describe('command-context', () => {
  it('returns error outside command context', () => {
    const result = getCommandContext();
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe('CONTEXT_NOT_FOUND');
    }
  });

  it('returns context within runInCommandContext', () => {
    const ctx = { parsedArgs: { target: 'world', port: 3000 } };

    const result = runInCommandContext(ctx, () => getCommandContext());

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toBe(ctx);
      expect(result.value.parsedArgs).toEqual({ target: 'world', port: 3000 });
    }
  });

  it('supports nested contexts (inner overrides outer)', () => {
    const outer = { parsedArgs: { env: 'dev' } };
    const inner = { parsedArgs: { env: 'prod' } };

    runInCommandContext(outer, () => {
      const outerResult = getCommandContext();
      expect(outerResult.isOk()).toBe(true);
      if (outerResult.isOk()) {
        expect(outerResult.value.parsedArgs['env']).toBe('dev');
      }

      runInCommandContext(inner, () => {
        const innerResult = getCommandContext();
        expect(innerResult.isOk()).toBe(true);
        if (innerResult.isOk()) {
          expect(innerResult.value.parsedArgs['env']).toBe('prod');
        }
      });

      const outerResult2 = getCommandContext();
      expect(outerResult2.isOk()).toBe(true);
      if (outerResult2.isOk()) {
        expect(outerResult2.value.parsedArgs['env']).toBe('dev');
      }
    });
  });
});
