import * as v from 'valibot';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  errorBodySchema,
  validationErrorBodySchema,
  type ErrorBody,
  type ValidationErrorBody,
} from './error-schema';

describe('validationErrorBodySchema', () => {
  it('accepts valid body', () => {
    const sample: ValidationErrorBody = {
      code: 'VALIDATION_FAILED',
      issues: [],
    };
    expect(() => v.parse(validationErrorBodySchema, sample)).not.toThrow();
  });

  it('rejects wrong code literal', () => {
    expect(() => v.parse(validationErrorBodySchema, { code: 'OTHER', issues: [] })).toThrow();
  });

  it('round-trips a real ValiError', () => {
    const schema = v.object({ name: v.string() });
    const result = v.safeParse(schema, { name: 123 });
    if (result.success) throw new Error('should fail');
    const body: ValidationErrorBody = {
      code: 'VALIDATION_FAILED',
      issues: result.issues,
    };
    expect(() => v.parse(validationErrorBodySchema, body)).not.toThrow();
  });
});

describe('errorBodySchema', () => {
  it('accepts VALIDATION_FAILED variant', () => {
    const body: ErrorBody = { code: 'VALIDATION_FAILED', issues: [] };
    expect(() => v.parse(errorBodySchema, body)).not.toThrow();
  });

  it('accepts INTERNAL_ERROR variant', () => {
    const body: ErrorBody = { code: 'INTERNAL_ERROR', message: 'boom' };
    expect(() => v.parse(errorBodySchema, body)).not.toThrow();
  });

  it('rejects unknown code literal', () => {
    expect(() => v.parse(errorBodySchema, { code: 'OTHER_ERROR', message: 'x' })).toThrow();
  });

  it('rejects INTERNAL_ERROR without message', () => {
    expect(() => v.parse(errorBodySchema, { code: 'INTERNAL_ERROR' })).toThrow();
  });
});

describe('ErrorBody — discriminator narrowing (type-level)', () => {
  it('narrows INTERNAL_ERROR variant', () => {
    expectTypeOf<Extract<ErrorBody, { code: 'INTERNAL_ERROR' }>>().toEqualTypeOf<{
      code: 'INTERNAL_ERROR';
      message: string;
    }>();
  });

  it('narrows VALIDATION_FAILED variant carrying issues array', () => {
    type V = Extract<ErrorBody, { code: 'VALIDATION_FAILED' }>;
    expectTypeOf<V['issues']>().toBeArray();
  });

  it('keeps ValidationErrorBody shape-equal to VALIDATION_FAILED variant', () => {
    expectTypeOf<ValidationErrorBody>().toEqualTypeOf<
      Extract<ErrorBody, { code: 'VALIDATION_FAILED' }>
    >();
  });
});
