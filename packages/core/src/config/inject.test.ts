import { describe, it, expect } from 'vitest';
import { Container, injectable } from '@needle-di/core';

import { Config } from './decorator';
import { injectConfig } from './inject';

describe('injectConfig', () => {
  it('injects config via Token', () => {
    @Config
    class AppConfig {
      static readonly Token = AppConfig;
      name = 'myapp';
    }

    @injectable()
    class AppService {
      constructor(private config = injectConfig(AppConfig)) {}
      getName() {
        return this.config.name;
      }
    }

    const container = new Container();
    const service = container.get(AppService);
    expect(service.getName()).toBe('myapp');
  });
});
