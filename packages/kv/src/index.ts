export { MemoryKVService, MemoryKVService as MemoryKV } from './memory-kv.service';

export { KVError, type KVErrorType } from './errors';

export type {
  AtomicKVDriver,
  AtomicKVStore,
  Defined,
  KVDriver,
  KVStore,
  NonEmptyString,
  SetOptions,
} from './types';

export { joinPrefix } from './namespace';

export { serialize, deserialize } from './serialize';
