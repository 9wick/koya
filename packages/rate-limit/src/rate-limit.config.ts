import { Config, inject } from '@zeltjs/core';
import { MemoryKV, type AtomicKVStore } from '@zeltjs/kv';

export type LogFn = (msg: string, context?: unknown) => void;

@Config
export class RateLimitConfig {
  static readonly Token = RateLimitConfig;

  readonly store: AtomicKVStore;
  readonly warn: LogFn;

  constructor(kv = inject(MemoryKV), warn?: LogFn) {
    this.store = kv.namespace('rate-limit:')._unsafeUnwrap();
    this.warn = warn ?? ((msg, ctx) => console.warn(msg, ctx));
  }

  defaultLimit = 100;
  defaultWindowSec = 60;
  failureMode: 'open' | 'closed' = 'open';
}
