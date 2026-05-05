---
sidebar_position: 4
---

# ミドルウェア

ミドルウェア関数はルートハンドラーの前に実行され、リクエスト、レスポンス、コンテキストを変更できます。

## 関数ミドルウェア

最もシンプルなミドルウェアは、コンテキストとnext関数を受け取る関数です：

```typescript
import type { FunctionMiddleware } from '@zeltjs/core';

export const loggingMiddleware: FunctionMiddleware = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`[${c.req.method}] ${c.req.path} ${c.res.status} ${duration}ms`);
};
```

## ミドルウェアのレベル

Zeltは3つのレベルでミドルウェアをサポートし、**グローバル → コントローラー → メソッド**の順序で実行されます。

### グローバルミドルウェア

`createHttpApp()`ですべてのルートに適用：

```typescript
import { createHttpApp } from '@zeltjs/core';
import { loggingMiddleware } from './middlewares/logging';

export const app = createHttpApp({
  controllers: [UserController],
  middlewares: [loggingMiddleware],
});
```

### コントローラーミドルウェア

`@UseMiddleware`でコントローラー内のすべてのメソッドに適用：

```typescript
import { Controller, Get, UseMiddleware } from '@zeltjs/core';

@UseMiddleware(authMiddleware)
@Controller('/admin')
export class AdminController {
  @Get('/dashboard')
  dashboard() {
    return { stats: [] };
  }
}
```

### メソッドミドルウェア

特定のメソッドにのみ適用：

```typescript
@Controller('/posts')
export class PostController {
  @Get('/')
  findAll() {
    return { posts: [] };
  }

  @UseMiddleware(adminOnlyMiddleware)
  @Delete('/:id')
  remove(id = pathParam('id')) {
    return { deleted: id };
  }
}
```

## ミドルウェアのスキップ

`@SkipMiddleware`を使用して特定のメソッドからミドルウェアを除外：

```typescript
import { Controller, Get, SkipMiddleware } from '@zeltjs/core';

@Controller('/api')
export class ApiController {
  @Get('/protected')
  protected() {
    return { secret: 'data' };
  }

  @SkipMiddleware(authMiddleware)
  @Get('/health')
  health() {
    return { status: 'ok' };
  }
}
```

## コンテキストの共有

ミドルウェアは`setContext()`と`getContext()`を通じてハンドラーとデータを共有できます。

### 型安全なコンテキスト

モジュール拡張を使用してコンテキストの型を定義：

```typescript
declare module '@zeltjs/core' {
  interface RequestContextSchema {
    user: { id: number; name: string };
  }
}
```

### ミドルウェアでのコンテキスト設定

```typescript
import type { FunctionMiddleware } from '@zeltjs/core';

export const authMiddleware: FunctionMiddleware = async (c, next) => {
  const token = c.req.header('Authorization');
  const user = await verifyToken(token);
  c.set('user', user);
  await next();
};
```

### ハンドラーでのコンテキスト読み取り

```typescript
import { Controller, Get, getContext } from '@zeltjs/core';

@Controller('/profile')
export class ProfileController {
  @Get('/')
  getProfile(user = getContext('user')) {
    return { id: user?.id, name: user?.name };
  }
}
```

## クラスミドルウェア

依存性注入が必要なミドルウェアには`@Middleware`を使用：

```typescript
import { Middleware, inject, Injectable } from '@zeltjs/core';
import type { RequestContext, Next } from '@zeltjs/core';

@Injectable()
class ConfigService {
  getSecret() {
    return process.env.SECRET;
  }
}

@Middleware
export class AuthMiddleware {
  constructor(private config = inject(ConfigService)) {}

  async use(c: RequestContext, next: Next): Promise<Response | undefined> {
    const secret = this.config.getSecret();
    // ... 認証ロジック
    await next();
    return undefined;
  }
}
```

クラスミドルウェアは関数ミドルウェアと同様に使用：

```typescript
@UseMiddleware(AuthMiddleware)
@Controller('/admin')
export class AdminController {
  // ...
}
```

## リクエストフロー

```
Request
    ↓
グローバルミドルウェア (next前)
    ↓
コントローラーミドルウェア (next前)
    ↓
メソッドミドルウェア (next前)
    ↓
ルートハンドラー
    ↓
メソッドミドルウェア (next後)
    ↓
コントローラーミドルウェア (next後)
    ↓
グローバルミドルウェア (next後)
    ↓
Response
```

ミドルウェアは`await next()`の前後にロジックを配置することで、ルートハンドラーの前後両方で処理を行えます。

## 実行順序

ミドルウェアは以下の順序で実行されます：

1. **グローバルミドルウェア**（配列順）
2. **コントローラーミドルウェア**（デコレーター順）
3. **メソッドミドルウェア**（デコレーター順）
4. **ルートハンドラー**
5. **ハンドラー後のミドルウェア**（`next()`後、逆順）

```typescript
const globalMw: FunctionMiddleware = async (c, next) => {
  console.log('1. global before');
  await next();
  console.log('6. global after');
};

const controllerMw: FunctionMiddleware = async (c, next) => {
  console.log('2. controller before');
  await next();
  console.log('5. controller after');
};

const methodMw: FunctionMiddleware = async (c, next) => {
  console.log('3. method before');
  await next();
  console.log('4. method after');
};
```

## よくあるパターン

ミドルウェアは関数またはクラスで記述できます。シンプルな場合は関数を、依存性注入や状態が必要な場合はクラスを使用します。

### アクセス制限

サービスを注入する必要がある場合はクラスミドルウェアを使用：

```typescript
@Middleware
export class RequireAdmin {
  constructor(private authService = inject(AuthService)) {}

  async use(c: RequestContext, next: Next): Promise<Response | undefined> {
    const user = c.get('user');
    if (!this.authService.isAdmin(user)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
    return undefined;
  }
}
```

### レスポンスの変換

シンプルな変換には関数ミドルウェアが適しています：

```typescript
const wrapResponse: FunctionMiddleware = async (c, next) => {
  await next();
  const body = await c.res.json();
  c.res = c.json({ success: true, data: body });
};
```

### レスポンス時間の計測

```typescript
const timing: FunctionMiddleware = async (c, next) => {
  const start = Date.now();
  await next();
  c.res.headers.set('X-Response-Time', `${Date.now() - start}ms`);
};
```

### レスポンスのキャッシュ

状態を保持する必要がある場合はクラスミドルウェアを使用：

```typescript
@Middleware
export class CacheResponse {
  private cache = new Map<string, Response>();

  async use(c: RequestContext, next: Next): Promise<Response | undefined> {
    const key = c.req.url;
    const cached = this.cache.get(key);
    if (cached) return cached.clone();

    await next();
    this.cache.set(key, c.res.clone());
    return undefined;
  }
}
```
