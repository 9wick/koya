# Koya Middleware 実装プラン

## Context

Koya フレームワークの MVP が完成し、次のフェーズとしてミドルウェア機構を導入する。目的は以下の通り：

1. **グローバルなリクエスト処理**: ロギング、CORS、圧縮などのクロスカッティング関心事
2. **認証・認可の統一的な実装**: 既存の Hono auth middleware（jwt など）を活用
3. **既存 Hono エコシステムとの互換性**: Hono middleware がそのまま使える

設計方針として、関数ミドルウェアと `@Middleware` クラスの両方をサポートし、Koya の既存パターン（WeakMap メタデータ、primitives、DI）に沿った実装とする。

---

## 実装スコープ

1. ミドルウェア機構（グローバル + デコレータベース）
2. `getContext<T>(key)` primitive
3. リクエストログミドルウェア（実装例）
4. JWT 認証ミドルウェア（実装例、Hono jwt 利用）

---

## 重要な設計判断

### 1. Entry Context 境界

**決定**: Koya primitives (`getContext`, `pathParam`, `validated` 等) は **Handler 内専用**。Middleware 内では Hono の `c.get()` / `c.set()` を直接使用する。

**理由**: 
- `runInEntryContext` は最終ハンドラ内でのみ実行される
- Middleware は Hono 標準の context API を使用することで、既存 Hono middleware との完全互換性を維持

### 2. Middleware クラス判定

**決定**: `prototype` に `use` メソッドが存在するかで判定する。

```typescript
const isMiddlewareClass = (m: MiddlewareInput): m is MiddlewareClass =>
  typeof m === 'function' && 
  m.prototype !== undefined && 
  typeof m.prototype.use === 'function';
```

### 3. SkipMiddleware 仕様

**決定**:
- **対象範囲**: Global middleware のみ（Controller/Method middleware には適用不可）
- **Identity**: 登録時の `MiddlewareInput` の参照一致で判定（DI 解決前に filter）
- **注意**: factory middleware (`cors()`, `jwt({...})`) は呼び出しごとに別インスタンスになるため、定数として共有する必要がある

### 4. Middleware 解決タイミング

**決定**: ルート登録時に一度だけ DI 解決し、インスタンスを再利用する（Controller と同じ）。

### 5. エラーハンドリング

**決定**: Hono の `onError` を使用してアプリ全体で `toErrorResponse()` に統一する。Middleware 内の throw も Koya のエラー形式で返却される。

---

## ファイル構成

```
packages/core/src/
├── middleware/
│   └── types.ts                  # 型定義（新規）
├── decorators/
│   ├── use-middleware.ts         # @UseMiddleware（新規）
│   ├── skip-middleware.ts        # @SkipMiddleware（新規）
│   └── middleware.ts             # @Middleware（新規）
├── primitives/
│   └── get-context.ts            # getContext（新規）
├── internal/
│   ├── metadata.ts               # middleware メタデータ追加（変更）
│   └── route-builder.ts          # middleware 統合（変更）
├── http/
│   └── app.ts                    # middlewares オプション追加（変更）
└── index.ts                      # exports 追加（変更）
```

---

## 実装フェーズ（TDD）

### Phase 1: 型定義（テスト不要）

`middleware/types.ts`:

```typescript
import type { Context, MiddlewareHandler, Next } from 'hono';

export type FunctionMiddleware = MiddlewareHandler;

export type MiddlewareClass = new (...args: never[]) => MiddlewareInstance;

export type MiddlewareInstance = {
  use(c: Context, next: Next): Promise<Response | void>;
};

export type MiddlewareInput = FunctionMiddleware | MiddlewareClass;

export type MiddlewareIdentifier = FunctionMiddleware | MiddlewareClass;
```

### Phase 2: getContext primitive（TDD）

**2.1 Test (Red)** - `primitives/get-context.test.ts`:

```typescript
describe('getContext', () => {
  it('returns value set in Hono context', () => {
    // c.set('user', { id: 1 }) された状態で
    // getContext('user') が { id: 1 } を返す
  });

  it('throws when key is not defined', () => {
    // 未定義キーで throw
  });
});

describe('getContextOrUndefined', () => {
  it('returns undefined when key is not defined', () => {
    // 未定義キーで undefined を返す（throw しない）
  });
});
```

**2.2 Impl (Green)** - `primitives/get-context.ts`:

```typescript
import { getEntryContext } from '../internal/entry-context';

export const getContext = <T>(key: string): T => {
  const ctx = getEntryContext();
  const value = ctx.honoContext.get(key) as T | undefined;
  if (value === undefined) {
    throw new Error(`koya: context key "${key}" is not defined`);
  }
  return value;
};

export const getContextOrUndefined = <T>(key: string): T | undefined => {
  const ctx = getEntryContext();
  return ctx.honoContext.get(key) as T | undefined;
};
```

### Phase 3: デコレータメタデータ（TDD）

**3.1 Test (Red)** - `decorators/use-middleware.test.ts`:

```typescript
describe('@UseMiddleware', () => {
  it('registers middlewares on controller metadata', () => {
    const middleware: MiddlewareHandler = async (c, next) => next();
    
    @UseMiddleware(middleware)
    @Controller('/test')
    class TestController {}
    
    const meta = getControllerMiddlewareMetadata(TestController);
    expect(meta?.middlewares).toContain(middleware);
  });

  it('appends middlewares on method metadata', () => {
    // method level の登録テスト
  });

  it('throws when applied to static method', () => {
    // static method へのエラー
  });
});
```

**3.2 Impl (Green)** - `internal/metadata.ts` 拡張 + `decorators/use-middleware.ts`

**3.3 Test (Red)** - `decorators/skip-middleware.test.ts`:

```typescript
describe('@SkipMiddleware', () => {
  it('registers skipped middlewares on method metadata', () => {
    // skip 対象が登録されること
  });
});
```

**3.4 Impl (Green)** - `decorators/skip-middleware.ts`

**3.5 Test (Red)** - `decorators/middleware.test.ts`:

```typescript
describe('@Middleware', () => {
  it('makes class injectable', () => {
    @Middleware
    class TestMiddleware {
      use(c: Context, next: Next) { return next(); }
    }
    
    const container = new Container();
    expect(container.get(TestMiddleware)).toBeInstanceOf(TestMiddleware);
  });
});
```

**3.6 Impl (Green)** - `decorators/middleware.ts`

### Phase 4: ミドルウェア統合（TDD）

**4.1 Test (Red)** - `http/app.test.ts` に追加:

```typescript
describe('middleware', () => {
  it('executes global middleware on all routes', async () => {
    const executed: string[] = [];
    const trackMiddleware: MiddlewareHandler = async (c, next) => {
      executed.push('global');
      await next();
    };
    
    @Controller('/test')
    class TestController {
      @Get('/') get() { return { ok: true }; }
    }
    
    const app = createHttpApp({
      controllers: [TestController],
      middlewares: [trackMiddleware],
    });
    
    await app.request('/test/');
    expect(executed).toContain('global');
  });

  it('executes middlewares in order: global -> controller -> method', async () => {
    const order: string[] = [];
    // 実行順序の検証
  });

  it('skips global middleware with @SkipMiddleware', async () => {
    // @SkipMiddleware で除外されること
  });

  it('resolves @Middleware class through DI', async () => {
    // DI 経由でクラスが解決されること
  });

  it('middleware can set context values accessible in handler via getContext()', async () => {
    // c.set() → getContext() の連携
  });

  it('middleware exception is handled by Koya error handler', async () => {
    // middleware 内 throw が toErrorResponse() を通ること
  });

  it('middleware can return Response to short-circuit', async () => {
    // middleware が Response 返却で中断
  });
});
```

**4.2 Impl (Green)** - `internal/route-builder.ts` + `http/app.ts`

主な変更:

1. `hono.onError` でエラーハンドリングを統一
2. `isMiddlewareClass()` でクラス判定
3. `resolveMiddleware()` でクラスなら DI 解決
4. `collectRouteMiddlewares()` で Global → Controller → Method 順に収集、Skip 適用
5. `buildRoutes` シグネチャ変更: `globalMiddlewares` 引数追加

```typescript
// app.ts
export type CreateHttpAppOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly middlewares?: readonly MiddlewareInput[];
};

export const createHttpApp = (options: CreateHttpAppOptions): HttpApp => {
  const resolver = createContainer();
  const hono = new Hono({ strict: false });
  
  // 統一エラーハンドリング
  hono.onError((err, c) => toErrorResponse(err));
  
  buildRoutes(hono, options.controllers, resolver, options.middlewares ?? []);
  // ...
};
```

### Phase 5: exports + examples

**5.1** `index.ts` に export 追加:

```typescript
// Types
export type { FunctionMiddleware, MiddlewareClass, MiddlewareInstance, MiddlewareInput } from './middleware/types';

// Decorators
export { UseMiddleware } from './decorators/use-middleware';
export { SkipMiddleware } from './decorators/skip-middleware';
export { Middleware } from './decorators/middleware';

// Primitives
export { getContext, getContextOrUndefined } from './primitives/get-context';
```

**5.2** `examples/hello/src/middlewares/logging.ts`:

```typescript
import type { MiddlewareHandler } from 'hono';

export const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`[${c.req.method}] ${c.req.path} ${c.res.status} ${duration}ms`);
};
```

**5.3** `examples/hello/src/middlewares/auth.ts`:

```typescript
import { Middleware } from '@koya/core';
import type { Context, Next } from 'hono';
import { jwt } from 'hono/jwt';

@Middleware
export class AuthMiddleware {
  async use(c: Context, next: Next): Promise<Response | void> {
    const secret = process.env.JWT_SECRET ?? 'dev-secret';
    const jwtMiddleware = jwt({ secret });
    return jwtMiddleware(c, next);
  }
}
```

---

## 検証方法

### 1. 単体テスト

```bash
cd packages/core && pnpm test
```

### 2. Example App での動作確認

```bash
cd examples/hello
pnpm dev
curl http://localhost:3000/hello/world  # ログ出力確認
```

---

## 注意事項

1. **Factory middleware の Skip**: `cors()` や `jwt({...})` は呼び出しごとに別インスタンス。Skip したい場合は定数として共有する
   ```typescript
   // Good
   export const authMiddleware = jwt({ secret: 'xxx' });
   
   @SkipMiddleware(authMiddleware)  // 同じ参照
   ```

2. **Koya primitives は Handler 内専用**: Middleware 内では `c.get()` / `c.set()` を使用

3. **複数 `@UseMiddleware`**: Controller level では最後に適用された decorator のみ有効（上書き）。Method level では append される
