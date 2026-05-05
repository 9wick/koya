# koya Phase 2 (2): API Contract (AppType + OpenAPI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@koya/core` に `response()` primitive と `HTTPException`/`ValidationErrorBody` を追加し、新規 `@koya/contract` package で controllers list から AppType (`<dist>/app.gen.ts`) と OpenAPI 3.1 (`<dist>/openapi.json`) を build step として生成する仕組みを実装する。

**Architecture:** `@koya/core` 側は AsyncLocalStorage に hono Context を載せて `response()` primitive 経由で `c.json` 等を bypass。`@koya/contract` 側は ts-morph で controller class の source を AST 解析し、内部表現 (Route metadata) を経由して 2 系統に出力 (型 file + JSON)。CLI は `cac` + `chokidar`、config は `defineConfig` identity 関数。

**Tech Stack:** TypeScript 6.0 / hono 4.12.16 / valibot 1.3.1 / ts-morph (latest stable, install 時 pin) / @valibot/to-json-schema (latest stable, install 時 pin) / ts-json-schema-generator (latest stable, install 時 pin) / chokidar (latest stable, install 時 pin) / cac (latest stable, install 時 pin) / vitest 4.1.5 / tsdown 0.21.10

**Spec:** `docs/superpowers/specs/2026-05-03-koya-phase2-2-contract-design.md`

---

## File Structure

### `@koya/core` 変更 (既存 package)

| Path | 役割 | 変更 |
|---|---|---|
| `packages/core/src/internal/entry-context.ts` | EntryContext 定義 | `honoContext: Context` 追加 |
| `packages/core/src/internal/route-builder.ts` | route 登録 | 戻り値が `Response`/`TypedResponse` ならそのまま返し、素データなら `c.json(result)` で wrap |
| `packages/core/src/primitives/response.ts` | `response()` primitive | **新規** |
| `packages/core/src/primitives/response.test.ts` | unit test | **新規** |
| `packages/core/src/http/error-schema.ts` | `ValidationErrorBody` valibot schema | **新規** |
| `packages/core/src/http/error-schema.test.ts` | schema test | **新規** |
| `packages/core/src/http/error-handler.ts` | `toErrorResponse` | `ValidationErrorBody` schema を使うようにリファクタ |
| `packages/core/src/index.ts` | barrel | `response`, `HTTPException`, `ValidationErrorBody`, `validationErrorBodySchema` 追加 |

### `@koya/contract` 新規 package

| Path | 役割 |
|---|---|
| `packages/contract/package.json` | package metadata |
| `packages/contract/tsconfig.json` | TS config |
| `packages/contract/tsdown.config.ts` | build config |
| `packages/contract/vitest.config.ts` | test config |
| `packages/contract/src/index.ts` | public barrel: `Route`/`BuildAppType`/`generateClient`/`defineConfig`/types |
| `packages/contract/src/cli.ts` | CLI entry (`koya-contract`) |
| `packages/contract/src/types/route.ts` | `Route<M, P, H>` |
| `packages/contract/src/types/build-app-type.ts` | `BuildAppType<Routes>` |
| `packages/contract/src/types/extract.ts` | `ExtractPathParams` / `ExtractRequestBody` / `ExtractResponse` / `ExtractValidationErrors` |
| `packages/contract/src/types/validated-marker.ts` | `validated()` 戻り値の型レベル marker |
| `packages/contract/src/config/options.ts` | `GenerateClientOptions`, `defineConfig` |
| `packages/contract/src/analyzer/project.ts` | ts-morph Project 起動 helpers |
| `packages/contract/src/analyzer/decorator.ts` | `@Controller`/`@Get` 等 decorator 引数抽出 |
| `packages/contract/src/analyzer/handler.ts` | handler signature 抽出 (`validated()`/`pathParam()` の場所と引数) |
| `packages/contract/src/analyzer/response-type.ts` | TS Compiler API で handler 戻り値型を解決 |
| `packages/contract/src/analyzer/internal-representation.ts` | IR 型定義 + builder |
| `packages/contract/src/emit/app-gen.ts` | `<dist>/app.gen.ts` emitter |
| `packages/contract/src/emit/openapi.ts` | `<dist>/openapi.json` emitter |
| `packages/contract/src/emit/json-schema-input.ts` | valibot → JSON Schema (`@valibot/to-json-schema`) |
| `packages/contract/src/emit/json-schema-output.ts` | TS 型 → JSON Schema (`ts-json-schema-generator`) |
| `packages/contract/src/generate-client.ts` | `generateClient({ controllers, dist, watch? })` 本体 |
| `packages/contract/src/watch.ts` | `chokidar` watch loop |
| `packages/contract/src/load-config.ts` | `koya.config.ts` auto-detect & dynamic import |
| `packages/contract/src/__tests__/...test.ts` | unit + integration tests |

### example / docs 更新

| Path | 役割 | 変更 |
|---|---|---|
| `examples/hello/src/entry/hello.controller.ts` | controller | response()/validated() 利用例に書き換え |
| `examples/hello/src/app.ts` | composition | controllers 配列を別 file に分離 |
| `examples/hello/src/controllers.ts` | controllers list | **新規** |
| `examples/hello/koya.config.ts` | contract config | **新規** |
| `examples/hello/generated/app.gen.ts` | AppType output | **新規 (commit)** |
| `examples/hello/generated/openapi.json` | OpenAPI output | **新規 (commit)** |
| `examples/hello/src/test/hello.e2e-spec.ts` | e2e test | hc<AppType> + validation 400 narrowing |
| `examples/hello/package.json` | deps | `@koya/contract` workspace dep + `koya-contract` script |
| `docs/superpowers/specs/2026-05-02-koya-phase2-api-design.md` | Phase 2 (1) spec | §4.1 を spec §8 の文面で更新 |
| `docs/comparison/koya-vs-nestjs.md` | 比較 | RPC client 行 / hono 隠蔽境界更新 |

---

## Critical implementation references

実装中に参照すべき既存コード (PR レビュー時の二重チェック用):

- `packages/core/src/internal/entry-context.ts` — AsyncLocalStorage パターン (今回 `honoContext` を追加)
- `packages/core/src/internal/route-builder.ts:73-83` — `runInEntryContext` 呼び出し箇所 (response 拡張と TypedResponse 通過を実装)
- `packages/core/src/http/error-handler.ts` — `toErrorResponse` (今回 valibot schema 化)
- `packages/core/src/primitives/validated.ts` — primitive のパターン (これに倣う)
- `examples/hello/src/entry/hello.controller.ts` — 既存 example
- `node_modules/hono/dist/types/types.d.ts` — `TypedResponse<T, S, F>` shape (実装時に actual export を確認)

---

## Task ordering and dependencies

```
Task 1 (response primitive)         ← entry-context, route-builder 変更
Task 2 (HTTPException re-export)    ← 独立 (1 行追加)
Task 3 (ValidationErrorBody schema) ← error-handler 変更を含む
Task 4 (@koya/contract skeleton)    ← workspace 登録
Task 5 (type functions)             ← Task 3, 4 後
Task 6 (defineConfig + options)     ← Task 4 後
Task 7 (ts-morph analyzer)          ← Task 4 後
Task 8 (app.gen.ts emitter)         ← Task 5, 7 後
Task 9 (openapi.json emitter)       ← Task 7 後 (Task 5 と並列可)
Task 10 (generateClient orchestr.)  ← Task 8, 9 後
Task 11 (CLI + config loader)       ← Task 10 後
Task 12 (examples/hello rewrite)    ← Task 1, 3, 11 後
Task 13 (spec §4.1 + comparison)    ← 独立 (textual)
```

---

### Task 1: `@koya/core` `response()` primitive

**Goal:** `EntryContext` に `honoContext` を追加し、`response()` が AsyncLocalStorage 経由で hono Context bypass の `ResponseBuilder` を返す。`route-builder.ts` を改修して raw return / Response / TypedResponse を分岐。

**Files:**
- Modify: `packages/core/src/internal/entry-context.ts`
- Modify: `packages/core/src/internal/route-builder.ts`
- Create: `packages/core/src/primitives/response.ts`
- Create: `packages/core/src/primitives/response.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Extend EntryContext to carry hono Context**

`packages/core/src/internal/entry-context.ts` を以下に書き換える:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context } from 'hono';

type EntryInput = {
  readonly body: unknown;
  readonly pathParams: Readonly<Record<string, string>>;
};

export type EntryContext = {
  readonly input: EntryInput;
  readonly honoContext: Context;
};

const storage = new AsyncLocalStorage<EntryContext>();

export const runInEntryContext = <T>(ctx: EntryContext, fn: () => T): T => storage.run(ctx, fn);

export const getEntryContext = (): EntryContext => {
  const ctx = storage.getStore();
  if (!ctx) throw new Error('koya: primitive called outside entry execution');
  return ctx;
};
```

- [ ] **Step 2: Run existing tests to confirm field addition does not break callers**

Run: `pnpm --filter @koya/core test -- entry-context`
Expected: PASS (existing tests do not assert on shape outside `input`)。
失敗した場合は `entry-context.test.ts` で `honoContext` を fake (`{} as unknown as Context`) で渡すように修正。

- [ ] **Step 3: Update route-builder to inject hono Context and handle response shape**

`packages/core/src/internal/route-builder.ts` の `registerRoute` を以下に書き換え:

```ts
const isWebResponse = (v: unknown): v is Response =>
  typeof Response !== 'undefined' && v instanceof Response;

const registerRoute = (hono: Hono, resolver: ResolverHandle, route: Route): void => {
  const instance = resolver.get(route.controllerClass);
  const invoke = resolveHandler(instance, route.methodName);
  hono.on(route.method, route.fullPath, async (c) => {
    try {
      const body = await parseRequestBody(c);
      const pathParams: Readonly<Record<string, string>> = c.req.param();
      const result = await runInEntryContext(
        { input: { body, pathParams }, honoContext: c },
        async () => invoke(),
      );
      // TypedResponse / Response は内部で Response 互換オブジェクト。
      // それ以外 (素データ) は koya 拡張として c.json で wrap (spec §4.3)。
      if (isWebResponse(result)) return result;
      return c.json(result);
    } catch (error) {
      return toErrorResponse(error);
    }
  });
};
```

- [ ] **Step 4: Run route-builder tests**

Run: `pnpm --filter @koya/core test -- route-builder`
Expected: PASS。失敗した場合 `route-builder.test.ts` の expectations を `Response.json(...)` から `c.json(...)` 同等に揃える (status / body 内容は同一なので既存 assertion はだいたい通るはず)。

- [ ] **Step 5: Write failing test for response() primitive**

`packages/core/src/primitives/response.test.ts` を新規作成:

```ts
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';

import { Controller } from '../decorators/controller';
import { Get, Post } from '../decorators/http-method';
import { createContainer } from '../internal/container';
import { buildRoutes } from '../internal/route-builder';
import { response } from './response';

@Controller('/r')
class R {
  @Get('/json')
  j(res = response()) {
    return res.json({ ok: true }, 201);
  }

  @Get('/redirect')
  r(res = response()) {
    return res.redirect('/new', 301);
  }

  @Get('/text')
  t(res = response()) {
    return res.text('hello', 200);
  }

  @Get('/header')
  h(res = response()) {
    return res.header('X-Foo', 'bar').json({ ok: true });
  }

  @Post('/raw')
  raw() {
    // 素データ return → c.json で 200 wrap
    return { wrapped: true };
  }
}

describe('response()', () => {
  const hono = new Hono({ strict: false });
  buildRoutes(hono, [R], createContainer());

  it('json status code', async () => {
    const res = await hono.fetch(new Request('http://x/r/json'));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('redirect', async () => {
    const res = await hono.fetch(new Request('http://x/r/redirect', { redirect: 'manual' }));
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/new');
  });

  it('text', async () => {
    const res = await hono.fetch(new Request('http://x/r/text'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('hello');
  });

  it('header chainable', async () => {
    const res = await hono.fetch(new Request('http://x/r/header'));
    expect(res.headers.get('x-foo')).toBe('bar');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('raw return wraps with c.json', async () => {
    const res = await hono.fetch(new Request('http://x/r/raw', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wrapped: true });
  });

  it('throws when called outside entry execution', () => {
    expect(() => response()).toThrow('koya: primitive called outside entry execution');
  });
});
```

- [ ] **Step 6: Run the test to confirm it fails**

Run: `pnpm --filter @koya/core test -- response`
Expected: FAIL — `response` module does not exist yet.

- [ ] **Step 7: Implement response() primitive**

`packages/core/src/primitives/response.ts` を新規作成:

```ts
import type { Context, TypedResponse } from 'hono';

import { getEntryContext } from '../internal/entry-context';

export type ResponseBuilder = {
  json<T, S extends number = 200>(
    data: T,
    status?: S,
    headers?: Record<string, string>,
  ): TypedResponse<T, S, 'json'>;

  redirect<S extends 301 | 302 | 303 | 307 | 308 = 302>(
    url: string,
    status?: S,
  ): TypedResponse<undefined, S, 'redirect'>;

  text<T extends string, S extends number = 200>(
    data: T,
    status?: S,
  ): TypedResponse<T, S, 'text'>;

  body<T extends BodyInit, S extends number = 200>(
    data: T,
    status?: S,
  ): TypedResponse<T, S, 'body'>;

  header(name: string, value: string): ResponseBuilder;
};

const buildResponseBuilder = (c: Context): ResponseBuilder => {
  const builder: ResponseBuilder = {
    // hono の overload は status を含む形を持つので、bypass で渡す。
    // any cast しないと hono の TypedResponse generic と完全一致しないが、外向きの API 型は ResponseBuilder で固定済み。
    json: (data, status, headers) => (c.json as never)(data, status, headers),
    redirect: (url, status) => (c.redirect as never)(url, status),
    text: (data, status) => (c.text as never)(data, status),
    body: (data, status) => (c.body as never)(data, status),
    header: (name, value) => {
      c.header(name, value);
      return builder;
    },
  };
  return builder;
};

export const response = (): ResponseBuilder => {
  const ctx = getEntryContext();
  return buildResponseBuilder(ctx.honoContext);
};
```

- [ ] **Step 8: Run the test to confirm it passes**

Run: `pnpm --filter @koya/core test -- response`
Expected: PASS (6 tests)。

- [ ] **Step 9: Export response from @koya/core barrel**

`packages/core/src/index.ts` に追記:

```ts
export { response } from './primitives/response';
export type { ResponseBuilder } from './primitives/response';
```

- [ ] **Step 10: Typecheck and full test run**

Run: `pnpm --filter @koya/core typecheck && pnpm --filter @koya/core test`
Expected: PASS。

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/internal/entry-context.ts \
        packages/core/src/internal/route-builder.ts \
        packages/core/src/primitives/response.ts \
        packages/core/src/primitives/response.test.ts \
        packages/core/src/index.ts
git commit -m "feat(core): add response() primitive with hono Context bypass"
```

---

### Task 2: `@koya/core` re-export `HTTPException`

**Goal:** Phase 2 (2) spec §9.4 / §10.3 に従い hono `HTTPException` を `@koya/core` から re-export。

**Files:**
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/http/exception.test.ts`

- [ ] **Step 1: Write failing test**

`packages/core/src/http/exception.test.ts` を新規作成:

```ts
import { describe, expect, it } from 'vitest';
import { HTTPException as HonoHTTPException } from 'hono/http-exception';

import { HTTPException } from '../index';

describe('@koya/core HTTPException re-export', () => {
  it('is the same constructor as hono/http-exception', () => {
    expect(HTTPException).toBe(HonoHTTPException);
  });

  it('has expected fields', () => {
    const err = new HTTPException(404, { message: 'not found' });
    expect(err.status).toBe(404);
    expect(err.message).toBe('not found');
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `pnpm --filter @koya/core test -- exception`
Expected: FAIL — `HTTPException` not exported from index.

- [ ] **Step 3: Add re-export**

`packages/core/src/index.ts` に追記:

```ts
export { HTTPException } from 'hono/http-exception';
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `pnpm --filter @koya/core test -- exception`
Expected: PASS (2 tests)。

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/http/exception.test.ts
git commit -m "feat(core): re-export HTTPException from hono"
```

---

### Task 3: `@koya/core` `ValidationErrorBody` schema + align error-handler

**Goal:** valibot で `ValidationErrorBody` schema を定義し、`error-handler.ts` の inline literal を置き換え。`@koya/contract` から型として import される。

**Files:**
- Create: `packages/core/src/http/error-schema.ts`
- Create: `packages/core/src/http/error-schema.test.ts`
- Modify: `packages/core/src/http/error-handler.ts`
- Modify: `packages/core/src/http/error-handler.test.ts` (assertions が body 形に依存しているため確認)
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing test for error schema**

`packages/core/src/http/error-schema.test.ts` を新規作成:

```ts
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { validationErrorBodySchema, type ValidationErrorBody } from './error-schema';

describe('validationErrorBodySchema', () => {
  it('accepts valid body', () => {
    const sample: ValidationErrorBody = {
      error: 'validation_failed',
      issues: [],
    };
    expect(() => v.parse(validationErrorBodySchema, sample)).not.toThrow();
  });

  it('rejects wrong error literal', () => {
    expect(() =>
      v.parse(validationErrorBodySchema, { error: 'other', issues: [] }),
    ).toThrow();
  });

  it('round-trips a real ValiError', () => {
    const schema = v.object({ name: v.string() });
    const result = v.safeParse(schema, { name: 123 });
    if (result.success) throw new Error('should fail');
    const body: ValidationErrorBody = {
      error: 'validation_failed',
      issues: result.issues,
    };
    expect(() => v.parse(validationErrorBodySchema, body)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `pnpm --filter @koya/core test -- error-schema`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement validationErrorBodySchema**

`packages/core/src/http/error-schema.ts` を新規作成:

```ts
import * as v from 'valibot';

// ValiError.issues は `valibot.BaseIssue<unknown>[]`。客側に晒す情報のみを許容するため
// ここでは構造を緩く受け取り、未知 field を `unknown` で残す方針 (将来 Phase 2 (3) で
// `KoyaErrorSchema` の variant として精緻化する余地を残すため)。
const issueSchema = v.looseObject({
  kind: v.string(),
  type: v.string(),
  message: v.string(),
  path: v.optional(v.array(v.unknown())),
});

export const validationErrorBodySchema = v.object({
  error: v.literal('validation_failed'),
  issues: v.array(issueSchema),
});

export type ValidationErrorBody = v.InferOutput<typeof validationErrorBodySchema>;
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `pnpm --filter @koya/core test -- error-schema`
Expected: PASS (3 tests)。

- [ ] **Step 5: Refactor error-handler to use validationErrorBodySchema**

`packages/core/src/http/error-handler.ts` を以下に書き換え:

```ts
import * as v from 'valibot';

import type { ValidationErrorBody } from './error-schema';

export const toErrorResponse = (error: unknown): Response => {
  if (error instanceof v.ValiError) {
    const body: ValidationErrorBody = {
      error: 'validation_failed',
      issues: error.issues,
    };
    return Response.json(body, { status: 400 });
  }
  const message = error instanceof Error ? error.message : 'unknown error';
  return Response.json({ error: 'internal_error', message }, { status: 500 });
};
```

- [ ] **Step 6: Run existing error-handler test**

Run: `pnpm --filter @koya/core test -- error-handler`
Expected: PASS (body 形は同一なので既存 test は通る)。

- [ ] **Step 7: Export ValidationErrorBody from barrel**

`packages/core/src/index.ts` に追記:

```ts
export { validationErrorBodySchema } from './http/error-schema';
export type { ValidationErrorBody } from './http/error-schema';
```

- [ ] **Step 8: Typecheck and full test**

Run: `pnpm --filter @koya/core typecheck && pnpm --filter @koya/core test`
Expected: PASS。

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/http/error-schema.ts \
        packages/core/src/http/error-schema.test.ts \
        packages/core/src/http/error-handler.ts \
        packages/core/src/index.ts
git commit -m "feat(core): define ValidationErrorBody valibot schema and align error-handler"
```

---

### Task 4: `@koya/contract` package skeleton

**Goal:** workspace に新規 package を追加し、空 build / 空 test が通る状態にする。後続 task から実装を積む。

**Files:**
- Create: `packages/contract/package.json`
- Create: `packages/contract/tsconfig.json`
- Create: `packages/contract/tsdown.config.ts`
- Create: `packages/contract/vitest.config.ts`
- Create: `packages/contract/src/index.ts`
- Modify: `tsconfig.json` (root)

- [ ] **Step 1: Create package.json**

`packages/contract/package.json`:

```json
{
  "name": "@koya/contract",
  "version": "0.0.0",
  "type": "module",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/9wick/koya.git",
    "directory": "packages/contract"
  },
  "publishConfig": {
    "access": "public"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "bin": {
    "koya-contract": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "typecheck": "tsc -b"
  },
  "peerDependencies": {
    "@koya/core": "workspace:*"
  },
  "dependencies": {
    "cac": "6.7.14",
    "chokidar": "4.0.3",
    "ts-morph": "26.0.0",
    "ts-json-schema-generator": "2.4.0",
    "@valibot/to-json-schema": "1.3.0",
    "valibot": "1.3.1"
  },
  "devDependencies": {
    "@koya/core": "workspace:*",
    "@types/node": "22.19.17",
    "hono": "4.12.16"
  }
}
```

> **Implementation note:** `cac` / `chokidar` / `ts-morph` / `ts-json-schema-generator` / `@valibot/to-json-schema` のバージョンは上記が 2026-05-03 時点の latest stable 推定値。実装開始時に `npm view <pkg> version` で確認し、最新安定版に pin し直す。CLAUDE.md ルールにより exact version 必須。

- [ ] **Step 2: Create tsconfig.json**

`packages/contract/tsconfig.json`:

```json
{
  "extends": "@9wick/eslint-plugin-strict-type-rules/tsconfig/strictest.json",
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo",
    "experimentalDecorators": true,
    "erasableSyntaxOnly": false,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "references": [{ "path": "../core" }]
}
```

- [ ] **Step 3: Create tsdown.config.ts**

`packages/contract/tsdown.config.ts`:

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  fixedExtension: false,
});
```

- [ ] **Step 4: Create vitest.config.ts**

`packages/contract/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@koya/contract',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create empty barrel and CLI stubs**

`packages/contract/src/index.ts`:

```ts
// Phase 2 (2): @koya/contract public surface (filled by subsequent tasks)
export {};
```

`packages/contract/src/cli.ts`:

```ts
// Phase 2 (2): koya-contract CLI entry (filled by Task 11)
export {};
```

- [ ] **Step 6: Add to root tsconfig references**

`tsconfig.json` (root) を以下に書き換え:

```json
{
  "compilerOptions": {},
  "references": [
    { "path": "packages/core" },
    { "path": "packages/contract" },
    { "path": "packages/testing" },
    { "path": "packages/adapter-node" }
  ],
  "files": []
}
```

- [ ] **Step 7: Install dependencies**

Run: `pnpm install`
Expected: contract package が pnpm-workspace に登録され、依存が解決される。

- [ ] **Step 8: Verify build, typecheck, test all green**

Run: `pnpm --filter @koya/contract build && pnpm --filter @koya/contract typecheck && pnpm --filter @koya/contract test`
Expected:
- build: `dist/index.js` / `dist/cli.js` / `*.d.ts` 生成
- typecheck: PASS
- test: `No test files found` (warning は OK、exit 0)

- [ ] **Step 9: Commit**

```bash
git add packages/contract/ tsconfig.json pnpm-lock.yaml
git commit -m "feat(contract): scaffold @koya/contract package"
```

---

### Task 5: `@koya/contract` type functions (Route, BuildAppType, Extract*)

**Goal:** RPC contract の中核となる型関数を実装し、type-only test (`expectTypeOf`) で検証。

**Files:**
- Create: `packages/contract/src/types/validated-marker.ts`
- Create: `packages/contract/src/types/extract.ts`
- Create: `packages/contract/src/types/route.ts`
- Create: `packages/contract/src/types/build-app-type.ts`
- Create: `packages/contract/src/types/__tests__/extract.test.ts`
- Create: `packages/contract/src/types/__tests__/route.test.ts`
- Create: `packages/contract/src/types/__tests__/build-app-type.test.ts`
- Modify: `packages/contract/src/index.ts`

- [ ] **Step 1: Write failing test for path param extraction**

`packages/contract/src/types/__tests__/extract.test.ts` を新規作成:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type { TypedResponse } from 'hono';
import * as v from 'valibot';

import type {
  ExtractPathParams,
  ExtractRequestBody,
  ExtractResponse,
  ExtractValidationErrors,
} from '../extract';
import type { ValidatedMarker } from '../validated-marker';

describe('ExtractPathParams', () => {
  it('extracts single param', () => {
    expectTypeOf<ExtractPathParams<'/users/:id'>>().toEqualTypeOf<{ id: string }>();
  });

  it('extracts multiple params', () => {
    expectTypeOf<ExtractPathParams<'/users/:userId/posts/:postId'>>().toEqualTypeOf<{
      userId: string;
      postId: string;
    }>();
  });

  it('returns empty for static path', () => {
    expectTypeOf<ExtractPathParams<'/users'>>().toEqualTypeOf<Record<string, never>>();
  });
});

describe('ExtractRequestBody', () => {
  const Body = v.object({ name: v.string() });
  type Body = v.InferOutput<typeof Body>;

  it('extracts body type from validated() default arg marker', () => {
    type H = (body?: ValidatedMarker<Body>) => Promise<unknown>;
    expectTypeOf<ExtractRequestBody<H>>().toEqualTypeOf<Body>();
  });

  it('returns never when no validated() arg present', () => {
    type H = (id?: string) => Promise<unknown>;
    expectTypeOf<ExtractRequestBody<H>>().toEqualTypeOf<never>();
  });
});

describe('ExtractResponse', () => {
  it('extracts TypedResponse json', () => {
    type H = () => Promise<TypedResponse<{ ok: true }, 201, 'json'>>;
    expectTypeOf<ExtractResponse<H>>().toEqualTypeOf<
      TypedResponse<{ ok: true }, 201, 'json'>
    >();
  });

  it('treats raw return as 200 json', () => {
    type H = () => Promise<{ id: string }>;
    expectTypeOf<ExtractResponse<H>>().toEqualTypeOf<
      TypedResponse<{ id: string }, 200, 'json'>
    >();
  });
});

describe('ExtractValidationErrors', () => {
  const Body = v.object({ name: v.string() });
  type Body = v.InferOutput<typeof Body>;

  it('returns 400 ValidationErrorBody when validated() arg present', () => {
    type H = (body?: ValidatedMarker<Body>) => Promise<unknown>;
    type R = ExtractValidationErrors<H>;
    expectTypeOf<R>().not.toBeNever();
  });

  it('returns never when no validated() arg', () => {
    type H = () => Promise<{ ok: true }>;
    expectTypeOf<ExtractValidationErrors<H>>().toEqualTypeOf<never>();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `pnpm --filter @koya/contract test -- extract`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement ValidatedMarker**

`packages/contract/src/types/validated-marker.ts`:

```ts
// `validated(schema)` の runtime 戻り値は `InferOutput<schema>`。
// 一方 contract 側は型レベルで「この arg は validated() 経由」と検出する必要がある。
// runtime の primitive 型と、type 側の marker 型を両立させるため、
// nominal な phantom field を持たせた intersection 型を marker として使う。
//
// Why: handler signature を `validated(...)` 呼び出し情報から再構築する際、
// ExtractRequestBody / ExtractValidationErrors が単独 arg だけで判別できる必要がある。
declare const __validatedBrand: unique symbol;

export type ValidatedMarker<T> = T & {
  readonly [__validatedBrand]?: T;
};

export type UnwrapValidated<T> = T extends ValidatedMarker<infer U> ? U : never;
```

- [ ] **Step 4: Implement extract type functions**

`packages/contract/src/types/extract.ts`:

```ts
import type { TypedResponse } from 'hono';
import type { ValidationErrorBody } from '@koya/core';

import type { UnwrapValidated, ValidatedMarker } from './validated-marker';

// ---------- ExtractPathParams ----------
// '/users/:id/posts/:postId' → { id: string; postId: string }
export type ExtractPathParams<P extends string> = string extends P
  ? Record<string, string>
  : P extends `${infer _Head}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractPathParams<`/${Rest}`>]: string }
    : P extends `${infer _Head}:${infer Param}`
      ? { [K in Param]: string }
      : Record<string, never>;

// ---------- ExtractRequestBody ----------
// handler の引数のうち ValidatedMarker<T> がある場合 T、なければ never
type RequestBodyOf<Args extends readonly unknown[]> = Args extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends ValidatedMarker<infer Body> | undefined
    ? Body
    : RequestBodyOf<Tail>
  : never;

export type ExtractRequestBody<H extends (...args: never[]) => unknown> = RequestBodyOf<
  Parameters<H>
>;

// ---------- ExtractResponse ----------
// handler 戻り値の Awaited を取り、TypedResponse ならそのまま、素データなら 200/json で wrap
type WrapRaw<T> = T extends TypedResponse<unknown, number, string> ? T : T extends Response
  ? never // Response は contract 上 omit (spec §4.3)
  : TypedResponse<T, 200, 'json'>;

export type ExtractResponse<H extends (...args: never[]) => unknown> = WrapRaw<
  Awaited<ReturnType<H>>
>;

// ---------- ExtractValidationErrors ----------
// 引数に ValidatedMarker<...> が一つでもあれば 400 + ValidationErrorBody を union 追加
type HasValidated<Args extends readonly unknown[]> = Args extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends ValidatedMarker<unknown> | undefined
    ? true
    : HasValidated<Tail>
  : false;

export type ExtractValidationErrors<H extends (...args: never[]) => unknown> =
  HasValidated<Parameters<H>> extends true
    ? TypedResponse<ValidationErrorBody, 400, 'json'>
    : never;

// 補助 export
export type { UnwrapValidated };
```

> **Implementation note:** koya runtime の `validated(schema)` 戻り値型は `InferOutput<Schema>` のまま。contract 解析時は AST 側で「この arg default は `validated(...)` 呼び出しだ」と判定し、emit する型 file (`app.gen.ts`) 内では `typeof Controller.prototype.method` の生 signature を `Route<...>` に渡す。`Route<...>` 内部で `ExtractRequestBody` / `ExtractValidationErrors` を計算。
>
> このため、runtime の primitive 型を `ValidatedMarker<T>` でラップする必要がある — Task 5 の最後で `validated()` の戻り値型を `ValidatedMarker<InferOutput<Schema>>` に変える小修正を core に入れる必要がある。**この修正は Task 5 の Step 8 で行う**。

- [ ] **Step 5: Implement Route type**

`packages/contract/src/types/route.ts`:

```ts
import type {
  ExtractPathParams,
  ExtractRequestBody,
  ExtractResponse,
  ExtractValidationErrors,
} from './extract';

export type Route<
  M extends string,
  P extends string,
  H extends (...args: never[]) => unknown,
> = {
  readonly method: M;
  readonly path: P;
  readonly params: ExtractPathParams<P>;
  readonly body: ExtractRequestBody<H>;
  readonly response: ExtractResponse<H> | ExtractValidationErrors<H>;
};
```

- [ ] **Step 6: Write failing test for Route**

`packages/contract/src/types/__tests__/route.test.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import type { TypedResponse } from 'hono';
import type { ValidationErrorBody } from '@koya/core';
import * as v from 'valibot';

import type { Route } from '../route';
import type { ValidatedMarker } from '../validated-marker';

describe('Route', () => {
  const Body = v.object({ name: v.string() });
  type Body = v.InferOutput<typeof Body>;

  it('shows path params for parametric path', () => {
    type R = Route<'GET', '/users/:id', () => Promise<{ id: string }>>;
    expectTypeOf<R['params']>().toEqualTypeOf<{ id: string }>();
  });

  it('lifts validated() body into Route.body', () => {
    type R = Route<'POST', '/users', (body?: ValidatedMarker<Body>) => Promise<{ ok: true }>>;
    expectTypeOf<R['body']>().toEqualTypeOf<Body>();
  });

  it('union of return + validation 400 in response', () => {
    type R = Route<
      'POST',
      '/users',
      (body?: ValidatedMarker<Body>) => Promise<TypedResponse<{ ok: true }, 201, 'json'>>
    >;
    type Resp = R['response'];
    expectTypeOf<Resp>().toMatchTypeOf<
      | TypedResponse<{ ok: true }, 201, 'json'>
      | TypedResponse<ValidationErrorBody, 400, 'json'>
    >();
  });
});
```

- [ ] **Step 7: Run test to confirm it passes**

Run: `pnpm --filter @koya/contract test`
Expected: PASS。

- [ ] **Step 8: Update @koya/core validated() to return ValidatedMarker**

`packages/core/src/primitives/validated.ts` を以下に書き換え:

```ts
import { parse, type GenericSchema, type InferOutput } from 'valibot';

import { getEntryContext } from '../internal/entry-context';

// ValidatedMarker<T> を contract 側で検出するため、phantom field を持たせる。
// runtime 値は parse 結果そのもの。型 cast で marker を被せる。
declare const __validatedBrand: unique symbol;

type ValidatedMarker<T> = T & {
  readonly [__validatedBrand]?: T;
};

export const validated = <Schema extends GenericSchema>(
  schema: Schema,
): ValidatedMarker<InferOutput<Schema>> => {
  const ctx = getEntryContext();
  return parse(schema, ctx.input.body) as ValidatedMarker<InferOutput<Schema>>;
};
```

> **Note:** core 側の `ValidatedMarker` は private declaration、contract 側の `ValidatedMarker` は public type。両者は **同じ phantom symbol 名** だが TS の `unique symbol` は declaration ごとに別物。contract 側は handler signature の reflection 側のみで使うため、**実際にはマッチしない**。
>
> このため、contract 側の `ValidatedMarker` を core から re-export して、core の `validated()` がそれを使う形に修正する。Step 9 で対応。

- [ ] **Step 9: Move ValidatedMarker into a shared location**

`packages/core/src/primitives/validated.ts` を以下に修正:

```ts
import { parse, type GenericSchema, type InferOutput } from 'valibot';

import { getEntryContext } from '../internal/entry-context';

// 型レベル marker。`@koya/contract` が handler signature から validated() 引数を検出するために使う。
// runtime 値は単なる parse 結果。
declare const __koyaValidatedBrand: unique symbol;

export type ValidatedMarker<T> = T & {
  readonly [__koyaValidatedBrand]?: T;
};

export const validated = <Schema extends GenericSchema>(
  schema: Schema,
): ValidatedMarker<InferOutput<Schema>> => {
  const ctx = getEntryContext();
  return parse(schema, ctx.input.body) as ValidatedMarker<InferOutput<Schema>>;
};
```

`packages/core/src/index.ts` に追記:

```ts
export type { ValidatedMarker } from './primitives/validated';
```

`packages/contract/src/types/validated-marker.ts` を以下に置き換え (core の型を re-export):

```ts
export type { ValidatedMarker } from '@koya/core';

export type UnwrapValidated<T> = T extends import('@koya/core').ValidatedMarker<infer U> ? U : never;
```

- [ ] **Step 10: Re-run all tests**

Run: `pnpm --filter @koya/core test && pnpm --filter @koya/contract test`
Expected: PASS。`validated.test.ts` の既存テストは値の同一性をテストしているはずで marker は型のみなので影響なし。

- [ ] **Step 11: Implement BuildAppType**

`packages/contract/src/types/build-app-type.ts`:

```ts
import type { Route } from './route';

// hono `hc<AppType>` が必要とする shape:
//   { [Path]: { $get: { input: { param?, json? }, output: TypedResponse }, $post: ..., ... } }
// hono v4 では `hono/hono-base` の `Schema` 型と `MergeSchemaPath` を使うのが正攻法だが、
// koya は contract package で hono 内部型を import せずに済む形で互換構造を組む。
//
// Why: hono internals の export path が version で変わると壊れるため、
// 出力 shape を「hc が読める最低限」に絞り、hc 側の generic 推論に任せる。

type MethodKey<M extends string> = M extends 'GET'
  ? '$get'
  : M extends 'POST'
    ? '$post'
    : M extends 'PUT'
      ? '$put'
      : M extends 'PATCH'
        ? '$patch'
        : M extends 'DELETE'
          ? '$delete'
          : never;

type RouteEntry<R> = R extends Route<infer M, infer _P, infer _H>
  ? {
      [K in MethodKey<M>]: {
        input: {
          param: R extends Route<string, string, (...args: never[]) => unknown>
            ? R['params']
            : never;
          json: R extends Route<string, string, (...args: never[]) => unknown>
            ? R['body']
            : never;
        };
        output: R extends Route<string, string, (...args: never[]) => unknown>
          ? R['response']
          : never;
      };
    }
  : never;

type Merge<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? A[K] & B[K]
      : A[K]
    : K extends keyof B
      ? B[K]
      : never;
};

type BuildPaths<Routes extends readonly unknown[]> = Routes extends readonly [
  infer Head,
  ...infer Tail,
]
  ? Head extends Route<string, infer P, (...args: never[]) => unknown>
    ? Merge<{ [K in P]: RouteEntry<Head> }, BuildPaths<Tail>>
    : BuildPaths<Tail>
  : Record<string, never>;

export type BuildAppType<Routes extends readonly Route<string, string, never>[]> = BuildPaths<Routes>;
```

> **Implementation note:** hono の正確な `AppType` shape は `hono/types` の `Schema` 型 (`{ [path]: { [$method]: { input, output } } }` 形) に対応する必要がある。完全互換を確認するため、Step 12 の type test で hono の `hc<AppType>` 呼び出しが型推論できることを検証する。互換性を取れない場合、hono の `hono/types` から `Schema`/`MergeSchemaPath` を import して再構成 (依存追加)。

- [ ] **Step 12: Write integration type test for BuildAppType + hc**

`packages/contract/src/types/__tests__/build-app-type.test.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';
import { hc } from 'hono/client';
import type { TypedResponse } from 'hono';
import type { ValidationErrorBody } from '@koya/core';
import * as v from 'valibot';

import type { BuildAppType } from '../build-app-type';
import type { Route } from '../route';
import type { ValidatedMarker } from '../validated-marker';

describe('BuildAppType + hc<AppType>', () => {
  const Body = v.object({ name: v.string() });
  type Body = v.InferOutput<typeof Body>;

  type AppType = BuildAppType<
    [
      Route<'GET', '/users/:id', (id?: string) => Promise<{ id: string; name: string }>>,
      Route<
        'POST',
        '/users',
        (body?: ValidatedMarker<Body>) => Promise<TypedResponse<{ id: string }, 201, 'json'>>
      >,
    ]
  >;

  it('hc client narrows GET response', async () => {
    const client = hc<AppType>('http://x');
    // 型推論だけ確認する (実際には fetch しない)
    type GetReturn = Awaited<ReturnType<typeof client.users[':id']['$get']>>;
    expectTypeOf<GetReturn>().toBeObject();
  });

  it('hc client knows POST validation 400 union', async () => {
    const client = hc<AppType>('http://x');
    type PostReturn = Awaited<ReturnType<typeof client.users['$post']>>;
    // 201 + 400 の status union が narrow できれば OK
    expectTypeOf<PostReturn['status']>().toMatchTypeOf<201 | 400>();
  });
});
```

- [ ] **Step 13: Run test, fix BuildAppType shape until hc compatibility passes**

Run: `pnpm --filter @koya/contract test -- build-app-type`
Expected: PASS。

失敗時の対処:
1. hc の型エラーメッセージから期待 shape を読み取る
2. 必要なら `hono/types` から `Schema` を import し、`BuildAppType` を `Schema` 互換に組み直す
3. test を retry

- [ ] **Step 14: Update contract barrel**

`packages/contract/src/index.ts`:

```ts
export type { Route } from './types/route';
export type { BuildAppType } from './types/build-app-type';
export type {
  ExtractPathParams,
  ExtractRequestBody,
  ExtractResponse,
  ExtractValidationErrors,
} from './types/extract';
export type { ValidatedMarker, UnwrapValidated } from './types/validated-marker';
```

- [ ] **Step 15: Typecheck and commit**

Run: `pnpm --filter @koya/contract typecheck && pnpm --filter @koya/contract test`
Expected: PASS。

```bash
git add packages/contract/src/types/ \
        packages/contract/src/index.ts \
        packages/core/src/primitives/validated.ts \
        packages/core/src/index.ts
git commit -m "feat(contract): add Route/BuildAppType/Extract* type functions"
```

---

### Task 6: `@koya/contract` `GenerateClientOptions` + `defineConfig`

**Goal:** programmatic API と CLI が共有する設定型 + identity 関数。

**Files:**
- Create: `packages/contract/src/config/options.ts`
- Create: `packages/contract/src/config/options.test.ts`
- Modify: `packages/contract/src/index.ts`

- [ ] **Step 1: Write failing test**

`packages/contract/src/config/options.test.ts`:

```ts
import { describe, expectTypeOf, it } from 'vitest';

import { defineConfig, type GenerateClientOptions } from './options';

class A {}
class B {}

describe('defineConfig', () => {
  it('returns the input as-is (identity function)', () => {
    const cfg = defineConfig({ controllers: [A, B], dist: './generated' });
    expect.soft(cfg.controllers).toEqual([A, B]);
    expect.soft(cfg.dist).toBe('./generated');
  });

  it('preserves narrow type', () => {
    const cfg = defineConfig({ controllers: [A], dist: './x' });
    expectTypeOf(cfg).toMatchTypeOf<GenerateClientOptions>();
  });

  it('accepts watch option', () => {
    const cfg = defineConfig({ controllers: [A], dist: './x', watch: true });
    expect(cfg.watch).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm --filter @koya/contract test -- options`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement options module**

`packages/contract/src/config/options.ts`:

```ts
type ControllerClass = new (...args: never[]) => object;

export type GenerateClientOptions = {
  readonly controllers: readonly ControllerClass[];
  readonly dist: string;
  readonly watch?: boolean;
};

// identity 関数。defineConfig 経由で書くと TS が `controllers` の literal narrow を維持しやすい。
export const defineConfig = <T extends GenerateClientOptions>(config: T): T => config;
```

- [ ] **Step 4: Run test to confirm pass**

Run: `pnpm --filter @koya/contract test -- options`
Expected: PASS (3 tests)。

- [ ] **Step 5: Export from barrel**

`packages/contract/src/index.ts` に追記:

```ts
export { defineConfig } from './config/options';
export type { GenerateClientOptions } from './config/options';
```

- [ ] **Step 6: Commit**

```bash
git add packages/contract/src/config/ packages/contract/src/index.ts
git commit -m "feat(contract): add GenerateClientOptions and defineConfig"
```

---

### Task 7: `@koya/contract` ts-morph analyzer (decorator + handler signature + response type)

**Goal:** controller class の source file を ts-morph で読み込み、各 method について `(method, path, requestSchema, responseTypeNode)` を抽出する解析機構。

**Files:**
- Create: `packages/contract/src/analyzer/project.ts`
- Create: `packages/contract/src/analyzer/decorator.ts`
- Create: `packages/contract/src/analyzer/handler.ts`
- Create: `packages/contract/src/analyzer/response-type.ts`
- Create: `packages/contract/src/analyzer/internal-representation.ts`
- Create: `packages/contract/src/analyzer/__tests__/fixtures/sample.controller.ts`
- Create: `packages/contract/src/analyzer/__tests__/analyzer.test.ts`

- [ ] **Step 1: Create test fixture controller**

`packages/contract/src/analyzer/__tests__/fixtures/sample.controller.ts`:

```ts
import { Controller, Get, Post, validated, pathParam, response } from '@koya/core';
import * as v from 'valibot';

export const CreateUserBody = v.object({
  name: v.string(),
  email: v.string(),
});
export type CreateUserBody = v.InferOutput<typeof CreateUserBody>;

export type User = {
  id: string;
  name: string;
  email: string;
};

@Controller('/users')
export class UserController {
  @Get('/:id')
  async show(id = pathParam('id')): Promise<User> {
    return { id, name: 'a', email: 'a@a' };
  }

  @Post('/')
  async create(body = validated(CreateUserBody), res = response()) {
    return res.json({ id: '1', name: body.name, email: body.email }, 201);
  }
}
```

- [ ] **Step 2: Write failing test for analyzer**

`packages/contract/src/analyzer/__tests__/analyzer.test.ts`:

```ts
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeControllers } from '../internal-representation';
import { createProject } from '../project';

const fixturePath = resolve(__dirname, 'fixtures/sample.controller.ts');

describe('analyzeControllers', () => {
  const project = createProject({ tsConfigFilePath: undefined, controllerFiles: [fixturePath] });
  const ir = analyzeControllers(project, [{ filePath: fixturePath, exportName: 'UserController' }]);

  it('extracts decorator metadata', () => {
    const routes = ir.flatMap((c) => c.routes);
    expect(routes.map((r) => `${r.method} ${r.fullPath}`)).toEqual([
      'GET /users/:id',
      'POST /users',
    ]);
  });

  it('detects validated() arg with schema identifier', () => {
    const create = ir[0]?.routes.find((r) => r.method === 'POST');
    expect(create?.requestSchema).toEqual({
      kind: 'valibot-named',
      module: fixturePath,
      exportName: 'CreateUserBody',
    });
  });

  it('detects pathParam() arg', () => {
    const show = ir[0]?.routes.find((r) => r.method === 'GET');
    expect(show?.pathParams).toEqual(['id']);
  });

  it('extracts response type node', () => {
    const show = ir[0]?.routes.find((r) => r.method === 'GET');
    expect(show?.responseType.kind).toBe('ts-named');
    expect(show?.responseType.kind === 'ts-named' && show.responseType.name).toBe('User');
  });
});
```

- [ ] **Step 3: Run test to confirm failure**

Run: `pnpm --filter @koya/contract test -- analyzer`
Expected: FAIL — modules missing.

- [ ] **Step 4: Implement project module**

`packages/contract/src/analyzer/project.ts`:

```ts
import { Project, ScriptTarget, ModuleKind, ModuleResolutionKind } from 'ts-morph';

export type CreateProjectOptions = {
  readonly tsConfigFilePath?: string;
  readonly controllerFiles: readonly string[];
};

export const createProject = (options: CreateProjectOptions): Project => {
  // tsconfig が指定されていればそれを使い、なければ in-memory project を controllerFiles で構築。
  // 利用者の tsconfig 設定 (paths / experimentalDecorators 等) を尊重するため、
  // 通常 path 指定運用を期待する。
  if (options.tsConfigFilePath) {
    return new Project({ tsConfigFilePath: options.tsConfigFilePath });
  }
  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.ES2022,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      experimentalDecorators: true,
      strict: true,
    },
  });
  for (const f of options.controllerFiles) {
    project.addSourceFileAtPath(f);
  }
  project.resolveSourceFileDependencies();
  return project;
};
```

- [ ] **Step 5: Implement decorator analyzer**

`packages/contract/src/analyzer/decorator.ts`:

```ts
import { type ClassDeclaration, type MethodDeclaration, SyntaxKind } from 'ts-morph';

const HTTP_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete'] as const;
type HttpDecoratorName = (typeof HTTP_DECORATORS)[number];

export type ControllerDecoratorInfo = {
  readonly basePath: string;
};

export type RouteDecoratorInfo = {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
};

const stringLiteralArg = (decoratorName: string, args: readonly { getKind(): SyntaxKind; getText(): string }[]): string => {
  const first = args[0];
  if (!first || first.getKind() !== SyntaxKind.StringLiteral) {
    throw new Error(`koya/contract: @${decoratorName} requires a string literal argument`);
  }
  // ts-morph の getText() は quote を含む。剥がす。
  const t = first.getText();
  return t.slice(1, -1);
};

export const extractControllerDecorator = (cls: ClassDeclaration): ControllerDecoratorInfo | undefined => {
  for (const dec of cls.getDecorators()) {
    if (dec.getName() === 'Controller') {
      return { basePath: stringLiteralArg('Controller', dec.getArguments()) };
    }
  }
  return undefined;
};

const methodNameToHttp = (n: HttpDecoratorName): RouteDecoratorInfo['method'] =>
  ({ Get: 'GET', Post: 'POST', Put: 'PUT', Patch: 'PATCH', Delete: 'DELETE' } as const)[n];

export const extractRouteDecorator = (m: MethodDeclaration): RouteDecoratorInfo | undefined => {
  for (const dec of m.getDecorators()) {
    const name = dec.getName();
    if ((HTTP_DECORATORS as readonly string[]).includes(name)) {
      return {
        method: methodNameToHttp(name as HttpDecoratorName),
        path: stringLiteralArg(name, dec.getArguments()),
      };
    }
  }
  return undefined;
};
```

- [ ] **Step 6: Implement handler signature analyzer**

`packages/contract/src/analyzer/handler.ts`:

```ts
import { type MethodDeclaration, SyntaxKind, type CallExpression } from 'ts-morph';

export type RequestSchemaRef =
  | { readonly kind: 'valibot-named'; readonly module: string; readonly exportName: string }
  | { readonly kind: 'valibot-inline'; readonly schemaText: string }
  | { readonly kind: 'none' };

export type HandlerSignatureInfo = {
  readonly requestSchema: RequestSchemaRef;
  readonly pathParams: readonly string[];
};

const callOf = (initializer: ReturnType<MethodDeclaration['getParameters']>[number] extends infer P
  ? (P extends { getInitializer(): infer I } ? I : never)
  : never): CallExpression | undefined => {
  if (!initializer) return undefined;
  if (initializer.getKind() === SyntaxKind.CallExpression) {
    return initializer as unknown as CallExpression;
  }
  return undefined;
};

const isCallTo = (expr: CallExpression, name: string): boolean => {
  const callee = expr.getExpression().getText();
  // `validated` / `pathParam` / `response` / `inject` の identifier は @koya/core から import 想定
  return callee === name;
};

const literalArg = (expr: CallExpression): string | undefined => {
  const arg = expr.getArguments()[0];
  if (!arg) return undefined;
  if (arg.getKind() === SyntaxKind.StringLiteral) return arg.getText().slice(1, -1);
  return undefined;
};

const identifierArg = (expr: CallExpression): { exportName: string } | undefined => {
  const arg = expr.getArguments()[0];
  if (!arg) return undefined;
  if (arg.getKind() === SyntaxKind.Identifier) return { exportName: arg.getText() };
  return undefined;
};

const resolveSchemaModule = (expr: CallExpression, exportName: string): string | undefined => {
  // identifier がどの import 経由 / 同一 file の named export かを resolve
  const sourceFile = expr.getSourceFile();
  for (const imp of sourceFile.getImportDeclarations()) {
    for (const named of imp.getNamedImports()) {
      if (named.getName() === exportName) {
        const sf = imp.getModuleSpecifierSourceFile();
        return sf?.getFilePath();
      }
    }
  }
  // 同一 file 内 export の場合
  for (const exp of sourceFile.getExportedDeclarations().get(exportName) ?? []) {
    return exp.getSourceFile().getFilePath();
  }
  return undefined;
};

export const analyzeHandlerSignature = (m: MethodDeclaration): HandlerSignatureInfo => {
  let requestSchema: RequestSchemaRef = { kind: 'none' };
  const pathParams: string[] = [];

  for (const param of m.getParameters()) {
    const init = param.getInitializer();
    if (!init || init.getKind() !== SyntaxKind.CallExpression) continue;
    const call = init as CallExpression;

    if (isCallTo(call, 'validated')) {
      const id = identifierArg(call);
      if (id) {
        const module = resolveSchemaModule(call, id.exportName);
        if (!module) {
          throw new Error(
            `koya/contract: cannot resolve module for validated(${id.exportName}). Schema must be a module-level export.`,
          );
        }
        requestSchema = { kind: 'valibot-named', module, exportName: id.exportName };
      } else {
        // inline schema: valibot 表現 text を保存して emit 側で eval
        requestSchema = { kind: 'valibot-inline', schemaText: call.getArguments()[0]?.getText() ?? '' };
      }
    } else if (isCallTo(call, 'pathParam')) {
      const name = literalArg(call);
      if (!name) {
        throw new Error(`koya/contract: pathParam() requires a string literal argument`);
      }
      pathParams.push(name);
    }
  }

  return { requestSchema, pathParams };
};
```

> **Implementation note:** `valibot-inline` の schema text を runtime に再 eval するのはセキュリティ的に避けたい。MVP では inline は **未対応** として `kind: 'valibot-inline'` を build error にする選択肢もあり (spec §10.2 の表で "module top-level export 強制")。Step 6 の現状コードは inline 用の type を予約しているだけで、Task 9 の OpenAPI emitter 側で `kind === 'valibot-inline'` を build error にする。

- [ ] **Step 7: Implement response type analyzer**

`packages/contract/src/analyzer/response-type.ts`:

```ts
import { type MethodDeclaration, type Type, SyntaxKind } from 'ts-morph';

export type ResponseTypeInfo =
  | { readonly kind: 'ts-named'; readonly name: string; readonly module: string }
  | { readonly kind: 'ts-anonymous'; readonly typeText: string }
  | { readonly kind: 'typed-response'; readonly bodyTypeText: string; readonly status: number; readonly format: string }
  | { readonly kind: 'unresolvable' };

const isUnknownOrAny = (t: Type): boolean => t.isAny() || t.isUnknown();

export const analyzeResponseType = (m: MethodDeclaration): ResponseTypeInfo => {
  const ret = m.getReturnType();
  // Promise<T> なら T を取る
  const inner = ret.getSymbol()?.getName() === 'Promise' ? ret.getTypeArguments()[0] ?? ret : ret;

  if (!inner || isUnknownOrAny(inner)) return { kind: 'unresolvable' };

  // TypedResponse<T, S, F> 形を識別
  const sym = inner.getSymbol();
  if (sym?.getName() === 'TypedResponse') {
    const args = inner.getTypeArguments();
    const bodyTypeText = args[0]?.getText(m) ?? 'unknown';
    const statusType = args[1];
    const formatType = args[2];
    const statusLit = statusType?.getLiteralValue();
    const formatLit = formatType?.getLiteralValue();
    return {
      kind: 'typed-response',
      bodyTypeText,
      status: typeof statusLit === 'number' ? statusLit : 200,
      format: typeof formatLit === 'string' ? formatLit : 'json',
    };
  }

  // named type alias
  const aliasSym = inner.getAliasSymbol() ?? inner.getSymbol();
  const decl = aliasSym?.getDeclarations()[0];
  if (decl && (decl.getKind() === SyntaxKind.TypeAliasDeclaration || decl.getKind() === SyntaxKind.InterfaceDeclaration)) {
    return {
      kind: 'ts-named',
      name: aliasSym?.getName() ?? 'Unknown',
      module: decl.getSourceFile().getFilePath(),
    };
  }

  return { kind: 'ts-anonymous', typeText: inner.getText(m) };
};
```

- [ ] **Step 8: Implement Internal Representation aggregator**

`packages/contract/src/analyzer/internal-representation.ts`:

```ts
import { type Project } from 'ts-morph';

import { extractControllerDecorator, extractRouteDecorator, type RouteDecoratorInfo } from './decorator';
import { analyzeHandlerSignature, type HandlerSignatureInfo, type RequestSchemaRef } from './handler';
import { analyzeResponseType, type ResponseTypeInfo } from './response-type';

const stripTrailingSlash = (s: string): string =>
  s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s;

const ensureLeadingSlash = (s: string): string => (s === '' || s.startsWith('/') ? s : `/${s}`);

const joinPath = (base: string, sub: string): string => {
  const a = stripTrailingSlash(base);
  const b = stripTrailingSlash(ensureLeadingSlash(sub));
  const joined = `${a}${b === '/' ? '' : b}`;
  return joined === '' ? '/' : joined;
};

export type RouteIR = RouteDecoratorInfo &
  HandlerSignatureInfo & {
    readonly fullPath: string;
    readonly methodName: string;
    readonly responseType: ResponseTypeInfo;
    readonly requestSchema: RequestSchemaRef;
  };

export type ControllerIR = {
  readonly module: string;
  readonly exportName: string;
  readonly basePath: string;
  readonly routes: readonly RouteIR[];
};

export type ControllerSpec = { readonly filePath: string; readonly exportName: string };

export const analyzeControllers = (
  project: Project,
  specs: readonly ControllerSpec[],
): readonly ControllerIR[] => {
  const out: ControllerIR[] = [];
  for (const spec of specs) {
    const sf = project.getSourceFile(spec.filePath);
    if (!sf) throw new Error(`koya/contract: source file not found: ${spec.filePath}`);
    const cls = sf.getClass(spec.exportName);
    if (!cls) {
      throw new Error(`koya/contract: class ${spec.exportName} not found in ${spec.filePath}`);
    }

    const ctrl = extractControllerDecorator(cls);
    if (!ctrl) {
      throw new Error(`koya/contract: ${spec.exportName} is missing @Controller decorator`);
    }

    const routes: RouteIR[] = [];
    for (const m of cls.getMethods()) {
      const route = extractRouteDecorator(m);
      if (!route) continue;
      const sig = analyzeHandlerSignature(m);
      const resp = analyzeResponseType(m);
      routes.push({
        ...route,
        ...sig,
        fullPath: joinPath(ctrl.basePath, route.path),
        methodName: m.getName(),
        responseType: resp,
      });
    }

    out.push({
      module: spec.filePath,
      exportName: spec.exportName,
      basePath: ctrl.basePath,
      routes,
    });
  }
  return out;
};
```

- [ ] **Step 9: Run analyzer test, iterate until pass**

Run: `pnpm --filter @koya/contract test -- analyzer`
Expected: PASS (4 tests)。

失敗時の対処:
- ts-morph の API は version 差で signature が変わる場合あり。test failure メッセージから API mismatch を特定し、`getDecorator` / `getInitializer` 等を必要に応じ調整。
- decorator path が別 source file 経由 (re-export 等) の場合、`getModuleSpecifierSourceFile()` の戻りが期待通りか確認。fixture を simple に保つことで MVP では回避可能。

- [ ] **Step 10: Commit**

```bash
git add packages/contract/src/analyzer/
git commit -m "feat(contract): implement ts-morph based controller analyzer"
```

---

### Task 8: `<dist>/app.gen.ts` emitter

**Goal:** Internal Representation から `import type` 文 + `export type AppType = BuildAppType<[Route<...>, ...]>` を生成。

**Files:**
- Create: `packages/contract/src/emit/app-gen.ts`
- Create: `packages/contract/src/emit/__tests__/app-gen.test.ts`

- [ ] **Step 1: Write failing test**

`packages/contract/src/emit/__tests__/app-gen.test.ts`:

```ts
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeControllers } from '../../analyzer/internal-representation';
import { createProject } from '../../analyzer/project';
import { emitAppGen } from '../app-gen';

const fixturePath = resolve(__dirname, '../../analyzer/__tests__/fixtures/sample.controller.ts');

describe('emitAppGen', () => {
  const project = createProject({ tsConfigFilePath: undefined, controllerFiles: [fixturePath] });
  const ir = analyzeControllers(project, [{ filePath: fixturePath, exportName: 'UserController' }]);

  it('emits import type and Route entries', () => {
    const out = emitAppGen(ir, { distDir: '/tmp/generated' });
    expect(out).toContain('import type { Route, BuildAppType } from \'@koya/contract\'');
    expect(out).toContain('UserController');
    expect(out).toMatch(/Route<'GET',\s*'\/users\/:id',\s*typeof UserController\.prototype\.show>/);
    expect(out).toMatch(/Route<'POST',\s*'\/users',\s*typeof UserController\.prototype\.create>/);
    expect(out).toContain('export type AppType = BuildAppType<[');
  });

  it('uses relative import path from distDir to controller module', () => {
    const out = emitAppGen(ir, { distDir: '/tmp/generated' });
    // sample.controller.ts は absolute path、emit は dist からの相対 path に変換
    expect(out).toMatch(/import type \{ UserController \} from '[^']+sample\.controller'/);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm --filter @koya/contract test -- app-gen`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement emitAppGen**

`packages/contract/src/emit/app-gen.ts`:

```ts
import { relative, dirname, resolve } from 'node:path';

import type { ControllerIR } from '../analyzer/internal-representation';

export type EmitAppGenOptions = {
  readonly distDir: string;
};

const toRelativeImport = (distDir: string, modulePath: string): string => {
  // distDir からの相対 path、拡張子を剥がす (.ts は import 時 path 解決の都合で省略)
  const rel = relative(distDir, modulePath).replace(/\.tsx?$/, '');
  // 同一 dir なら ./ を付与
  return rel.startsWith('.') ? rel : `./${rel}`;
};

export const emitAppGen = (controllers: readonly ControllerIR[], options: EmitAppGenOptions): string => {
  const imports = controllers
    .map(
      (c) =>
        `import type { ${c.exportName} } from '${toRelativeImport(options.distDir, c.module)}';`,
    )
    .join('\n');

  const routes = controllers.flatMap((c) =>
    c.routes.map(
      (r) =>
        `  Route<'${r.method}', '${c.basePath}${r.path === '/' ? '' : r.path}', typeof ${c.exportName}.prototype.${r.methodName}>,`,
    ),
  );

  // base + sub の join はもっと正確には IR の fullPath を使うべき。次 step で修正。
  return [
    '// THIS FILE IS GENERATED BY @koya/contract. DO NOT EDIT.',
    "import type { Route, BuildAppType } from '@koya/contract';",
    imports,
    '',
    'export type AppType = BuildAppType<[',
    ...routes,
    ']>;',
    '',
  ].join('\n');
};
```

- [ ] **Step 4: Adjust path string to use IR.fullPath**

実装で path 文字列を `${c.basePath}${r.path}` 直結ではなく、IR が既に保持する `r.fullPath` を使う:

```ts
  const routes = controllers.flatMap((c) =>
    c.routes.map(
      (r) =>
        `  Route<'${r.method}', '${r.fullPath}', typeof ${c.exportName}.prototype.${r.methodName}>,`,
    ),
  );
```

- [ ] **Step 5: Run test to confirm pass**

Run: `pnpm --filter @koya/contract test -- app-gen`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add packages/contract/src/emit/app-gen.ts packages/contract/src/emit/__tests__/app-gen.test.ts
git commit -m "feat(contract): emit app.gen.ts with type references"
```

---

### Task 9: `<dist>/openapi.json` emitter

**Goal:** Internal Representation から OpenAPI 3.1 document を生成。valibot named schema → `components/schemas/<Name>` $ref、TS named type → `components/schemas/<Name>` $ref、anonymous は inline、`validated()` 持ち handler は 400 + ValidationErrorBody を自動登録。

**Files:**
- Create: `packages/contract/src/emit/json-schema-input.ts`
- Create: `packages/contract/src/emit/json-schema-output.ts`
- Create: `packages/contract/src/emit/openapi.ts`
- Create: `packages/contract/src/emit/__tests__/openapi.test.ts`

- [ ] **Step 1: Implement valibot → JSON Schema helper**

`packages/contract/src/emit/json-schema-input.ts`:

```ts
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { toJsonSchema } from '@valibot/to-json-schema';

import type { RequestSchemaRef } from '../analyzer/handler';

export type RequestSchemaJson =
  | { readonly kind: 'ref'; readonly name: string; readonly schema: unknown }
  | { readonly kind: 'inline'; readonly schema: unknown }
  | { readonly kind: 'none' };

// `kind: 'valibot-named'` の場合、対象 module を dynamic import して
// named export を runtime resolve し、valibot schema 値を取り出して JSON Schema 化する。
//
// Why: valibot schema は静的な AST だけからは形が決まらない (条件付き構築や generic がある)。
// runtime に reify する方が確実で、ts-morph で JS 風に書き直すよりも安全。
//
// 制約: dynamic import 対象は実行可能な module であること (TS の場合は事前 build か、
// `tsx` 等の loader 経由で import できる必要がある)。
//
// CLI 経由では tsx ベースの loader を使うか、build 後の dist を import するかいずれか。
// MVP では `import(pathToFileURL(absPath).href)` の generic な形で実装し、
// 利用者の実行環境 (node + tsx) に依存する。
export const resolveRequestSchema = async (ref: RequestSchemaRef): Promise<RequestSchemaJson> => {
  if (ref.kind === 'none') return { kind: 'none' };
  if (ref.kind === 'valibot-inline') {
    throw new Error(
      "koya/contract: validated() with inline schema is not supported in MVP. Extract the schema to a module-level export.",
    );
  }
  const url = pathToFileURL(resolve(ref.module)).href;
  const mod = (await import(url)) as Record<string, unknown>;
  const schema = mod[ref.exportName];
  if (!schema) {
    throw new Error(`koya/contract: ${ref.exportName} not found in ${ref.module}`);
  }
  // toJsonSchema は valibot schema 専用。型は緩く受け取る。
  const json = toJsonSchema(schema as never);
  return { kind: 'ref', name: ref.exportName, schema: json };
};
```

- [ ] **Step 2: Implement TS type → JSON Schema helper**

`packages/contract/src/emit/json-schema-output.ts`:

```ts
import { createGenerator, type Config } from 'ts-json-schema-generator';

import type { ResponseTypeInfo } from '../analyzer/response-type';

export type ResponseSchemaJson =
  | { readonly kind: 'ref'; readonly name: string; readonly schema: unknown; readonly status: number; readonly contentType: string }
  | { readonly kind: 'inline'; readonly schema: unknown; readonly status: number; readonly contentType: string }
  | { readonly kind: 'omit' };

const formatToContentType = (format: string): string => {
  switch (format) {
    case 'json':
      return 'application/json';
    case 'text':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
};

export const resolveResponseSchema = (
  resp: ResponseTypeInfo,
  options: { readonly tsconfigPath: string },
): ResponseSchemaJson => {
  if (resp.kind === 'unresolvable') {
    throw new Error(
      'koya/contract: handler return type is unknown/any. Add an explicit return type annotation.',
    );
  }
  if (resp.kind === 'typed-response') {
    // bodyTypeText を ts-json-schema-generator にかけられる identifier かどうか分岐。
    // MVP: identifier であれば named ref に、そうでなければ inline 化。
    return resp.bodyTypeText.match(/^[A-Z][A-Za-z0-9_]*$/)
      ? generateNamedSchema(resp.bodyTypeText, options.tsconfigPath, resp.status, formatToContentType(resp.format))
      : { kind: 'inline', schema: { description: resp.bodyTypeText }, status: resp.status, contentType: formatToContentType(resp.format) };
  }
  if (resp.kind === 'ts-named') {
    return generateNamedSchema(resp.name, options.tsconfigPath, 200, 'application/json');
  }
  if (resp.kind === 'ts-anonymous') {
    return { kind: 'inline', schema: { description: resp.typeText }, status: 200, contentType: 'application/json' };
  }
  return { kind: 'omit' };
};

const generateNamedSchema = (
  typeName: string,
  tsconfigPath: string,
  status: number,
  contentType: string,
): ResponseSchemaJson => {
  const config: Config = {
    path: '*',
    tsconfig: tsconfigPath,
    type: typeName,
    skipTypeCheck: true,
  };
  const generator = createGenerator(config);
  const schema = generator.createSchema(typeName);
  return { kind: 'ref', name: typeName, schema, status, contentType };
};
```

> **Implementation note:** `ts-json-schema-generator` は単一 `type` を 1 schema に変換する設計。複数 named type を同じ generator に喰わせて `definitions` を共有させる場合は `createSchema()` を複数回呼んで結果を merge する。MVP では各 response 型ごとに generator を作る簡易実装。perf に問題が出れば次フェーズで cache 化。

- [ ] **Step 3: Implement OpenAPI assembler**

`packages/contract/src/emit/openapi.ts`:

```ts
import { validationErrorBodySchema } from '@koya/core';
import { toJsonSchema } from '@valibot/to-json-schema';

import type { ControllerIR } from '../analyzer/internal-representation';

import { resolveRequestSchema } from './json-schema-input';
import { resolveResponseSchema } from './json-schema-output';

export type EmitOpenApiOptions = {
  readonly distDir: string;
  readonly tsconfigPath: string;
};

type OpenApiDoc = {
  openapi: '3.1.0';
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};

const toOpenApiPath = (p: string): string => p.replace(/:(\w+)/g, '{$1}');

export const emitOpenApi = async (
  controllers: readonly ControllerIR[],
  options: EmitOpenApiOptions,
): Promise<OpenApiDoc> => {
  const doc: OpenApiDoc = {
    openapi: '3.1.0',
    info: { title: 'koya app', version: '0.0.0' },
    paths: {},
    components: { schemas: {} },
  };

  // ValidationErrorBody schema を一度だけ登録
  const valBodySchema = toJsonSchema(validationErrorBodySchema);
  doc.components.schemas['ValidationErrorBody'] = valBodySchema;

  for (const c of controllers) {
    for (const r of c.routes) {
      const oaPath = toOpenApiPath(r.fullPath);
      const op: Record<string, unknown> = {};

      // request body
      const reqJson = await resolveRequestSchema(r.requestSchema);
      if (reqJson.kind === 'ref') {
        doc.components.schemas[reqJson.name] = reqJson.schema;
        op.requestBody = {
          required: true,
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${reqJson.name}` } } },
        };
      } else if (reqJson.kind === 'inline') {
        op.requestBody = {
          required: true,
          content: { 'application/json': { schema: reqJson.schema } },
        };
      }

      // path params
      const params = r.pathParams.map((name) => ({
        in: 'path',
        name,
        required: true,
        schema: { type: 'string' },
      }));
      if (params.length > 0) op.parameters = params;

      // response
      const respJson = resolveResponseSchema(r.responseType, { tsconfigPath: options.tsconfigPath });
      const responses: Record<string, unknown> = {};
      if (respJson.kind === 'ref') {
        doc.components.schemas[respJson.name] = respJson.schema;
        responses[String(respJson.status)] = {
          description: '',
          content: { [respJson.contentType]: { schema: { $ref: `#/components/schemas/${respJson.name}` } } },
        };
      } else if (respJson.kind === 'inline') {
        responses[String(respJson.status)] = {
          description: '',
          content: { [respJson.contentType]: { schema: respJson.schema } },
        };
      }

      // validated() あれば 400 を自動登録
      if (r.requestSchema.kind === 'valibot-named' || r.requestSchema.kind === 'valibot-inline') {
        responses['400'] = {
          description: 'validation failed',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorBody' } } },
        };
      }

      op.responses = responses;
      doc.paths[oaPath] = doc.paths[oaPath] ?? {};
      doc.paths[oaPath][r.method.toLowerCase()] = op;
    }
  }

  return doc;
};
```

- [ ] **Step 4: Write failing test**

`packages/contract/src/emit/__tests__/openapi.test.ts`:

```ts
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeControllers } from '../../analyzer/internal-representation';
import { createProject } from '../../analyzer/project';
import { emitOpenApi } from '../openapi';

const fixturePath = resolve(__dirname, '../../analyzer/__tests__/fixtures/sample.controller.ts');
const tsconfigPath = resolve(__dirname, '../../../tsconfig.json');

describe('emitOpenApi', () => {
  it('builds a valid OpenAPI 3.1 document with paths and components', async () => {
    const project = createProject({ tsConfigFilePath: tsconfigPath, controllerFiles: [fixturePath] });
    const ir = analyzeControllers(project, [{ filePath: fixturePath, exportName: 'UserController' }]);
    const doc = await emitOpenApi(ir, { distDir: '/tmp/generated', tsconfigPath });

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/users/{id}']?.get).toBeDefined();
    expect(doc.paths['/users']?.post).toBeDefined();

    // ValidationErrorBody が常に登録される
    expect(doc.components.schemas['ValidationErrorBody']).toBeDefined();

    // POST /users は validated() 持ち → 400 自動登録
    const postOp = doc.paths['/users']?.post as { responses: Record<string, unknown> };
    expect(postOp.responses['400']).toBeDefined();

    // CreateUserBody が components/schemas に登録され $ref 参照されている
    expect(doc.components.schemas['CreateUserBody']).toBeDefined();
  });
});
```

- [ ] **Step 5: Run test, iterate**

Run: `pnpm --filter @koya/contract test -- openapi`
Expected: PASS。

> **Note:** dynamic `import()` で `.ts` ファイルを直接読む必要があるため、test 実行は `vitest` の loader (vite ベース) で動く。CLI 実行時 (Task 11) は `tsx` 経由を期待する。CLI から直接呼び出す場合の loader 設定は Task 11 で扱う。

- [ ] **Step 6: Commit**

```bash
git add packages/contract/src/emit/
git commit -m "feat(contract): emit OpenAPI 3.1 document with valibot/TS schema integration"
```

---

### Task 10: `generateClient` orchestrator + watch wiring

**Goal:** programmatic API `generateClient({ controllers, dist, watch? })` を実装。controllers から source file path / export name を抽出 → analyzer → emitter → file write。

**Files:**
- Create: `packages/contract/src/generate-client.ts`
- Create: `packages/contract/src/watch.ts`
- Create: `packages/contract/src/__tests__/generate-client.test.ts`
- Modify: `packages/contract/src/index.ts`

- [ ] **Step 1: Implement generateClient**

`packages/contract/src/generate-client.ts`:

```ts
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { analyzeControllers, type ControllerSpec } from './analyzer/internal-representation';
import { createProject } from './analyzer/project';
import type { GenerateClientOptions } from './config/options';
import { emitAppGen } from './emit/app-gen';
import { emitOpenApi } from './emit/openapi';

const detectControllerFile = (cls: new (...args: never[]) => object): string | undefined => {
  // class.toString().match(/...sourceURL=(...)/) のような hack はせず、
  // 利用者に runtime で自分の source path を知る術がないのが TS の制約。
  // よって runtime では「class identifier の名前」しか取れず、source file path は取れない。
  //
  // 代替アプローチ: GenerateClientOptions を拡張し、明示的に
  //   { controllers: [{ class: UserController, source: './src/user.controller.ts' }, ...] }
  // を受けるか、controllers を tsconfig 上の glob から逆引きする。
  // MVP では programmatic API は後者の glob 逆引きを **採らず**、
  // 利用者が config 上で source path を併記する形を採る。
  return undefined;
};

// 上記 detectControllerFile が返せない事実を踏まえ、GenerateClientOptions の controllers を
// 「class そのもの」ではなく「{ class, source } のペア」に拡張する必要がある。
// → config/options.ts の型を拡張する Step 2 で対応。

export const generateClient = async (options: GenerateClientOptions): Promise<void> => {
  // Step 2 で options が { controllers: ControllerSpec[] } に変わる前提
  throw new Error('to be implemented after option-type refinement');
};
```

- [ ] **Step 2: Refine GenerateClientOptions to carry source paths**

`packages/contract/src/config/options.ts` を以下に書き換え:

```ts
type ControllerClass = new (...args: never[]) => object;

export type ControllerEntry =
  | ControllerClass
  | { readonly class: ControllerClass; readonly source: string };

export type GenerateClientOptions = {
  readonly controllers: readonly ControllerEntry[];
  readonly dist: string;
  readonly watch?: boolean;
  // tsconfig パス。OpenAPI 出力時 ts-json-schema-generator が必要。
  readonly tsconfig?: string;
};

export const defineConfig = <T extends GenerateClientOptions>(config: T): T => config;
```

> **Implementation note:** runtime で class の source 位置を取れない TS の制約への対応。
>
> 採用: 利用者は config 上で `{ class: UserController, source: './src/user.controller.ts' }` の形で書く。**class だけ渡された場合は build error** にして「source も併記してください」のヒントを出す。
>
> 利便性向上 (将来 §9.3 glob 対応時): glob で source path から class を import して spec を組む helper を追加できる。

`packages/contract/src/config/options.test.ts` の test を新型に合わせて更新。

- [ ] **Step 3: Implement generateClient body**

`packages/contract/src/generate-client.ts` を以下に書き換え:

```ts
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

import { analyzeControllers, type ControllerSpec } from './analyzer/internal-representation';
import { createProject } from './analyzer/project';
import type { ControllerEntry, GenerateClientOptions } from './config/options';
import { emitAppGen } from './emit/app-gen';
import { emitOpenApi } from './emit/openapi';

const toSpec = (entry: ControllerEntry): ControllerSpec => {
  if (typeof entry === 'function') {
    throw new Error(
      `koya/contract: controllers entry "${entry.name}" must be { class, source: '...' }. Class identifier alone cannot resolve source file path at runtime.`,
    );
  }
  return { filePath: resolvePath(entry.source), exportName: entry.class.name };
};

const writeIfChanged = async (path: string, content: string): Promise<boolean> => {
  try {
    const existing = await readFile(path, 'utf8');
    if (existing === content) return false;
  } catch {
    // file does not exist
  }
  await writeFile(path, content, 'utf8');
  return true;
};

export type GenerateClientResult = {
  readonly appGenChanged: boolean;
  readonly openApiChanged: boolean;
};

export const generateClient = async (options: GenerateClientOptions): Promise<GenerateClientResult> => {
  const specs = options.controllers.map(toSpec);
  const distDir = resolvePath(options.dist);
  const tsconfigPath = options.tsconfig ? resolvePath(options.tsconfig) : resolvePath('tsconfig.json');

  await mkdir(distDir, { recursive: true });

  const project = createProject({
    tsConfigFilePath: tsconfigPath,
    controllerFiles: specs.map((s) => s.filePath),
  });
  const ir = analyzeControllers(project, specs);

  const appGenContent = emitAppGen(ir, { distDir });
  const appGenPath = resolvePath(distDir, 'app.gen.ts');
  const appGenChanged = await writeIfChanged(appGenPath, appGenContent);

  const openApiDoc = await emitOpenApi(ir, { distDir, tsconfigPath });
  const openApiContent = `${JSON.stringify(openApiDoc, null, 2)}\n`;
  const openApiPath = resolvePath(distDir, 'openapi.json');
  const openApiChanged = await writeIfChanged(openApiPath, openApiContent);

  return { appGenChanged, openApiChanged };
};
```

- [ ] **Step 4: Implement watch loop**

`packages/contract/src/watch.ts`:

```ts
import { resolve as resolvePath } from 'node:path';
import chokidar from 'chokidar';

import type { GenerateClientOptions } from './config/options';
import { generateClient } from './generate-client';

export const watchClient = async (options: GenerateClientOptions): Promise<() => Promise<void>> => {
  // 監視対象: controller files + その依存 (best effort: 同一 src dir 全体)
  const watchedPaths = options.controllers.map((c) =>
    typeof c === 'function' ? '' : resolvePath(c.source),
  );
  // Initial run
  await generateClient(options);

  const watcher = chokidar.watch(watchedPaths, { ignoreInitial: true });
  watcher.on('change', async (path) => {
    try {
      const result = await generateClient(options);
      console.log(
        `[koya-contract] regenerated (app.gen.ts ${result.appGenChanged ? 'changed' : 'unchanged'}, openapi.json ${result.openApiChanged ? 'changed' : 'unchanged'}) — trigger: ${path}`,
      );
    } catch (e) {
      console.error('[koya-contract] regeneration failed:', e);
    }
  });

  return async () => {
    await watcher.close();
  };
};
```

- [ ] **Step 5: Write integration test for generateClient**

`packages/contract/src/__tests__/generate-client.test.ts`:

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateClient } from '../generate-client';

import { UserController } from '../analyzer/__tests__/fixtures/sample.controller';

const fixtureSource = resolve(
  __dirname,
  '../analyzer/__tests__/fixtures/sample.controller.ts',
);

describe('generateClient', () => {
  it('writes app.gen.ts and openapi.json', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'koya-contract-'));
    const result = await generateClient({
      controllers: [{ class: UserController, source: fixtureSource }],
      dist,
    });
    expect(result.appGenChanged).toBe(true);
    expect(result.openApiChanged).toBe(true);

    const appGen = await readFile(join(dist, 'app.gen.ts'), 'utf8');
    expect(appGen).toContain('export type AppType = BuildAppType<[');

    const openApi = JSON.parse(await readFile(join(dist, 'openapi.json'), 'utf8'));
    expect(openApi.openapi).toBe('3.1.0');
    expect(openApi.paths['/users/{id}']).toBeDefined();
  });

  it('returns changed=false on second run with no changes', async () => {
    const dist = await mkdtemp(join(tmpdir(), 'koya-contract-'));
    await generateClient({
      controllers: [{ class: UserController, source: fixtureSource }],
      dist,
    });
    const result = await generateClient({
      controllers: [{ class: UserController, source: fixtureSource }],
      dist,
    });
    expect(result.appGenChanged).toBe(false);
    expect(result.openApiChanged).toBe(false);
  });
});
```

- [ ] **Step 6: Run, iterate**

Run: `pnpm --filter @koya/contract test -- generate-client`
Expected: PASS。

- [ ] **Step 7: Update barrel**

`packages/contract/src/index.ts` に追記:

```ts
export { generateClient } from './generate-client';
export type { GenerateClientResult } from './generate-client';
export { watchClient } from './watch';
export type { ControllerEntry } from './config/options';
```

- [ ] **Step 8: Commit**

```bash
git add packages/contract/src/generate-client.ts \
        packages/contract/src/watch.ts \
        packages/contract/src/config/options.ts \
        packages/contract/src/config/options.test.ts \
        packages/contract/src/__tests__/generate-client.test.ts \
        packages/contract/src/index.ts
git commit -m "feat(contract): implement generateClient orchestrator and watch loop"
```

---

### Task 11: CLI (`koya-contract build` / `watch`) + config loader

**Goal:** `npx koya-contract build` / `watch` で `koya.config.ts` を auto-detect → import → `generateClient` を呼ぶ。`tsx` を runtime requirement とする。

**Files:**
- Create: `packages/contract/src/load-config.ts`
- Create: `packages/contract/src/cli.ts` (Task 4 の stub を上書き)
- Create: `packages/contract/src/__tests__/load-config.test.ts`

- [ ] **Step 1: Implement config loader**

`packages/contract/src/load-config.ts`:

```ts
import { access } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { GenerateClientOptions } from './config/options';

const DEFAULT_CONFIG_NAMES = ['koya.config.ts', 'koya.config.js', 'koya.config.mts', 'koya.config.mjs'];

const exists = async (p: string): Promise<boolean> => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

export const findConfigFile = async (cwd: string): Promise<string | undefined> => {
  for (const name of DEFAULT_CONFIG_NAMES) {
    const p = resolve(cwd, name);
    if (await exists(p)) return p;
  }
  return undefined;
};

export const loadConfig = async (path: string): Promise<GenerateClientOptions> => {
  const abs = isAbsolute(path) ? path : resolve(process.cwd(), path);
  const url = pathToFileURL(abs).href;
  const mod = (await import(url)) as { default?: GenerateClientOptions };
  if (!mod.default) {
    throw new Error(`koya/contract: ${path} must export a default GenerateClientOptions object`);
  }
  return mod.default;
};
```

- [ ] **Step 2: Write failing test for config loader**

`packages/contract/src/__tests__/load-config.test.ts`:

```ts
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findConfigFile } from '../load-config';

describe('findConfigFile', () => {
  it('finds koya.config.ts at cwd', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'koya-cfg-'));
    const file = join(dir, 'koya.config.ts');
    await writeFile(file, 'export default {}');
    const found = await findConfigFile(dir);
    expect(found).toBe(file);
  });

  it('returns undefined when none', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'koya-cfg-'));
    const found = await findConfigFile(dir);
    expect(found).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to confirm pass**

Run: `pnpm --filter @koya/contract test -- load-config`
Expected: PASS。

- [ ] **Step 4: Implement CLI**

`packages/contract/src/cli.ts` (Task 4 の stub を上書き):

```ts
#!/usr/bin/env node
import { cac } from 'cac';

import { generateClient } from './generate-client';
import { findConfigFile, loadConfig } from './load-config';
import { watchClient } from './watch';

const cli = cac('koya-contract');

const resolveConfigPath = async (provided: string | undefined): Promise<string> => {
  if (provided) return provided;
  const found = await findConfigFile(process.cwd());
  if (!found) {
    throw new Error('koya/contract: no koya.config.{ts,js,mts,mjs} found in cwd');
  }
  return found;
};

cli
  .command('build', 'Generate AppType + OpenAPI once')
  .option('-c, --config <path>', 'Path to koya.config file')
  .action(async (opts: { config?: string }) => {
    const cfgPath = await resolveConfigPath(opts.config);
    const cfg = await loadConfig(cfgPath);
    const result = await generateClient(cfg);
    console.log(
      `[koya-contract] built (app.gen.ts ${result.appGenChanged ? 'changed' : 'unchanged'}, openapi.json ${result.openApiChanged ? 'changed' : 'unchanged'})`,
    );
  });

cli
  .command('watch', 'Generate AppType + OpenAPI continuously')
  .option('-c, --config <path>', 'Path to koya.config file')
  .action(async (opts: { config?: string }) => {
    const cfgPath = await resolveConfigPath(opts.config);
    const cfg = await loadConfig(cfgPath);
    await watchClient({ ...cfg, watch: true });
    console.log('[koya-contract] watching ...');
  });

cli.help();
cli.version('0.0.0');
cli.parse(process.argv, { run: false });
await cli.runMatchedCommand();
```

- [ ] **Step 5: Build the package and test the CLI manually**

Run: `pnpm --filter @koya/contract build && node packages/contract/dist/cli.js --help`
Expected: cac help text が出る。

> **Manual smoke test (defer to Task 12):** 実際の `koya.config.ts` 読み込みは TS loader が必要。examples/hello で実証する (Task 12)。

- [ ] **Step 6: Commit**

```bash
git add packages/contract/src/load-config.ts \
        packages/contract/src/cli.ts \
        packages/contract/src/__tests__/load-config.test.ts
git commit -m "feat(contract): add koya-contract CLI with config auto-detect"
```

---

### Task 12: `examples/hello` rewrite + e2e test

**Goal:** Phase 2 (2) API で controller を書き直し、`koya.config.ts` を追加して `app.gen.ts` / `openapi.json` を生成 commit。`hc<AppType>` を呼ぶ e2e test で contract 動作確認 (validation 400 narrowing 含む)。

**Files:**
- Modify: `examples/hello/src/entry/hello.controller.ts`
- Create: `examples/hello/src/controllers.ts`
- Modify: `examples/hello/src/app.ts`
- Create: `examples/hello/koya.config.ts`
- Create: `examples/hello/generated/app.gen.ts` (generated)
- Create: `examples/hello/generated/openapi.json` (generated)
- Modify: `examples/hello/src/test/hello.e2e-spec.ts`
- Modify: `examples/hello/package.json`

- [ ] **Step 1: Add @koya/contract dependency and tsx runtime**

`examples/hello/package.json` を以下に修正:

```json
{
  "name": "@examples/hello",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/main.ts",
    "contract:build": "tsx node_modules/@koya/contract/src/cli.ts build",
    "contract:watch": "tsx node_modules/@koya/contract/src/cli.ts watch"
  },
  "dependencies": {
    "@koya/core": "workspace:*",
    "@koya/contract": "workspace:*",
    "hono": "4.12.16",
    "valibot": "1.3.1"
  },
  "devDependencies": {
    "tsx": "4.21.0"
  }
}
```

> Pin tsx version. `contract:build` script は dist の `koya-contract` ではなく source の `cli.ts` を直接 tsx で実行している (TS loader が必要なため)。利用者プロジェクトでも同等のパターンを推奨する。

- [ ] **Step 2: Rewrite hello.controller.ts to use response() + validated()**

`examples/hello/src/entry/hello.controller.ts`:

```ts
import { Controller, Get, Post, inject, pathParam, response, validated } from '@koya/core';
import * as v from 'valibot';

import { HelloService } from './hello.service';

export const GreetBody = v.object({
  name: v.string(),
  excited: v.optional(v.boolean()),
});
export type GreetBody = v.InferOutput<typeof GreetBody>;

export type GreetResponse = {
  message: string;
};

@Controller('/hello')
export class HelloController {
  constructor(private helloService = inject(HelloService)) {}

  @Get('/:name')
  greet(name = pathParam('name')): GreetResponse {
    return { message: this.helloService.greet(name) };
  }

  @Post('/')
  greetPost(body = validated(GreetBody), res = response()) {
    const message = body.excited === true
      ? `${this.helloService.greet(body.name)}!!!`
      : this.helloService.greet(body.name);
    return res.json({ message }, 201);
  }
}
```

- [ ] **Step 3: Add controllers list in dedicated file**

`examples/hello/src/controllers.ts`:

```ts
import { HelloController } from './entry/hello.controller';

export const controllers = [HelloController];
```

- [ ] **Step 4: Update app.ts to consume controllers list**

`examples/hello/src/app.ts`:

```ts
import { createHttpApp } from '@koya/core';

import { controllers } from './controllers';

export const app = createHttpApp({ controllers });
```

- [ ] **Step 5: Add koya.config.ts**

`examples/hello/koya.config.ts`:

```ts
import { defineConfig } from '@koya/contract';

import { HelloController } from './src/entry/hello.controller';

export default defineConfig({
  controllers: [{ class: HelloController, source: './src/entry/hello.controller.ts' }],
  dist: './generated',
  tsconfig: './tsconfig.json',
});
```

- [ ] **Step 6: Run contract build**

Run: `pnpm --filter @examples/hello contract:build`
Expected:
- `examples/hello/generated/app.gen.ts` 生成
- `examples/hello/generated/openapi.json` 生成
- console: `[koya-contract] built (...)`

- [ ] **Step 7: Inspect generated files**

```bash
cat examples/hello/generated/app.gen.ts
cat examples/hello/generated/openapi.json
```

期待:
- `app.gen.ts` に `import type { HelloController } from '../src/entry/hello.controller'` と `Route<'GET', '/hello/:name', typeof HelloController.prototype.greet>` 等が含まれる
- `openapi.json` に `/hello/{name}` GET / `/hello` POST / `components.schemas.GreetBody` / `components.schemas.GreetResponse` / `components.schemas.ValidationErrorBody` が含まれる
- POST `/hello` の responses に `400` が自動登録されている

- [ ] **Step 8: Update e2e test to exercise hc<AppType> with 400 narrowing**

`examples/hello/src/test/hello.e2e-spec.ts`:

```ts
import { hc } from 'hono/client';
import { describe, expect, it } from 'vitest';

import { app } from '../app';
import type { AppType } from '../../generated/app.gen';

describe('/hello', () => {
  const worker = app.toWorker();
  const client = hc<AppType>('https://example.local', {
    fetch: (req: Request) => worker.fetch(req),
  });

  it('GET narrows response', async () => {
    const res = await client.hello[':name'].$get({ param: { name: 'koya' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ message: 'hello, koya' });
  });

  it('POST returns 201 with validated body', async () => {
    const res = await client.hello.$post({ json: { name: 'koya', excited: true } });
    expect(res.status).toBe(201);
    if (res.status === 201) {
      const body = await res.json();
      expect(body).toMatchObject({ message: 'hello, koya!!!' });
    }
  });

  it('POST returns 400 ValidationErrorBody on invalid payload', async () => {
    const res = await client.hello.$post({
      // @ts-expect-error — purposely invalid payload to trigger validation error
      json: { name: 123 },
    });
    expect(res.status).toBe(400);
    if (res.status === 400) {
      const body = await res.json();
      expect(body.error).toBe('validation_failed');
      expect(Array.isArray(body.issues)).toBe(true);
    }
  });
});
```

- [ ] **Step 9: Run e2e test**

Run: `pnpm --filter @examples/hello test`
Expected: PASS (3 tests)。

失敗時の対処:
- hc が AppType を読めず型エラー → `BuildAppType` shape を hono 互換に再調整 (Task 5 へ戻る)
- 400 narrowing で `body.error` 型不明 → `ExtractValidationErrors` の戻り型確認

- [ ] **Step 10: Verify generated files diff is clean if regenerated**

Run: `pnpm --filter @examples/hello contract:build && git status examples/hello/generated/`
Expected: no changes (idempotent regeneration)。

- [ ] **Step 11: Commit**

```bash
git add examples/hello/
git commit -m "feat(examples/hello): adopt Phase 2 (2) API with hc<AppType> e2e test"
```

---

### Task 13: spec §4.1 update + comparison doc update

**Goal:** Phase 2 (1) spec の §4.1 を本 spec §8 で確定した文面に置き換え、比較表 (`docs/comparison/koya-vs-nestjs.md`) の RPC client / hono 隠蔽境界の行を更新。

**Files:**
- Modify: `docs/superpowers/specs/2026-05-02-koya-phase2-api-design.md`
- Modify: `docs/comparison/koya-vs-nestjs.md`

- [ ] **Step 1: Read existing §4.1 in Phase 2 (1) spec**

Read `docs/superpowers/specs/2026-05-02-koya-phase2-api-design.md` 全体を確認し、§4.1 の現行文面を特定する。

- [ ] **Step 2: Replace §4.1 content**

§4.1 の本文を以下に書き換える (本 spec §8 の文面そのまま):

```markdown
### 4.1 hono / DI コンテナ非露出 (server side) / hono client 利用 (client side)

ユーザーが書くのは Entry クラスと Provider。Hono の `Context` には **直接触らせない**。response 制御は `response()` primitive の戻す **`ResponseBuilder`** を経由する。

公開 API として `hono.Context` / `Hono` クラス本体 / `@needle-di/core.Container` 等は引き続き露出してはならない。`ResponseBuilder` の戻り値型 `TypedResponse<T, S, F>` は hono 由来の型だが、利用者は **そのまま return する** だけで触ることはなく、AppType の解析対象として使われる。

client 側 (`hc<AppType>` を呼ぶ側) は hono の `hono/client` を **直接利用** する。これは server 側の隠蔽と独立した方針で、hono の成熟した RPC client 機構を再発明しないため。`HTTPException` は `@koya/core` から re-export されており、利用者は hono 直接 import を行わない。
```

- [ ] **Step 3: Add note in Phase 2 (1) spec referring to Phase 2 (2)**

Phase 2 (1) spec の §4.1 末尾または関連 footnote に追記:

```markdown
> 本節は Phase 2 (2) (`docs/superpowers/specs/2026-05-03-koya-phase2-2-contract-design.md`) で response 系 primitive 確立時に更新された (server 側 Context 非露出維持 / client 側 hc 直接利用許容 / `HTTPException` re-export)。
```

- [ ] **Step 4: Update koya-vs-nestjs.md comparison rows**

`docs/comparison/koya-vs-nestjs.md` 内の以下行を更新:

- "RPC / type-safe client" 行: koya 列を `hono の hc<AppType> を直接利用 (build step で AppType 生成)` に
- "OpenAPI 生成" 行: koya 列を `@koya/contract が build step で AppType と OpenAPI 3.1 を同時生成 (zero-annotation, Scramble 流)` に
- "hono Context 露出" 行: `server 側非露出 / response 制御は response() primitive 経由 / client 側 hc は直接利用` に
- "Error 系 export" 行: `@koya/core から HTTPException を re-export (hono 直接 import 不要)` に

具体的な行が見つからない場合は新規追加する形でも良い。

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-05-02-koya-phase2-api-design.md \
        docs/comparison/koya-vs-nestjs.md
git commit -m "docs: update Phase 2 (1) §4.1 and koya-vs-nestjs comparison for Phase 2 (2)"
```

---

## Final verification

全 Task 完了後、root で final check を回す:

- [ ] **Run full pipeline**

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm lint
```

Expected: 全 green。

- [ ] **Verify generated files are committed and idempotent**

```bash
pnpm --filter @examples/hello contract:build
git diff --stat
```

Expected: `git diff` が empty (生成 file が既に commit 済みかつ regeneration で変化しない)。

- [ ] **Smoke-test CLI binary**

```bash
cd examples/hello
npx koya-contract build
npx koya-contract --help
```

Expected: build / help が動く。

---

## Self-review notes

spec §13 の 12 項目を本 plan の Task に対応:

| spec §13 | plan Task |
|---|---|
| 1. response() primitive | Task 1 |
| 2. HTTPException re-export | Task 2 |
| 3. ValidationErrorBody 型定義 + error-handler 揃え | Task 3 |
| 4. @koya/contract package + 型関数 + GenerateClientOptions/defineConfig | Task 4 (skeleton), Task 5 (型関数), Task 6 (defineConfig) |
| 5. generateClient 実装 | Task 10 |
| 6. AST 解析機構 | Task 7 |
| 7. AppType 出力 | Task 8 |
| 8. OpenAPI 出力 | Task 9 |
| 9. CLI | Task 11 |
| 10. examples/hello rewrite + e2e | Task 12 |
| 11. spec §4.1 更新 | Task 13 |
| 12. comparison doc 更新 | Task 13 |

カバレッジ漏れなし。

依存順序の確認:
- Task 1 → response primitive を Task 12 example が利用
- Task 3 → ValidationErrorBody を Task 5 (ExtractValidationErrors) と Task 9 (OpenAPI 自動登録) が利用
- Task 5 → ValidatedMarker を Task 7 analyzer が概念的に意識 (型は core から re-export)
- Task 7 → analyzer を Task 8/9 emitter が利用
- Task 10 → generateClient が Task 8/9 emitter を利用
- Task 11 → CLI が Task 10 generateClient を利用
- Task 12 → 全部が揃った状態で example dogfood

placeholder scan 完了 (TBD/TODO/"add appropriate" 等なし)。

type 名の整合性:
- `ValidationErrorBody` (Task 3, 5, 9) — 統一
- `ValidatedMarker<T>` (Task 5) — core export、contract re-export
- `Route<M, P, H>` / `BuildAppType<...>` — 統一
- `GenerateClientOptions` (Task 6 で `controllers: ControllerEntry[]` に拡張、Task 10 で利用)
- `ControllerEntry = ControllerClass | { class, source }` (Task 10)
