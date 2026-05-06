import Redis, { type RedisOptions } from 'ioredis';

import { INCR_WITH_TTL_LUA } from './lua-scripts';

export class ZeltRedis extends Redis {
  constructor(url: string, options: RedisOptions = {}) {
    super(url, options);
  }

  async incrWithTtl(key: string, by: number, ttlSec: number | undefined): Promise<number> {
    const ttlArg = ttlSec !== undefined ? String(ttlSec) : '';
    return this.eval(INCR_WITH_TTL_LUA, 1, key, by, ttlArg) as Promise<number>;
  }
}
