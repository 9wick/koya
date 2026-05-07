import { describe, expect, it } from 'vitest';
import { Injectable, inject } from '@zeltjs/core';

import { createTestTarget } from './test-target';

describe('createTestTarget', () => {
  it('resolves a simple injectable class', () => {
    @Injectable()
    class SimpleService {
      getValue() {
        return 'hello';
      }
    }

    const { target } = createTestTarget(SimpleService);

    expect(target.getValue()).toBe('hello');
  });

  it('resolves with dependency injection', () => {
    @Injectable()
    class Repository {
      getData() {
        return 'real-data';
      }
    }

    @Injectable()
    class Service {
      constructor(private repo = inject(Repository)) {}

      process() {
        return `processed: ${this.repo.getData()}`;
      }
    }

    const { target } = createTestTarget(Service);

    expect(target.process()).toBe('processed: real-data');
  });

  it('allows overriding dependencies with mock values', () => {
    @Injectable()
    class Repository {
      getData() {
        return 'real-data';
      }
    }

    @Injectable()
    class Service {
      constructor(private repo = inject(Repository)) {}

      process() {
        return `processed: ${this.repo.getData()}`;
      }
    }

    const mockRepo = {
      getData: () => 'mock-data',
    };

    const { target } = createTestTarget(Service, {
      overrides: [{ provide: Repository, useValue: mockRepo as Repository }],
    });

    expect(target.process()).toBe('processed: mock-data');
  });

  it('exposes container.get for resolving additional dependencies', () => {
    @Injectable()
    class ServiceA {
      name = 'A';
    }

    @Injectable()
    class ServiceB {
      name = 'B';
    }

    const { target, get } = createTestTarget(ServiceA);

    expect(target.name).toBe('A');

    const serviceB = get(ServiceB);
    expect(serviceB.name).toBe('B');
  });

  it('works with class-based token injection', () => {
    @Injectable()
    class ConfigService {
      apiUrl = 'https://default.api';
    }

    @Injectable()
    class ApiClient {
      constructor(private config = inject(ConfigService)) {}

      getUrl() {
        return this.config.apiUrl;
      }
    }

    const mockConfig = { apiUrl: 'https://test.api' };

    const { target } = createTestTarget(ApiClient, {
      overrides: [{ provide: ConfigService, useValue: mockConfig as ConfigService }],
    });

    expect(target.getUrl()).toBe('https://test.api');
  });
});
