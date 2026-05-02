import * as v from 'valibot';

export const toErrorResponse = (error: unknown): Response => {
  if (error instanceof v.ValiError) {
    return Response.json({ error: 'validation_failed', issues: error.issues }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : 'unknown error';
  return Response.json({ error: 'internal_error', message }, { status: 500 });
};
