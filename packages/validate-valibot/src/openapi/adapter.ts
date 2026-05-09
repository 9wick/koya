import { toJsonSchema } from '@valibot/to-json-schema';
import * as v from 'valibot';
import type { BaseSchema, BaseIssue } from 'valibot';
import type { SchemaAdapter, JsonSchema } from '@zeltjs/openapi';

type AnyValibotSchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>;

const valibotSchemaShape = v.object({
  kind: v.literal('schema'),
  type: v.string(),
  async: v.boolean(),
});

// Narrows unknown to AnyValibotSchema without a type predicate.
// The shape check via v.safeParse already validates the structural requirements.
function narrowToValibotSchema(value: unknown): AnyValibotSchema;
function narrowToValibotSchema(value: unknown): unknown {
  return value;
}

// Narrows the output of toJsonSchema to @zeltjs/openapi's JsonSchema.
// Both types share the same runtime shape; the difference is only in TS strictness.
function narrowToJsonSchema(value: unknown): JsonSchema;
function narrowToJsonSchema(value: unknown): unknown {
  return value;
}

export const valibotAdapter: SchemaAdapter = {
  toJsonSchema: (schema: unknown): JsonSchema => {
    const parsed = v.safeParse(valibotSchemaShape, schema);
    if (!parsed.success) {
      throw new Error('Invalid valibot schema: expected object with kind="schema"');
    }
    return narrowToJsonSchema(toJsonSchema(narrowToValibotSchema(schema)));
  },
};
