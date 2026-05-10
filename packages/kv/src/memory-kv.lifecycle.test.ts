import { describe, expect, it, vi } from 'vitest';
import { LifecycleManager } from '@zeltjs/core';

import { MemoryKVService } from './memory-kv.service';

describe('MemoryKVService Lifecycle', () => {
  it('implements Lifecycle interface', () => {
    const lifecycle = new LifecycleManager();
    const kv = new MemoryKVService(lifecycle);

    expect(typeof kv.startup).toBe('function');
    expect(typeof kv.shutdown).toBe('function');
  });

  it('registers itself with LifecycleManager', () => {
    const lifecycle = new LifecycleManager();
    const registerSpy = vi.spyOn(lifecycle, 'register');

    new MemoryKVService(lifecycle);

    expect(registerSpy).toHaveBeenCalledOnce();
  });
});
