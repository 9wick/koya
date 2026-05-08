---
sidebar_position: 7
---

# テスト

Zeltはアプリケーションをテストするためのユーティリティを含む`@zeltjs/testing`パッケージを提供しています。依存性注入のサポートとTestcontainers統合が含まれています。

## インストール

```bash
pnpm add -D @zeltjs/testing vitest
```

## createTestTarget

`createTestTarget`は、依存性注入を使用してサービスをインスタンス化するための主要なテストユーティリティです。ライフサイクル管理とクリーンアップを自動的に処理します。

```typescript
import { describe, it, expect } from 'vitest';
import { createTestTarget } from '@zeltjs/testing';
import { UserService } from './user.service';
import { ProcessEnvConfig } from '@zeltjs/core';

describe('UserService', () => {
  it('should create user', async () => {
    const { target, shutdown } = await createTestTarget(UserService, {
      configs: [ProcessEnvConfig],
    });

    const user = await target.create({ name: 'Alice' });
    expect(user.name).toBe('Alice');
  });
});
```

### オプション

| オプション | 型 | 説明 |
|-----------|---|-----|
| `configs` | `Class[]` | 登録する設定クラス |
| `overrides` | `Override[]` | 依存関係のモック実装 |

### 戻り値

| プロパティ | 型 | 説明 |
|-----------|---|-----|
| `target` | `T` | インスタンス化されたサービス |
| `get` | `(cls) => T` | コンテナから追加の依存関係を解決 |
| `shutdown` | `() => Promise<void>` | クリーンアップ関数（vitestの`afterAll`で自動呼び出し） |

### 依存関係のモック

`overrides`を使用して実際の実装をモックに置き換えます：

```typescript
import { createTestTarget } from '@zeltjs/testing';
import { UserService } from './user.service';
import { EmailService } from './email.service';

describe('UserService', () => {
  it('should send welcome email', async () => {
    const mockEmailService = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    const { target } = await createTestTarget(UserService, {
      overrides: [
        { provide: EmailService, useValue: mockEmailService },
      ],
    });

    await target.register({ email: 'alice@example.com' });
    expect(mockEmailService.send).toHaveBeenCalledWith(
      'alice@example.com',
      expect.stringContaining('Welcome')
    );
  });
});
```

## HTTPテスト

Honoの組み込みリクエストヘルパーを使用してアプリケーションのHTTPエンドポイントをテストします：

```typescript
import { describe, it, expect } from 'vitest';
import { app } from './app';

describe('Hello API', () => {
  it('should return greeting', async () => {
    const res = await app.request('/hello/world');
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ message: 'Hello, world!' });
  });
});
```

## 型安全なクライアントでのテスト

生成された`AppType`とHonoのクライアントを使用して、完全に型付けされたテストを行います。`AppType`の生成方法は[OpenAPIと型生成](./openapi.md)を参照してください。

```typescript
import { hc } from 'hono/client';
import { describe, it, expect } from 'vitest';
import { app } from './app';
import type { AppType } from './generated/app.gen';

describe('Hello API', () => {
  const client = hc<AppType>('http://localhost', {
    fetch: (input, init) => app.fetch(new Request(input, init)),
  });

  it('should return greeting with type safety', async () => {
    const res = await client.hello[':name'].$get({ 
      param: { name: 'world' } 
    });
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe('Hello, world!');
  });
});
```

## Testcontainers統合

Redisなどの外部サービスを必要とする統合テストでは、Testcontainersを使用します。Zeltはライフサイクルシステムと統合された事前設定済みのコンテナ設定を提供しています。

### Redis統合テスト

```bash
pnpm add -D @zeltjs/testing testcontainers
```

```typescript
import { describe, it, expect } from 'vitest';
import { createTestTarget } from '@zeltjs/testing';
import { RedisTestContainerConfig } from '@zeltjs/testing/redis';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  it('should cache values in Redis', async () => {
    const { target } = await createTestTarget(CacheService, {
      configs: [RedisTestContainerConfig],
    });

    await target.set('key', 'value');
    const result = await target.get('key');
    
    expect(result).toBe('value');
  });
});
```

`RedisTestContainerConfig`は自動的に以下を行います：
- テスト前にRedisコンテナを起動
- `RedisConfig`に依存するサービスに接続URLを提供
- テスト後にコンテナを停止してクリーンアップ

### カスタムコンテナ設定

`Lifecycle`インターフェースを実装して独自のコンテナ設定を作成：

```typescript
import { Config, inject, LifecycleManager, type Lifecycle } from '@zeltjs/core';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';

@Config
export class PostgresTestContainerConfig implements Lifecycle {
  private container: StartedTestContainer | undefined;
  private connectionUrl = '';

  constructor(lifecycle = inject(LifecycleManager)) {
    lifecycle.register(this);
  }

  async startup(): Promise<void> {
    this.container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'testdb',
      })
      .withExposedPorts(5432)
      .start();

    const host = this.container.getHost();
    const port = this.container.getMappedPort(5432);
    this.connectionUrl = `postgres://test:test@${host}:${port}/testdb`;
  }

  async shutdown(): Promise<void> {
    await this.container?.stop();
  }

  get url(): string {
    return this.connectionUrl;
  }
}
```

## ライフサイクル管理

`createTestTarget`は依存関係のライフサイクルを自動的に管理します：

1. **起動**: すべての登録された`Lifecycle`実装がテスト前に起動
2. **シャットダウン**: vitestの`afterAll`フックでクリーンアップが自動呼び出し

これにより、テストが失敗してもTestcontainersやその他のリソースが適切にクリーンアップされます。
