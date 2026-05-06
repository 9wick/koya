export type KVError =
  | { type: 'INVALID_TTL'; ttlSec: number; message: string }
  | { type: 'EMPTY_NAMESPACE'; message: string }
  | { type: 'INVALID_VALUE'; reason: string; message: string }
  | { type: 'STORE_OPERATION_FAILED'; op: string; cause: unknown; message: string };

export const invalidTtl = (ttlSec: number): KVError => ({
  type: 'INVALID_TTL',
  ttlSec,
  message: `ttlSec must be > 0, got ${ttlSec}`,
});

export const emptyNamespace = (): KVError => ({
  type: 'EMPTY_NAMESPACE',
  message: 'namespace prefix must not be empty',
});

export const invalidValue = (reason: string): KVError => ({
  type: 'INVALID_VALUE',
  reason,
  message: `invalid value: ${reason}`,
});

export const storeOperationFailed = (op: string, cause: unknown): KVError => ({
  type: 'STORE_OPERATION_FAILED',
  op,
  cause,
  message: `store operation '${op}' failed: ${cause instanceof Error ? cause.message : String(cause)}`,
});
