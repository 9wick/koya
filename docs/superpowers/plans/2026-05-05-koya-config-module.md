# Config / Module 機構 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** @koya/core に Config 機構と Logger Module を追加し、ユーザーが config を extends で上書きできるようにする

**Architecture:** `@Config` decorator が Token チェック + injectable 化を行い、`injectConfig()` で Token 経由の inject を提供。`createHttpApp({ configs })` でユーザー config を bind し、デフォルトは needle-di の auto-bind に委ねる。

**Tech Stack:** TypeScript, @needle-di/core, Vitest

---

## File Structure

```
packages/core/src/
  config/
    index.ts           # public API export
    decorator.ts       # @Config decorator
    inject.ts          # injectConfig()
    types.ts           # ConfigClass 型
    decorator.test.ts  # @Config テスト
    inject.test.ts     # injectConfig テスト
  modules/
    logger/
      index.ts         # export { Logger, LoggerConfig }
      config.ts        # LoggerConfig class
      logger.ts        # Logger class
      logger.test.ts   # Logger テスト
  http/
    app.ts             # configs 対応追加
    app.test.ts        # configs テスト追加 (既存ファイル修正)
  index.ts             # config export 追加
```

---

### Task 1: Config 型定義

**Files:**
- Create: `packages/core/src/config/types.ts`

- [ ] **Step 1: 型定義ファイルを作成**

```ts
// packages/core/src/config/types.ts
export type ConfigClass<T = unknown> = (new (...args: never[]) => T) & {
  readonly Token: new (...args: never[]) => T;
};
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/config/types.ts
git commit -m "feat(core): add ConfigClass type definition"
```

---

### Task 2: @Config Decorator

**Files:**
- Create: `packages/core/src/config/decorator.ts`
- Create: `packages/core/src/config/decorator.test.ts`

- [ ] **Step 1: テストファイルを作成**

```ts
// packages/core/src/config/decorator.test.ts
import { describe, it, expect } from 'vitest';
import { Container } from '@needle-di/core';
import { Config } from './decorator';

describe('Config decorator', () => {
  it('makes class injectable', () => {
    @Config
    class TestConfig {
      static readonly Token = TestConfig;
      value = 'test';
    }

    const container = new Container();
    const instance = container.get(TestConfig);
    expect(instance.value).toBe('test');
  });

  it('throws if Token is missing', () => {
    expect(() => {
      @Config
      class NoTokenConfig {
        value = 'test';
      }
      return NoTokenConfig;
    }).toThrow('must have static Token');
  });

  it('finds Token from parent class', () => {
    @Config
    class ParentConfig {
      static readonly Token = ParentConfig;
      get level() { return 'info'; }
    }

    @Config
    class ChildConfig extends ParentConfig {
      get level() { return 'debug'; }
    }

    const container = new Container();
    const instance = container.get(ChildConfig);
    expect(instance.level).toBe('debug');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `pnpm vitest run packages/core/src/config/decorator.test.ts`
Expected: FAIL (decorator not found)

- [ ] **Step 3: decorator を実装**

```ts
// packages/core/src/config/decorator.ts
import { injectable } from '@needle-di/core';
import type { ConfigClass } from './types';

const findToken = (cls: Function): Function | null => {
  let current: Function | null = cls;
  while (current && current !== Function.prototype) {
    if ('Token' in current) {
      return (current as { Token: Function }).Token;
    }
    current = Object.getPrototypeOf(current) as Function | null;
  }
  return null;
};

export const Config = <T extends ConfigClass>(target: T): T => {
  if (!findToken(target)) {
    throw new Error(
      `@Config class "${target.name}" must have static Token (or extend a class that has one)`
    );
  }
  injectable()(target);
  return target;
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `pnpm vitest run packages/core/src/config/decorator.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/decorator.ts packages/core/src/config/decorator.test.ts
git commit -m "feat(core): add @Config decorator"
```

---

### Task 3: injectConfig

**Files:**
- Create: `packages/core/src/config/inject.ts`
- Create: `packages/core/src/config/inject.test.ts`

- [ ] **Step 1: テストファイルを作成**

```ts
// packages/core/src/config/inject.test.ts
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
      getName() { return this.config.name; }
    }

    const container = new Container();
    const service = container.get(AppService);
    expect(service.getName()).toBe('myapp');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `pnpm vitest run packages/core/src/config/inject.test.ts`
Expected: FAIL (injectConfig not found)

- [ ] **Step 3: injectConfig を実装**

```ts
// packages/core/src/config/inject.ts
import { inject } from '@needle-di/core';
import type { ConfigClass } from './types';

export const injectConfig = <T>(configClass: ConfigClass<T>): T => {
  return inject<T>(configClass.Token);
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `pnpm vitest run packages/core/src/config/inject.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config/inject.ts packages/core/src/config/inject.test.ts
git commit -m "feat(core): add injectConfig helper"
```

---

### Task 4: Config index export

**Files:**
- Create: `packages/core/src/config/index.ts`

- [ ] **Step 1: index.ts を作成**

```ts
// packages/core/src/config/index.ts
export { Config } from './decorator';
export { injectConfig } from './inject';
export type { ConfigClass } from './types';
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/config/index.ts
git commit -m "feat(core): add config module index"
```

---

### Task 5: createHttpApp に configs 対応追加

**Files:**
- Modify: `packages/core/src/http/app.ts`
- Modify: `packages/core/src/internal/container.ts`

- [ ] **Step 1: container.ts に configs bind 機能を追加するテストを作成**

```ts
// packages/core/src/internal/container.test.ts (新規作成)
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
      get value() { return 'user'; }
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
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `pnpm vitest run packages/core/src/internal/container.test.ts`
Expected: FAIL (configs option not supported)

- [ ] **Step 3: container.ts を修正**

```ts
// packages/core/src/internal/container.ts
import { Container } from '@needle-di/core';

type Class<T> = new (...args: never[]) => T;

type CreateContainerOptions = {
  readonly configs?: readonly Class<unknown>[];
};

export type ResolverHandle = {
  readonly get: <T extends object>(cls: Class<T>) => T;
};

const findTokenOwner = (cls: Function): Function | null => {
  let current: Function | null = cls;
  while (current && current !== Function.prototype) {
    if ('Token' in current) {
      return (current as { Token: Function }).Token;
    }
    current = Object.getPrototypeOf(current) as Function | null;
  }
  return null;
};

export const createContainer = (options: CreateContainerOptions = {}): ResolverHandle => {
  const container = new Container();

  for (const configClass of options.configs ?? []) {
    const token = findTokenOwner(configClass);
    if (token && token !== configClass) {
      container.bind(configClass);
      container.bind({ provide: token, useExisting: configClass });
    }
  }

  return {
    get: <T extends object>(cls: Class<T>): T => container.get<T>(cls),
  };
};
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `pnpm vitest run packages/core/src/internal/container.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/internal/container.ts packages/core/src/internal/container.test.ts
git commit -m "feat(core): add configs support to createContainer"
```

---

### Task 6: createHttpApp の options 型を更新

**Files:**
- Modify: `packages/core/src/http/app.ts`

- [ ] **Step 1: app.ts に configs を追加**

```ts
// packages/core/src/http/app.ts の変更箇所

// 型定義に configs を追加
export type CreateHttpAppOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly middlewares?: readonly MiddlewareInput[];
  readonly configs?: readonly (new (...args: never[]) => unknown)[];
};

// createHttpApp 内で createContainer に configs を渡す
export const createHttpApp = (options: CreateHttpAppOptions): HttpApp => {
  const resolver = createContainer({ configs: options.configs });
  // ... 既存の処理
};
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存テストが通ることを確認**

Run: `pnpm vitest run packages/core/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/http/app.ts
git commit -m "feat(core): add configs option to createHttpApp"
```

---

### Task 7: LoggerConfig

**Files:**
- Create: `packages/core/src/modules/logger/config.ts`

- [ ] **Step 1: LoggerConfig を作成**

```ts
// packages/core/src/modules/logger/config.ts
import { Config } from '../../config';

@Config
export class LoggerConfig {
  static readonly Token = LoggerConfig;

  get level(): 'debug' | 'info' | 'warn' | 'error' {
    return 'info';
  }
}
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/modules/logger/config.ts
git commit -m "feat(core): add LoggerConfig"
```

---

### Task 8: Logger

**Files:**
- Create: `packages/core/src/modules/logger/logger.ts`
- Create: `packages/core/src/modules/logger/logger.test.ts`

- [ ] **Step 1: テストファイルを作成**

```ts
// packages/core/src/modules/logger/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Container } from '@needle-di/core';
import { Logger } from './logger';
import { LoggerConfig } from './config';
import { Config, injectConfig } from '../../config';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs info by default', () => {
    const container = new Container();
    const logger = container.get(Logger);

    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledWith('[INFO] test message');
  });

  it('respects log level from config', () => {
    @Config
    class DebugConfig extends LoggerConfig {
      get level(): 'debug' | 'info' | 'warn' | 'error' {
        return 'warn';
      }
    }

    const container = new Container();
    container.bind(DebugConfig);
    container.bind({ provide: LoggerConfig, useExisting: DebugConfig });

    const logger = container.get(Logger);

    logger.info('should not log');
    expect(consoleSpy).not.toHaveBeenCalled();

    logger.warn('should log');
    expect(consoleSpy).toHaveBeenCalledWith('[WARN] should log');
  });

  it('logs debug when level is debug', () => {
    @Config
    class DebugConfig extends LoggerConfig {
      get level(): 'debug' | 'info' | 'warn' | 'error' {
        return 'debug';
      }
    }

    const container = new Container();
    container.bind(DebugConfig);
    container.bind({ provide: LoggerConfig, useExisting: DebugConfig });

    const logger = container.get(Logger);

    logger.debug('debug message');
    expect(consoleSpy).toHaveBeenCalledWith('[DEBUG] debug message');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `pnpm vitest run packages/core/src/modules/logger/logger.test.ts`
Expected: FAIL (Logger not found)

- [ ] **Step 3: Logger を実装**

```ts
// packages/core/src/modules/logger/logger.ts
import { Injectable } from '../../decorators/injectable';
import { injectConfig } from '../../config';
import { LoggerConfig } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

@Injectable()
export class Logger {
  constructor(private config = injectConfig(LoggerConfig)) {}

  debug(msg: string): void {
    this.log('debug', msg);
  }

  info(msg: string): void {
    this.log('info', msg);
  }

  warn(msg: string): void {
    this.log('warn', msg);
  }

  error(msg: string): void {
    this.log('error', msg);
  }

  private log(level: LogLevel, msg: string): void {
    const configLevel = this.config.level;
    if (LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(configLevel)) {
      console.log(`[${level.toUpperCase()}] ${msg}`);
    }
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `pnpm vitest run packages/core/src/modules/logger/logger.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/modules/logger/logger.ts packages/core/src/modules/logger/logger.test.ts
git commit -m "feat(core): add Logger class"
```

---

### Task 9: Logger module index

**Files:**
- Create: `packages/core/src/modules/logger/index.ts`

- [ ] **Step 1: index.ts を作成**

```ts
// packages/core/src/modules/logger/index.ts
export { Logger } from './logger';
export { LoggerConfig } from './config';
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/modules/logger/index.ts
git commit -m "feat(core): add logger module index"
```

---

### Task 10: core index に config を export

**Files:**
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: index.ts に config export を追加**

```ts
// packages/core/src/index.ts に以下を追加

export { Config, injectConfig } from './config';
export type { ConfigClass } from './config';
```

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 全テストを実行**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export Config and injectConfig from index"
```

---

### Task 11: package.json に modules export を追加

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: package.json の exports に modules/logger を追加**

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./modules/logger": {
      "import": "./dist/modules/logger/index.js",
      "types": "./dist/modules/logger/index.d.ts"
    }
  }
}
```

- [ ] **Step 2: ビルドを実行**

Run: `pnpm --filter @koya/core build`
Expected: 成功

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json
git commit -m "feat(core): add modules/logger export to package.json"
```

---

### Task 12: Integration test

**Files:**
- Create: `packages/core/src/modules/logger/integration.test.ts`

- [ ] **Step 1: 統合テストを作成**

```ts
// packages/core/src/modules/logger/integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHttpApp, Controller, Get, inject, Config } from '../../index';
import { Logger, LoggerConfig } from './index';

describe('Logger integration', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('uses default LoggerConfig when no config provided', async () => {
    @Controller('/test')
    class TestController {
      constructor(private logger = inject(Logger)) {}

      @Get('/')
      handle() {
        this.logger.info('hello');
        return { ok: true };
      }
    }

    const app = createHttpApp({
      controllers: [TestController],
    });

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith('[INFO] hello');
  });

  it('uses custom config when provided', async () => {
    @Config
    class CustomLoggerConfig extends LoggerConfig {
      get level(): 'debug' | 'info' | 'warn' | 'error' {
        return 'error';
      }
    }

    @Controller('/test')
    class TestController {
      constructor(private logger = inject(Logger)) {}

      @Get('/')
      handle() {
        this.logger.info('should not log');
        this.logger.error('should log');
        return { ok: true };
      }
    }

    const app = createHttpApp({
      controllers: [TestController],
      configs: [CustomLoggerConfig],
    });

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('[ERROR] should log');
  });
});
```

- [ ] **Step 2: テストを実行して成功を確認**

Run: `pnpm vitest run packages/core/src/modules/logger/integration.test.ts`
Expected: PASS

- [ ] **Step 3: 全テストを実行**

Run: `pnpm vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/modules/logger/integration.test.ts
git commit -m "test(core): add Logger integration test"
```

---

### Task 13: Lint & Final check

- [ ] **Step 1: Lint を実行**

Run: `pnpm lint`
Expected: エラーなし

- [ ] **Step 2: 型チェックを実行**

Run: `pnpm tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 全テストを実行**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: ビルドを実行**

Run: `pnpm build`
Expected: 成功
