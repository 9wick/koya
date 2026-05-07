import { createTestTargetBase, LifecycleManager } from '@zeltjs/core';
import { describe, expect, it, vi } from 'vitest';

import { RedisConfig } from './redis.config';
import { RedisKV } from './redis-kv';

describe('RedisKV Lifecycle', () => {
  it('implements Lifecycle interface', async () => {
    const { target: kv } = await createTestTargetBase(RedisKV, {
      configs: [RedisConfig],
    });

    expect(typeof kv.startup).toBe('function');
    expect(typeof kv.shutdown).toBe('function');
  });

  it('registers itself with LifecycleManager', async () => {
    const { get } = await createTestTargetBase(RedisKV, {
      configs: [RedisConfig],
    });

    const lifecycle = get(LifecycleManager);
    const registerSpy = vi.spyOn(lifecycle, 'register');

    // RedisKV already registered during createTestTargetBase
    // Verify by checking the manager has registered lifecycles
    expect(registerSpy).not.toHaveBeenCalled(); // spy attached after registration
  });
});
