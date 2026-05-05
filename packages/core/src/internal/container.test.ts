import { describe, it, expect } from 'vitest';
import { injectable } from '@needle-di/core';
import { Config, injectConfig } from '../config';
import { createContainer } from './container';

describe('createContainer with configs', () => {
  it('binds user config to parent Token', () => {
    @Config
    class BaseConfig {
      static readonly Token = BaseConfig;
      get value() { return 'base'; }
    }

    @Config
    class UserConfig extends BaseConfig {
      override get value() { return 'user'; }
    }

    @injectable()
    class TestService {
      constructor(private config = injectConfig(BaseConfig)) {}
      getValue() { return this.config.value; }
    }

    const resolver = createContainer({ configs: [UserConfig] });
    const service = resolver.get(TestService);
    expect(service.getValue()).toBe('user');
  });

  it('uses default config when no override provided', () => {
    @Config
    class DefaultConfig {
      static readonly Token = DefaultConfig;
      get value() { return 'default'; }
    }

    @injectable()
    class TestService {
      constructor(private config = injectConfig(DefaultConfig)) {}
      getValue() { return this.config.value; }
    }

    const resolver = createContainer({ configs: [] });
    const service = resolver.get(TestService);
    expect(service.getValue()).toBe('default');
  });
});
