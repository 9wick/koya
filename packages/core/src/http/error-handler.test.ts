import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { toErrorResponse } from './error-handler';

describe('toErrorResponse', () => {
  it('returns 400 with structured issues for ValiError', async () => {
    const result = v.safeParse(v.object({ name: v.string() }), {});
    if (result.issues === undefined) {
      throw new Error('expected ValiError fixture to produce issues');
    }
    const error = new v.ValiError(result.issues);
    const res = toErrorResponse(error);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; issues: unknown[] };
    expect(json.error).toBe('validation_failed');
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it('returns 500 for generic Error with the original message', async () => {
    const res = toErrorResponse(new Error('boom'));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string; message: string };
    expect(json).toEqual({ error: 'internal_error', message: 'boom' });
  });

  it('returns 500 for non-Error thrown values with a fallback message', async () => {
    const res = toErrorResponse('not an Error');
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string; message: string };
    expect(json.message).toBe('unknown error');
  });
});
