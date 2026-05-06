import type { Result, ResultAsync } from 'neverthrow';

import type { KVError } from './errors';

/** Top-level driver. namespace で view を取り出すまで data ops は不可。 */
export interface KVDriver {
  namespace(prefix: string): Result<KVStore, KVError>;
}

/** atomic 操作対応の driver。namespace の戻り値が AtomicKVStore */
export interface AtomicKVDriver extends KVDriver {
  namespace(prefix: string): Result<AtomicKVStore, KVError>;
}

/** namespaced view。実際の data ops はここ */
export interface KVStore {
  get<T>(key: string): ResultAsync<T | undefined, KVError>;
  set<T>(key: string, value: T, opts?: SetOptions): ResultAsync<void, KVError>;
  del(key: string): ResultAsync<void, KVError>;
  has(key: string): ResultAsync<boolean, KVError>;
  /** TTL 延長 (session touch / lock extend 用)。key 不在時は false。 */
  expire(key: string, ttlSec: number): ResultAsync<boolean, KVError>;
  /** 子 namespace。チェーン可能。 */
  namespace(prefix: string): Result<KVStore, KVError>;
}

/** atomic 操作対応 view */
export interface AtomicKVStore extends KVStore {
  /** atomic incr。最初の incr 時のみ TTL をセット。 */
  incr(key: string, by?: number, opts?: { ttlSec?: number }): ResultAsync<number, KVError>;
  /** atomic set if not exists。set されたら true、既存なら false。 */
  setnx<T>(key: string, value: T, opts?: SetOptions): ResultAsync<boolean, KVError>;
  namespace(prefix: string): Result<AtomicKVStore, KVError>;
}

export type SetOptions = {
  ttlSec?: number;
};
