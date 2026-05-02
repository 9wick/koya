import { describe, expect, it } from 'vitest';
import * as v from 'valibot';

import { runInEntryContext } from '../internal/entry-context';

import { validated } from './validated';

const Schema = v.object({ name: v.string(), age: v.number() });

describe('validated()', () => {
  it('returns parsed body when schema matches', () => {
    const result = runInEntryContext(
      {
        input: { body: { name: 'Ada', age: 36 }, pathParams: {} },
      },
      () => validated(Schema),
    );
    expect(result).toEqual({ name: 'Ada', age: 36 });
  });

  it('throws ValiError when schema does not match', () => {
    expect(() =>
      runInEntryContext({ input: { body: { name: 'Ada' }, pathParams: {} } }, () =>
        validated(Schema),
      ),
    ).toThrow(v.ValiError);
  });
});
